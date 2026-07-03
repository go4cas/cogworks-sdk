/**
 * Live-server roundtrip. Spins a real Cogworks, exercises the SDK end-to-end.
 *
 * Skipped automatically when the sibling cogworks server source is not
 * resolvable (e.g., on a standalone clone of the SDK repo).
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Cogworks } from "../../src/index.ts";
import { generateTypes, type SnapshotShape } from "../../src/codegen/generate.ts";
import { MemoryAuthStore } from "../../src/auth/store.ts";
import { startTestServer, serverAvailable } from "./server.ts";

const RUN = serverAvailable();
const d = RUN ? describe : describe.skip;

let server: Awaited<ReturnType<typeof startTestServer>>;
let vb: Cogworks;

interface PostRecord {
  id: string;
  title: string;
  body?: string;
  cover?: string;
}

d("integration — SDK ↔ live Cogworks", () => {
  beforeAll(async () => {
    server = await startTestServer();
    vb = new Cogworks({
      baseUrl: server.baseUrl,
      authStore: new MemoryAuthStore(),
      withCredentials: false,
    });
    vb.client.authStore.set({ token: server.adminToken });

    // Seed a `posts` collection used by every test below.
    await vb.client.request("/api/v1/collections", {
      method: "POST",
      body: {
        name: "posts",
        type: "base",
        fields: [
          { name: "title", type: "text", required: true },
          { name: "body", type: "editor" },
          { name: "cover", type: "file" },
        ],
      },
    });
  });

  afterAll(() => {
    vb.closeRealtime();
    server?.cleanup();
  });

  it("admin /me returns the seeded admin", async () => {
    const me = await vb.auth.admin.me();
    expect(me.email).toBe(server.adminEmail);
    expect(me.aud).toBe("admin");
  });

  it("CRUDs a record through the typed Collection accessor", async () => {
    const created = await vb
      .collection<PostRecord>("posts")
      .create({ title: "hello", body: "<p>hi</p>" });
    expect(created.id).toBeTruthy();

    const fetched = await vb.collection<PostRecord>("posts").get(created.id);
    expect(fetched.title).toBe("hello");

    const updated = await vb
      .collection<PostRecord>("posts")
      .update(created.id, { title: "renamed" });
    expect(updated.title).toBe("renamed");

    const list = await vb.collection<PostRecord>("posts").list({ filter: 'title = "renamed"' });
    expect(list.data.length).toBeGreaterThanOrEqual(1);

    await vb.collection("posts").delete(created.id);
  });

  it("paginates via iterate() generator", async () => {
    for (let i = 0; i < 25; i++) {
      await vb.collection<PostRecord>("posts").create({ title: `gen-${i}` });
    }
    let count = 0;
    for await (const _r of vb.collection<PostRecord>("posts").iterate({
      filter: 'title ~ "gen-"',
      perPage: 10,
    })) {
      void _r;
      count++;
    }
    expect(count).toBeGreaterThanOrEqual(25);
  });

  it("batch endpoint executes mixed ops", async () => {
    const r = await vb
      .batch()
      .create("posts", { title: "b1" })
      .create("posts", { title: "b2" })
      .list("posts", { filter: 'title ~ "b"', perPage: 5 })
      .run();
    expect(r.length).toBe(3);
    expect(r[0]?.status).toBeGreaterThanOrEqual(200);
    expect(r[2]?.status).toBeGreaterThanOrEqual(200);
  });

  it("file upload + URL builder + delete", async () => {
    const post = await vb.collection<PostRecord>("posts").create({ title: "with-file" });
    const blob = new File([new Uint8Array([1, 2, 3, 4])], "tiny.bin", {
      type: "application/octet-stream",
    });
    const meta = await vb.files.upload("posts", post.id, "cover", blob);
    const m = Array.isArray(meta) ? meta[0]! : meta;
    expect(m.filename).toBeTruthy();
    expect(vb.files.url(m.filename)).toContain("/api/v1/files/");
    await vb.files.delete("posts", post.id, "cover", m.filename);
  });

  it("realtime: WS subscribes and receives a create event", async () => {
    const seen: string[] = [];
    const off = vb.subscribe<PostRecord>("posts", "*", (e) => {
      if (e.type === "create" && e.record?.title) seen.push(e.record.title);
    });

    await new Promise((r) => setTimeout(r, 250));
    await vb.collection<PostRecord>("posts").create({ title: "rt-event" });

    let waited = 0;
    while (seen.length === 0 && waited < 3000) {
      await new Promise((r) => setTimeout(r, 50));
      waited += 50;
    }
    off();
    expect(seen).toContain("rt-event");
  });

  it("codegen: generates compilable types from the live snapshot", async () => {
    const snap = await vb.client.request<SnapshotShape>("/api/v1/admin/migrations/snapshot");
    const ts = generateTypes(snap);
    expect(ts).toContain("export type Schema = {");
    expect(ts).toContain("PostsRecord");
    expect(ts).toContain("PostsCreate");
    expect(ts).toContain("title: string");
  });

  it("error model: 401 → kind=auth", async () => {
    const anon = new Cogworks({
      baseUrl: server.baseUrl,
      authStore: new MemoryAuthStore(),
      withCredentials: false,
    });
    try {
      await anon.client.request("/api/v1/admin/auth/me");
      throw new Error("should have rejected");
    } catch (e) {
      const err = e as { kind?: string };
      expect(err.kind).toBe("auth");
    }
  });
});
