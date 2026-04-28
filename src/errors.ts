/**
 * Discriminated error union. Every SDK call rejects with a `VaultbaseError`
 * carrying a `kind` so apps can `switch` instead of string-matching.
 */

export type ErrorKind =
  | "network"
  | "auth"
  | "validation"
  | "rate_limit"
  | "conflict"
  | "server"
  | "aborted";

export interface NetworkErrorData    { kind: "network"; message: string; cause?: unknown }
export interface AuthErrorData       { kind: "auth"; message: string; reason: "expired" | "invalid" | "forbidden" }
export interface ValidationErrorData { kind: "validation"; message: string; details: Record<string, string> }
export interface RateLimitErrorData  { kind: "rate_limit"; message: string; retryAfterMs: number }
export interface ConflictErrorData   { kind: "conflict"; message: string; serverCode: 409 | 422 }
export interface ServerErrorData     { kind: "server"; message: string; status: number; body?: unknown }
export interface AbortedErrorData    { kind: "aborted"; message: string }

export type VaultbaseErrorData =
  | NetworkErrorData
  | AuthErrorData
  | ValidationErrorData
  | RateLimitErrorData
  | ConflictErrorData
  | ServerErrorData
  | AbortedErrorData;

export class VaultbaseError extends Error {
  readonly kind: ErrorKind;
  readonly data: VaultbaseErrorData;

  constructor(data: VaultbaseErrorData) {
    super(data.message);
    this.name = "VaultbaseError";
    this.kind = data.kind;
    this.data = data;
    Object.setPrototypeOf(this, VaultbaseError.prototype);
  }

  static network(message: string, cause?: unknown): VaultbaseError {
    return new VaultbaseError({ kind: "network", message, ...(cause !== undefined ? { cause } : {}) });
  }
  static auth(reason: AuthErrorData["reason"], message?: string): VaultbaseError {
    return new VaultbaseError({ kind: "auth", reason, message: message ?? `Authentication failed: ${reason}` });
  }
  static validation(message: string, details: Record<string, string> = {}): VaultbaseError {
    return new VaultbaseError({ kind: "validation", message, details });
  }
  static rateLimit(retryAfterMs: number, message = "Rate limited"): VaultbaseError {
    return new VaultbaseError({ kind: "rate_limit", message, retryAfterMs });
  }
  static conflict(serverCode: 409 | 422, message: string): VaultbaseError {
    return new VaultbaseError({ kind: "conflict", message, serverCode });
  }
  static server(status: number, message: string, body?: unknown): VaultbaseError {
    return new VaultbaseError({ kind: "server", message, status, ...(body !== undefined ? { body } : {}) });
  }
  static aborted(message = "Request aborted"): VaultbaseError {
    return new VaultbaseError({ kind: "aborted", message });
  }
}

/** Convenience type-guard. */
export function isVaultbaseError(e: unknown): e is VaultbaseError {
  return e instanceof VaultbaseError;
}
