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
