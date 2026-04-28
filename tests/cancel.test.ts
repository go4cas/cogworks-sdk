import { describe, expect, it } from "bun:test";
import { CancelRegistry } from "../src/cancel.ts";

describe("CancelRegistry", () => {
  it("aborts the prior controller when acquiring the same key", () => {
    const r = new CancelRegistry();
    const a = r.acquire("k");
    const b = r.acquire("k");
    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(false);
  });

  it("release with a stale signal is a no-op", () => {
    const r = new CancelRegistry();
    const a = r.acquire("k");
    const b = r.acquire("k"); // aborts a
    r.release("k", a);        // stale; should NOT clear b
    const c = r.acquire("k");
    expect(b.aborted).toBe(true);
    expect(c.aborted).toBe(false);
  });

  it("abortAll cancels every key", () => {
    const r = new CancelRegistry();
    const a = r.acquire("a");
    const b = r.acquire("b");
    r.abortAll();
    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(true);
  });
});
