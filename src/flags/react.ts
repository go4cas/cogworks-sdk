/**
 * React hooks for FlagsClient.
 *
 *   import { useFlag } from "@vaultbase/sdk/flags/react";
 *   const enabled = useFlag(vb.flags, "new_checkout", false);
 *   const variant = useFlagString(vb.flags, "checkout_variant", "control");
 *
 * Hooks subscribe to FlagsClient's `change` event so re-renders only fire
 * when a relevant key actually changes (no global re-render thrash on
 * unrelated flag updates).
 */
import { useEffect, useState } from "react";
import type { FlagsClient } from "./manager.ts";

function useFlagBase<T>(client: FlagsClient, key: string, getter: () => T): T {
  const [value, setValue] = useState<T>(getter);
  useEffect(() => {
    setValue(getter());
    const off = client.on("change", (changedKeys) => {
      if (changedKeys.includes(key)) setValue(getter());
    });
    return off;
    // getter is closed over key; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, getter]);
  return value;
}

export function useFlag(client: FlagsClient, key: string, fallback = false): boolean {
  return useFlagBase(client, key, () => client.isEnabled(key, fallback));
}

export function useFlagString(client: FlagsClient, key: string, fallback: string): string {
  return useFlagBase(client, key, () => client.getString(key, fallback));
}

export function useFlagNumber(client: FlagsClient, key: string, fallback: number): number {
  return useFlagBase(client, key, () => client.getNumber(key, fallback));
}

export function useFlagJson<T = unknown>(client: FlagsClient, key: string, fallback: T): T {
  return useFlagBase(client, key, () => client.getJson<T>(key, fallback));
}
