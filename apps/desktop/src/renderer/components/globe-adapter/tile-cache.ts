import { TileHierarchyError, type TileHierarchy } from "./tile-hierarchy.js";

export interface TileCacheStats {
  readonly entries: number;
  readonly bytes: number;
  readonly inFlight: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly version: string;
}

export class TileCache {
  private readonly entries = new Map<string, { readonly bytes: number; used: number }>();
  private readonly inFlight = new Set<string>();
  private readonly cacheVersion: string;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private clock = 0;
  private disposed = false;

  constructor(private readonly hierarchy: TileHierarchy) {
    this.cacheVersion = hierarchy.cacheVersion;
  }

  begin(key: string): boolean {
    this.assertOpen();
    if (this.entries.has(key)) return true;
    if (this.inFlight.size >= this.hierarchy.maxInFlight) return false;
    this.inFlight.add(key);
    return true;
  }

  complete(key: string, bytes: number): void {
    this.assertOpen();
    this.inFlight.delete(key);
    if (bytes <= 0) {
      this.missCount += 1;
      return;
    }
    this.entries.set(key, { bytes, used: ++this.clock });
    while (this.entries.size > this.hierarchy.maxCachedTiles) {
      let oldestKey: string | null = null;
      let oldest = Infinity;
      for (const [candidate, entry] of this.entries) {
        if (entry.used < oldest) {
          oldest = entry.used;
          oldestKey = candidate;
        }
      }
      if (oldestKey === null) break;
      this.entries.delete(oldestKey);
      this.evictionCount += 1;
    }
  }

  get(key: string): number | null {
    this.assertOpen();
    const entry = this.entries.get(key);
    if (entry === undefined) {
      this.missCount += 1;
      return null;
    }
    this.hitCount += 1;
    entry.used = ++this.clock;
    return entry.bytes;
  }

  fail(key: string): void {
    this.inFlight.delete(key);
  }

  invalidate(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  stats(): TileCacheStats {
    return {
      entries: this.entries.size,
      bytes: [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0),
      inFlight: this.inFlight.size,
      hits: this.hitCount,
      misses: this.missCount,
      evictions: this.evictionCount,
      version: this.cacheVersion,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.invalidate();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  private assertOpen(): void {
    if (this.disposed) throw new TileHierarchyError("tile cache is disposed");
  }
}
