import {
  NATURAL_EARTH_HIERARCHY,
  type TileCoord,
  type TileHierarchy,
  type TileSelection,
  type TileSelectionInput,
} from "./tile-hierarchy.js";

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
