import { describe, expect, it } from "bun:test";
import { MemoryAuthStore } from "../src/auth/store.ts";

describe("MemoryAuthStore", () => {
  it("round-trips set + get", () => {
    const s = new MemoryAuthStore();
    s.set({ token: "t", record: { id: "u1" } });
    expect(s.get()?.token).toBe("t");
    s.set(null);
    expect(s.get()).toBeNull();
  });

  it("notifies onChange listeners", () => {
    const s = new MemoryAuthStore();
    let calls = 0;
    const off = s.onChange(() => calls++);
    s.set({ token: "x" });
    s.set(null);
    off();
    s.set({ token: "y" });
    expect(calls).toBe(2);
  });
});
