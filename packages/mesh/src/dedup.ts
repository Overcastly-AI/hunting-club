/**
 * Remembers keys seen recently so repeated packets can be dropped.
 *
 * Used twice by MeshClient:
 * - mesh level, keyed by `(from, packet id)`: drops relay rebroadcasts and
 *   packets the radio replays after a reconnect;
 * - app level, keyed by `(sender, message id)`: drops app-port messages
 *   that were re-sent under a new packet id (for example Ask for a Hand
 *   retries).
 *
 * Entries expire after `ttlMs`; at most `maxEntries` are kept (oldest
 * evicted first).
 */
export class DedupCache {
  private readonly seen = new Map<string, number>();

  constructor(private readonly opts: { ttlMs: number; maxEntries: number; now?: () => number }) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  /** Returns true the first time a key is seen (within the TTL), false for repeats. */
  checkAndAdd(key: string): boolean {
    const now = this.now();
    const at = this.seen.get(key);
    if (at !== undefined && now - at < this.opts.ttlMs) {
      return false;
    }
    // Re-insert so Map order stays oldest-first.
    this.seen.delete(key);
    this.seen.set(key, now);
    this.prune(now);
    return true;
  }

  has(key: string): boolean {
    const at = this.seen.get(key);
    return at !== undefined && this.now() - at < this.opts.ttlMs;
  }

  get size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
  }

  private prune(now: number): void {
    for (const [key, at] of this.seen) {
      if (this.seen.size <= this.opts.maxEntries && now - at < this.opts.ttlMs) break;
      this.seen.delete(key);
    }
  }
}

export const packetKey = (from: number, id: number): string => `${from >>> 0}:${id >>> 0}`;
