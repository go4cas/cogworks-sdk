import { describe, expect, it } from "bun:test";
import { VaultbaseError, isVaultbaseError } from "../src/errors.ts";

describe("VaultbaseError", () => {
  it("network factory carries cause", () => {
    const cause = new Error("offline");
    const e = VaultbaseError.network("net down", cause);
    expect(e.kind).toBe("network");
    if (e.data.kind === "network") expect(e.data.cause).toBe(cause);
  });

  it("auth factory captures reason", () => {
    const e = VaultbaseError.auth("expired");
    expect(e.kind).toBe("auth");
    if (e.data.kind === "auth") expect(e.data.reason).toBe("expired");
  });

  it("validation carries details map", () => {
    const e = VaultbaseError.validation("bad", { email: "required" });
    if (e.data.kind === "validation") expect(e.data.details["email"]).toBe("required");
  });

  it("isVaultbaseError narrows correctly", () => {
    const e: unknown = VaultbaseError.aborted();
    expect(isVaultbaseError(e)).toBe(true);
    expect(isVaultbaseError(new Error("x"))).toBe(false);
  });

  it("instanceof Error compatibility", () => {
    const e = VaultbaseError.server(500, "boom");
    expect(e instanceof Error).toBe(true);
    expect(e instanceof VaultbaseError).toBe(true);
  });
});
