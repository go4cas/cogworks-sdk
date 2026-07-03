import { describe, expect, it } from "bun:test";
import { CogworksError, isCogworksError } from "../src/errors.ts";

describe("CogworksError", () => {
  it("network factory carries cause", () => {
    const cause = new Error("offline");
    const e = CogworksError.network("net down", cause);
    expect(e.kind).toBe("network");
    if (e.data.kind === "network") expect(e.data.cause).toBe(cause);
  });

  it("auth factory captures reason", () => {
    const e = CogworksError.auth("expired");
    expect(e.kind).toBe("auth");
    if (e.data.kind === "auth") expect(e.data.reason).toBe("expired");
  });

  it("validation carries details map", () => {
    const e = CogworksError.validation("bad", { email: "required" });
    if (e.data.kind === "validation") expect(e.data.details.email).toBe("required");
  });

  it("isCogworksError narrows correctly", () => {
    const e: unknown = CogworksError.aborted();
    expect(isCogworksError(e)).toBe(true);
    expect(isCogworksError(new Error("x"))).toBe(false);
  });

  it("instanceof Error compatibility", () => {
    const e = CogworksError.server(500, "boom");
    expect(e instanceof Error).toBe(true);
    expect(e instanceof CogworksError).toBe(true);
  });
});
