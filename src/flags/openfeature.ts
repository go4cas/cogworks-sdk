/**
 * OpenFeature provider for vaultbase. Drop-in for both
 * `@openfeature/server-sdk` and `@openfeature/web-sdk`. Avoids hard
 * dependency on either by typing against a structurally-compatible
 * interface and casting at the call site.
 *
 *   import { OpenFeature } from "@openfeature/server-sdk";
 *   import { VaultbaseFlagsProvider } from "@vaultbase/sdk/openfeature";
 *
 *   await OpenFeature.setProviderAndWait(new VaultbaseFlagsProvider(vb.flags));
 *   const client = OpenFeature.getClient();
 *   const enabled = await client.getBooleanValue("new_checkout", false);
 *
 * The provider delegates evaluation to the in-memory FlagsClient cache
 * (populated by FlagsClient.connect). When OpenFeature evaluates a flag
 * we don't have, we fall back to the supplied default and report
 * `FLAG_NOT_FOUND`.
 */
import type { FlagsClient } from "./manager.ts";

type Reason = "TARGETING_MATCH" | "DEFAULT" | "DISABLED" | "ERROR";

interface ResolutionDetails<T> {
  value: T;
  reason: Reason;
  errorCode?: string;
  errorMessage?: string;
}

interface EvaluationContext {
  targetingKey?: string;
  [key: string]: unknown;
}

export class VaultbaseFlagsProvider {
  readonly metadata = { name: "vaultbase" };
  readonly runsOn: "server" | "client" = "client";
  readonly events = createEventEmitter();
  private context: EvaluationContext = {};

  constructor(private readonly flags: FlagsClient) {}

  async initialize(context?: EvaluationContext): Promise<void> {
    this.context = context ?? {};
    if (!this.flags.isConnected()) {
      await this.flags.connect({ context: contextForFlags(this.context) });
    }
    // Re-emit FlagsClient changes onto the OpenFeature event bus so the
    // SDK's cache invalidation hooks fire.
    this.flags.on("change", () => this.events.emit("PROVIDER_CONFIGURATION_CHANGED"));
  }

  async onContextChange(_old: EvaluationContext, next: EvaluationContext): Promise<void> {
    this.context = next;
    await this.flags.setContext(contextForFlags(next));
  }

  async onClose(): Promise<void> {
    this.flags.disconnect();
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
    return resolveTyped(this.flags, flagKey, defaultValue, "boolean");
  }
  resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string> {
    return resolveTyped(this.flags, flagKey, defaultValue, "string");
  }
  resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number> {
    return resolveTyped(this.flags, flagKey, defaultValue, "number");
  }
  resolveObjectEvaluation<T>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    const all = this.flags.all();
    if (!(flagKey in all)) {
      return { value: defaultValue, reason: "DEFAULT", errorCode: "FLAG_NOT_FOUND" };
    }
    return { value: all[flagKey] as T, reason: "TARGETING_MATCH" };
  }
}

function resolveTyped<T extends boolean | string | number>(
  flags: FlagsClient,
  flagKey: string,
  defaultValue: T,
  expected: "boolean" | "string" | "number",
): ResolutionDetails<T> {
  const all = flags.all();
  if (!(flagKey in all)) {
    return { value: defaultValue, reason: "DEFAULT", errorCode: "FLAG_NOT_FOUND" };
  }
  const v = all[flagKey];
  if (typeof v !== expected) {
    return {
      value: defaultValue,
      reason: "ERROR",
      errorCode: "TYPE_MISMATCH",
      errorMessage: `expected ${expected}, got ${typeof v}`,
    };
  }
  return { value: v as T, reason: "TARGETING_MATCH" };
}

/**
 * OpenFeature targets via `targetingKey` + flat top-level fields. FlagsClient
 * accepts arbitrary nested objects (matching the server's evaluation model
 * with paths like `user.plan`). We promote `targetingKey` to `user.id` and
 * pass the rest through unchanged so existing nested contexts work too.
 */
function contextForFlags(ctx: EvaluationContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ctx };
  if (ctx.targetingKey) {
    const user = (out.user as Record<string, unknown> | undefined) ?? {};
    if (!user.id) user.id = ctx.targetingKey;
    out.user = user;
  }
  delete out.targetingKey;
  return out;
}

function createEventEmitter(): {
  emit(event: string): void;
  on(event: string, cb: () => void): void;
} {
  const handlers = new Map<string, Set<() => void>>();
  return {
    emit(event) {
      handlers.get(event)?.forEach((h) => {
        try {
          h();
        } catch {
          /* noop */
        }
      });
    },
    on(event, cb) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(cb);
    },
  };
}
