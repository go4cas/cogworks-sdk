/**
 * Per-key request cancellation. Opt-in: callers pass `requestKey` and a
 * subsequent call with the same key aborts the previous in-flight one.
 */

export class CancelRegistry {
  private map = new Map<string, AbortController>();

  /**
   * Register a fresh AbortController under `key`. Aborts any prior controller
   * sharing the same key. Returns the new controller's signal.
   */
  acquire(key: string): AbortSignal {
    const prior = this.map.get(key);
    if (prior) {
      try {
        prior.abort();
      } catch {
        /* noop */
      }
    }
    const ctrl = new AbortController();
    this.map.set(key, ctrl);
    return ctrl.signal;
  }

  /** Drop the controller bound to `key` once the request has settled. */
  release(key: string, signal: AbortSignal): void {
    const cur = this.map.get(key);
    if (cur && cur.signal === signal) this.map.delete(key);
  }

  /** Abort everything (e.g., on logout or unmount of a page). */
  abortAll(): void {
    for (const ctrl of this.map.values()) {
      try {
        ctrl.abort();
      } catch {
        /* noop */
      }
    }
    this.map.clear();
  }
}
