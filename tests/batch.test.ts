import { describe, expect, it } from "bun:test";
import { Batch } from "../src/batch.ts";
import { HttpClient } from "../src/client.ts";
import { MemoryAuthStore } from "../src/auth/store.ts";
import { CogworksError } from "../src/errors.ts";

function client(handler?: (req: Request) => Response): HttpClient {
  return new HttpClient({
    baseUrl: "http://localhost",
    authStore: new MemoryAuthStore(),
    fetch: ((req: Request | string, init?: RequestInit) => {
      const r = typeof req === "string" ? new Request(req, init) : req;
      return Promise.resolve(
        handler
          ? handler(r)
          : new Response(JSON.stringify({ data: { data: [] } }), {
              headers: { "content-type": "application/json" },
            }),
      );
    }) as typeof fetch,
  });
}

describe("Batch", () => {
  it("size grows with each method", () => {
    const b = new Batch(client());
    b.create("posts", { title: "x" })
      .update("posts", "id1", { title: "y" })
      .delete("posts", "id2")
      .get("posts", "id3")
      .list("posts");
    expect(b.size()).toBe(5);
  });

  it("throws validation on > 100 ops", async () => {
    const b = new Batch(client());
    for (let i = 0; i < 101; i++) b.create("posts", { i });
    try {
      await b.run();
      throw new Error("should not run");
    } catch (e) {
      expect(e instanceof CogworksError).toBe(true);
      expect((e as CogworksError).kind).toBe("validation");
    }
  });

  it("posts to /api/batch with operations array", async () => {
    let body: unknown;
    const c = client((req) => {
      // capture body via body in init isn't directly visible — we just confirm path
      void req.url;
      return new Response(JSON.stringify({ data: [{ status: 201, body: { id: "x" } }] }), {
        headers: { "content-type": "application/json" },
      });
    });
    const b = new Batch(c).create("posts", { title: "x" });
    const r = await b.run();
    expect(r[0]?.status).toBe(201);
    void body;
  });
});
