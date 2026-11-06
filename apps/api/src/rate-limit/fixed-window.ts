/**
 * In-memory fixed-window rate limiter.
 *
 * Deliberately dependency-free and per-process: one API instance serves this
 * business, and a shared window would add Redis (or similar) for no benefit at
 * this size. The trade-off is recorded here so it is not mistaken for a
 * distributed limiter — restarting the process clears every window, and a
 * second API instance counts independently.
 *
 * `take()` returns `null` when the call is allowed and the number of seconds to
 * wait when it is not, so callers decide their own HTTP shape.
 */
interface Window {
  count: number;
  startedAt: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();
  private sweepAt: number;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('windowMs must be a positive integer');
    this.sweepAt = limit * 2;
  }

  take(key: string, now = Date.now()): number | null {
    this.sweep(now);

    const window = this.windows.get(key);
    if (!window || now - window.startedAt >= this.windowMs) {
      this.windows.set(key, { count: 1, startedAt: now });
      return null;
    }
    if (window.count >= this.limit) {
      return Math.ceil((window.startedAt + this.windowMs - now) / 1000);
    }
    window.count += 1;
    return null;
  }

  /** Drops the given keys, e.g. after a successful login. */
  forget(keys: readonly string[]): void {
    for (const key of keys) this.windows.delete(key);
  }

  get size(): number {
    return this.windows.size;
  }

  private sweep(now: number): void {
    if (this.windows.size < this.sweepAt) return;
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) this.windows.delete(key);
    }
    // Keep the sweep amortised: only re-scan once the map has grown again.
    this.sweepAt = Math.max(this.limit * 2, this.windows.size + this.limit);
  }
}
