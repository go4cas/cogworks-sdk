import { describe, expect, it } from "bun:test";
import { Batch, type BatchOpResult } from "../src/batch.ts";
import { HttpClient } from "../src/client.ts";
import { MemoryAuthStore } from "../src/auth/store.ts";
import type { CollectionTypes, ListResponse } from "../src/types.ts";

interface PostRec {
  id: string;
  title: string;
}
interface PostCreate {
  title: string;
}
interface PostUpdate {
  title?: string;
}

interface UserRec {
  id: string;
  email: string;
}
interface UserCreate {
  email: string;
}
interface UserUpdate {
  email?: string;
}

type TestSchema = {
  posts: CollectionTypes<PostRec, PostCreate, PostUpdate>;
  users: CollectionTypes<UserRec, UserCreate, UserUpdate>;
};

function client(): HttpClient {
  return new HttpClient({
    baseUrl: "http://localhost",
    authStore: new MemoryAuthStore(),
    fetch: ((req: Request | string, init?: RequestInit) => {
      const r = typeof req === "string" ? new Request(req, init) : req;
      void r;
      // server returns array of per-op results in order of submission
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { status: 201, body: { id: "p1", title: "hi" } },
            { status: 200, body: { id: "u1", email: "x@y.z" } },
            {
              status: 200,
              body: {
                data: [{ id: "p2", title: "two" }],
                page: 1,
                perPage: 10,
                totalItems: 1,
                totalPages: 1,
              },
            },
          ]),
          { headers: { "content-type": "application/json" } },
        ),
      );
    }) as typeof fetch,
  });
}

describe("Batch (typed)", () => {
  it("returns a tuple typed per op", async () => {
    const c = client();
    const b = new Batch<TestSchema>(c)
      .create("posts", { title: "hi" })
      .get("users", "u1")
      .list("posts");
    const result = await b.run();
    // structural-type assertions (won't fail at runtime — TS catch)
    const created: BatchOpResult<PostRec> = result[0];
    const fetched: BatchOpResult<UserRec> = result[1];
    const listed: BatchOpResult<ListResponse<PostRec>> = result[2];
    expect(created.body.id).toBe("p1");
    expect(created.body.title).toBe("hi");
    expect(fetched.body.email).toBe("x@y.z");
    expect(listed.body.data[0]?.title).toBe("two");
  });

  it("untyped construction still works (DefaultSchema fallback)", async () => {
    const b = new Batch(client()).create("anything", { x: 1 });
    expect(b.size()).toBe(1);
  });
});
