export const TILE_HIERARCHY_VERSION = 1;

export interface TileHierarchy {
  readonly version: typeof TILE_HIERARCHY_VERSION;
  readonly sourceProjection: "EPSG:3857";
  readonly tileExtent: number;
  readonly tileBuffer: number;
  readonly sourceMaxZoom: number;
  readonly fitForPurposeMaxZoom: number;
  readonly overscaleMaxZoom: number;
  readonly displayMaxZoom: number;
  readonly tileMinZoom: number;
  readonly maxCachedTiles: number;
  readonly maxInFlight: number;
  readonly maxVisibleTiles: number;
  readonly cacheVersion: string;
  readonly levels: readonly {
    readonly zoom: number;
    readonly labelMinZoom: number;
    readonly protectedMinZoom: number;
    readonly maxTiles: number;
  }[];
}

export interface TileCoord {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export interface TileSelectionInput {
  readonly centre: readonly [number, number];
  readonly zoom: number;
  readonly pitchDegrees: number;
  readonly bearingDegrees: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly dpr: number;
  readonly mode: "globe" | "mercator";
}

export interface TileSelection {
  readonly level: number;
  readonly overscaled: boolean;
  readonly tiles: readonly TileCoord[];
  readonly cacheKeyPrefix: string;
}

export class TileHierarchyError extends Error {
  readonly _tag = "TileHierarchyError";

  constructor(message: string) {
    super(message);
  }
}

export const NATURAL_EARTH_HIERARCHY: TileHierarchy = {
  version: TILE_HIERARCHY_VERSION,
  sourceProjection: "EPSG:3857",
  tileExtent: 4096,
  tileBuffer: 64,
  sourceMaxZoom: 7,
  fitForPurposeMaxZoom: 7,
  overscaleMaxZoom: 12,
  displayMaxZoom: 22,
  tileMinZoom: 0,
  maxCachedTiles: 512,
  maxInFlight: 8,
  maxVisibleTiles: 256,
  cacheVersion: "natural-earth-10m-v1",
  levels: [
    { zoom: 0, labelMinZoom: 0, protectedMinZoom: 0, maxTiles: 1 },
    { zoom: 1, labelMinZoom: 0, protectedMinZoom: 0, maxTiles: 4 },
    { zoom: 2, labelMinZoom: 0, protectedMinZoom: 0, maxTiles: 16 },
    { zoom: 3, labelMinZoom: 0, protectedMinZoom: 0, maxTiles: 64 },
    { zoom: 4, labelMinZoom: 1, protectedMinZoom: 4, maxTiles: 256 },
    { zoom: 5, labelMinZoom: 2, protectedMinZoom: 4, maxTiles: 1024 },
    { zoom: 6, labelMinZoom: 3, protectedMinZoom: 4, maxTiles: 4096 },
    { zoom: 7, labelMinZoom: 4, protectedMinZoom: 4, maxTiles: 16384 },
  ],
};

function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new TileHierarchyError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return value;
}

export function decodeTileHierarchy(value: unknown): TileHierarchy {
  if (typeof value !== "object" || value === null) {
    throw new TileHierarchyError("tile hierarchy must be an object");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== TILE_HIERARCHY_VERSION) {
    throw new TileHierarchyError(`unsupported tile hierarchy version ${String(record.version)}`);
  }
  if (record.sourceProjection !== "EPSG:3857") {
    throw new TileHierarchyError("tile hierarchy source projection must be EPSG:3857");
  }
  const sourceMaxZoom = integer(record.sourceMaxZoom, "sourceMaxZoom", 0, 12);
  const fitForPurposeMaxZoom = integer(record.fitForPurposeMaxZoom, "fitForPurposeMaxZoom", 0, 12);
  if (fitForPurposeMaxZoom > sourceMaxZoom) {
    throw new TileHierarchyError("fitForPurposeMaxZoom cannot exceed sourceMaxZoom");
  }
  const overscaleMaxZoom = integer(record.overscaleMaxZoom, "overscaleMaxZoom", 0, 22);
  if (overscaleMaxZoom < sourceMaxZoom) {
    throw new TileHierarchyError("overscaleMaxZoom cannot be below sourceMaxZoom");
  }
  const levels = record.levels;
  if (!Array.isArray(levels) || levels.length !== sourceMaxZoom + 1) {
    throw new TileHierarchyError("tile hierarchy must declare one level per source zoom");
  }
  const decodedLevels = levels.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new TileHierarchyError(`level ${index} must be an object`);
    }
    const level = entry as Record<string, unknown>;
    return {
      zoom: integer(level.zoom, `level ${index}.zoom`, 0, 12),
      labelMinZoom: integer(level.labelMinZoom, `level ${index}.labelMinZoom`, 0, 22),
      protectedMinZoom: integer(level.protectedMinZoom, `level ${index}.protectedMinZoom`, 0, 22),
      maxTiles: integer(level.maxTiles, `level ${index}.maxTiles`, 1, 1 << 24),
    };
  });
  decodedLevels.forEach((level, index) => {
    if (level.zoom !== index)
      throw new TileHierarchyError("tile levels must be contiguous from z0");
  });
  return {
    version: TILE_HIERARCHY_VERSION,
    sourceProjection: "EPSG:3857",
    tileExtent: integer(record.tileExtent, "tileExtent", 256, 8192),
    tileBuffer: integer(record.tileBuffer, "tileBuffer", 0, 512),
    sourceMaxZoom,
    fitForPurposeMaxZoom,
    overscaleMaxZoom,
    displayMaxZoom: integer(record.displayMaxZoom, "displayMaxZoom", sourceMaxZoom, 22),
    tileMinZoom: integer(record.tileMinZoom, "tileMinZoom", 0, sourceMaxZoom),
    maxCachedTiles: integer(record.maxCachedTiles, "maxCachedTiles", 1, 100_000),
    maxInFlight: integer(record.maxInFlight, "maxInFlight", 1, 1024),
    maxVisibleTiles: integer(record.maxVisibleTiles, "maxVisibleTiles", 1, 100_000),
    cacheVersion:
      typeof record.cacheVersion === "string" && record.cacheVersion.length > 0
        ? record.cacheVersion
        : (() => {
            throw new TileHierarchyError("cacheVersion must be a non-empty string");
          })(),
    levels: decodedLevels,
  };
}

export interface HierarchyManifestView {
  readonly zoom: {
    readonly tileMin: number;
    readonly tileMax: number;
    readonly fitForPurposeMax: number;
    readonly overscaleMax: number;
  };
  readonly tileExtent: number;
  readonly packSha256: string;
}

export function hierarchyForManifest(
  base: TileHierarchy,
  manifest: HierarchyManifestView,
): TileHierarchy {
  if (manifest.zoom.tileMin !== base.tileMinZoom) {
    throw new TileHierarchyError("manifest tileMinZoom does not match the hierarchy");
  }
  if (manifest.zoom.tileMax !== base.sourceMaxZoom) {
    throw new TileHierarchyError("manifest tileMaxZoom does not match the hierarchy");
  }
  if (manifest.zoom.fitForPurposeMax !== base.fitForPurposeMaxZoom) {
    throw new TileHierarchyError("manifest fitForPurposeMaxZoom does not match the hierarchy");
  }
  if (manifest.zoom.overscaleMax !== base.overscaleMaxZoom) {
    throw new TileHierarchyError("manifest overscaleMaxZoom does not match the hierarchy");
  }
  if (manifest.tileExtent !== base.tileExtent) {
    throw new TileHierarchyError("manifest tileExtent does not match the hierarchy");
  }
  if (typeof manifest.packSha256 !== "string" || manifest.packSha256.length < 12) {
    throw new TileHierarchyError("manifest packSha256 is too short for cache invalidation");
  }
  return {
    ...base,
    cacheVersion: `${base.cacheVersion}:${manifest.packSha256.slice(0, 12)}`,
  };
}

export function clampZoom(zoom: number, hierarchy: TileHierarchy): number {
  return Math.max(0, Math.min(hierarchy.displayMaxZoom, zoom));
}

export function sourceLevelForDisplay(zoom: number, hierarchy: TileHierarchy): number {
  return Math.max(hierarchy.tileMinZoom, Math.min(hierarchy.sourceMaxZoom, Math.floor(zoom)));
}

export function isOverscaled(zoom: number, hierarchy: TileHierarchy): boolean {
  return zoom > hierarchy.fitForPurposeMaxZoom;
}

export function tileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function tileCacheKey(tile: TileCoord, hierarchy: TileHierarchy): string {
  return `${hierarchy.cacheVersion}:${tileKey(tile)}`;
}

function wrapX(x: number, span: number): number {
  return ((x % span) + span) % span;
}

function clampY(y: number, span: number): number {
  return Math.max(0, Math.min(span - 1, y));
}

function lonToTileX(lon: number, span: number): number {
  return Math.floor(((lon + 180) / 360) * span);
}

function latToTileY(lat: number, span: number): number {
  const clamped = Math.max(-85.0511287798066, Math.min(85.0511287798066, lat));
  const radians = (clamped * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return Math.floor(((1 - mercator / Math.PI) / 2) * span);
}

export function selectTiles(
  input: TileSelectionInput,
  hierarchy: TileHierarchy = NATURAL_EARTH_HIERARCHY,
): TileSelection {
  const zoom = clampZoom(input.zoom, hierarchy);
  const level = sourceLevelForDisplay(zoom, hierarchy);
  const span = 2 ** level;
  const worldPixels = 512 * 2 ** zoom;
  const degreesPerPixel = 360 / worldPixels;
  const pitchFactor = 1 + Math.min(1.5, Math.abs(input.pitchDegrees) / 60);
  const dprFactor = Math.max(1, Math.min(2, input.dpr));
  const halfWidth = (input.viewport.width * degreesPerPixel * pitchFactor * dprFactor) / 2;
  const halfHeight = (input.viewport.height * degreesPerPixel * pitchFactor * dprFactor) / 2;
  const [centreLon, centreLat] = input.centre;
  const west = centreLon - halfWidth;
  const east = centreLon + halfWidth;
  const south = centreLat - halfHeight;
  const north = centreLat + halfHeight;
  const tiles: TileCoord[] = [];
  if (input.mode === "globe" && zoom < 2) {
    for (let x = 0; x < span; x++) {
      for (let y = 0; y < span; y++) tiles.push({ z: level, x, y });
    }
    return {
      level,
      overscaled: isOverscaled(zoom, hierarchy),
      tiles: tiles.slice(0, hierarchy.maxVisibleTiles),
      cacheKeyPrefix: `${hierarchy.cacheVersion}:`,
    };
  }
  const westX = lonToTileX(west, span);
  const eastX = lonToTileX(east, span);
  const northY = latToTileY(north, span);
  const southY = latToTileY(south, span);
  const y0 = clampY(northY, span);
  const y1 = clampY(southY, span);
  const xCount = eastX - westX;
  if (xCount >= span) {
    for (let y = y0; y <= y1; y++) for (let x = 0; x < span; x++) tiles.push({ z: level, x, y });
  } else {
    for (let y = y0; y <= y1; y++) {
      for (let x = westX; x <= eastX; x++) {
        tiles.push({ z: level, x: wrapX(x, span), y });
      }
    }
  }
  const centreX = lonToTileX(centreLon, span);
  const centreY = latToTileY(centreLat, span);
  const unique = new Map<string, TileCoord>();
  for (const tile of tiles) unique.set(tileKey(tile), tile);
  const ordered = [...unique.values()].sort((left, right) => {
    const distance =
      Math.abs(left.x - centreX) +
      Math.abs(left.y - centreY) -
      (Math.abs(right.x - centreX) + Math.abs(right.y - centreY));
    if (distance !== 0) return distance;
    return tileKey(left) < tileKey(right) ? -1 : tileKey(left) > tileKey(right) ? 1 : 0;
  });
  return {
    level,
    overscaled: isOverscaled(zoom, hierarchy),
    tiles: ordered.slice(0, hierarchy.maxVisibleTiles),
    cacheKeyPrefix: `${hierarchy.cacheVersion}:`,
  };
}

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
