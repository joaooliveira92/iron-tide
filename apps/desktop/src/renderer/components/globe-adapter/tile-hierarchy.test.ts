import { describe, expect, it } from "vite-plus/test";

import {
  NATURAL_EARTH_HIERARCHY,
  TileCache,
  TileHierarchyError,
  decodeTileHierarchy,
  hierarchyForManifest,
  isOverscaled,
  selectTiles,
  sourceLevelForDisplay,
  tileCacheKey,
  tileKey,
} from "./tile-hierarchy.js";

const BASE = {
  centre: [10, 30] as const,
  zoom: 4,
  pitchDegrees: 0,
  bearingDegrees: 0,
  viewport: { width: 1470, height: 868 },
  dpr: 2,
  mode: "globe" as const,
};

describe("tile hierarchy policy", () => {
  it("decodes the shipped hierarchy and rejects a mismatched source ceiling", () => {
    expect(decodeTileHierarchy(NATURAL_EARTH_HIERARCHY)).toEqual(NATURAL_EARTH_HIERARCHY);
    expect(() =>
      decodeTileHierarchy({ ...NATURAL_EARTH_HIERARCHY, fitForPurposeMaxZoom: 8 }),
    ).toThrow(TileHierarchyError);
    expect(() => decodeTileHierarchy({ ...NATURAL_EARTH_HIERARCHY, version: 2 })).toThrow(
      "unsupported tile hierarchy version",
    );
  });

  it("keeps the honest Natural Earth ceiling explicit", () => {
    expect(sourceLevelForDisplay(0.5, NATURAL_EARTH_HIERARCHY)).toBe(0);
    expect(sourceLevelForDisplay(7, NATURAL_EARTH_HIERARCHY)).toBe(7);
    expect(sourceLevelForDisplay(12.5, NATURAL_EARTH_HIERARCHY)).toBe(7);
    expect(isOverscaled(7.1, NATURAL_EARTH_HIERARCHY)).toBe(true);
    expect(isOverscaled(7, NATURAL_EARTH_HIERARCHY)).toBe(false);
  });

  it("selects tiles deterministically for a fixed camera and viewport", () => {
    const first = selectTiles(BASE);
    const second = selectTiles(BASE);
    expect(first).toEqual(second);
    expect(first.tiles.length).toBeGreaterThan(0);
    expect(new Set(first.tiles.map(tileKey)).size).toBe(first.tiles.length);
    expect(first.tiles.every((tile) => tile.z === first.level)).toBe(true);
  });

  it("wraps across the antimeridian without duplicate or out-of-range tiles", () => {
    const selection = selectTiles({
      ...BASE,
      centre: [179.5, 10],
      zoom: 4,
      viewport: { width: 900, height: 700 },
    });
    const keys = selection.tiles.map(tileKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(selection.tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(selection.tiles.some((tile) => tile.x === 2 ** selection.level - 1)).toBe(true);
    expect(selection.tiles.every((tile) => tile.x >= 0 && tile.x < 2 ** tile.z)).toBe(true);
  });

  it("clamps high-latitude rows to the tile pyramid", () => {
    const north = selectTiles({ ...BASE, centre: [20, 84], zoom: 6 });
    const south = selectTiles({ ...BASE, centre: [20, -84], zoom: 6 });
    expect(north.tiles.every((tile) => tile.y >= 0)).toBe(true);
    expect(south.tiles.every((tile) => tile.y <= 2 ** tile.z - 1)).toBe(true);
  });

  it("uses the whole world below globe zoom two", () => {
    const selection = selectTiles({ ...BASE, zoom: 1, mode: "globe" });
    expect(selection.tiles).toHaveLength(4);
    expect(selection.tiles.map(tileKey)).toEqual(["1/0/0", "1/0/1", "1/1/0", "1/1/1"].sort());
  });

  it("produces a versioned cache key", () => {
    const tile = { z: 4, x: 8, y: 7 };
    expect(tileCacheKey(tile, NATURAL_EARTH_HIERARCHY)).toBe("natural-earth-10m-v1:4/8/7");
  });

  it("derives the cache version from the pack hash and rejects a mismatched pack", () => {
    const manifest = {
      zoom: { tileMin: 0, tileMax: 7, fitForPurposeMax: 7, overscaleMax: 12 },
      tileExtent: 4096,
      packSha256: "2b7b264e928124d314c577b9bb112c1e79b9db8c85329030eeae931e12952b16",
    };
    const hierarchy = hierarchyForManifest(NATURAL_EARTH_HIERARCHY, manifest);
    expect(hierarchy.cacheVersion).toBe("natural-earth-10m-v1:2b7b264e9281");
    expect(() =>
      hierarchyForManifest(NATURAL_EARTH_HIERARCHY, {
        ...manifest,
        zoom: { ...manifest.zoom, tileMax: 8 },
      }),
    ).toThrow("tileMaxZoom");
  });
});

describe("tile cache budgets", () => {
  it("enforces the in-flight limit and records misses", () => {
    const cache = new TileCache({ ...NATURAL_EARTH_HIERARCHY, maxInFlight: 2 });
    expect(cache.begin("a")).toBe(true);
    expect(cache.begin("b")).toBe(true);
    expect(cache.begin("c")).toBe(false);
    cache.fail("a");
    expect(cache.begin("c")).toBe(true);
    expect(cache.stats().inFlight).toBe(2);
  });

  it("evicts the least recently used entry at the entry budget", () => {
    const cache = new TileCache({ ...NATURAL_EARTH_HIERARCHY, maxCachedTiles: 2 });
    cache.begin("a");
    cache.complete("a", 10);
    cache.begin("b");
    cache.complete("b", 20);
    cache.get("a");
    cache.begin("c");
    cache.complete("c", 30);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(10);
    expect(cache.get("c")).toBe(30);
    expect(cache.stats().evictions).toBe(1);
  });

  it("invalidates every entry when the cache version changes", () => {
    const cache = new TileCache(NATURAL_EARTH_HIERARCHY);
    cache.begin("a");
    cache.complete("a", 10);
    cache.invalidate();
    expect(cache.stats().entries).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("rejects use after disposal", () => {
    const cache = new TileCache(NATURAL_EARTH_HIERARCHY);
    cache.dispose();
    expect(() => cache.begin("a")).toThrow("disposed");
  });
});
