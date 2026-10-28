import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";

import type { Position } from "./geodesy.ts";

export interface DecodedFeature {
  readonly id: number | undefined;
  readonly type: number;
  readonly properties: Readonly<Record<string, string | number | boolean>>;
  readonly rings: readonly (readonly (readonly [number, number])[])[];
}

export interface DecodedTile {
  readonly extent: number;
  readonly layers: ReadonlyMap<string, readonly DecodedFeature[]>;
}

export function decodeTile(bytes: Uint8Array): DecodedTile {
  const tile = new VectorTile(new Protobuf(bytes));
  const layers = new Map<string, readonly DecodedFeature[]>();
  let extent = 4096;
  for (const name of Object.keys(tile.layers).sort()) {
    const layer = tile.layers[name];
    if (layer === undefined) continue;
    extent = layer.extent;
    const features: DecodedFeature[] = [];
    for (let index = 0; index < layer.length; index++) {
      const feature = layer.feature(index);
      features.push({
        id: feature.id,
        type: feature.type,
        properties: feature.properties as Record<string, string | number | boolean>,
        rings: feature
          .loadGeometry()
          .map((ring) => ring.map((point) => [point.x, point.y] as const)),
      });
    }
    layers.set(name, features);
  }
  return { extent, layers };
}

export function tileToLonLat(
  z: number,
  x: number,
  y: number,
  local: readonly [number, number],
  extent: number,
): Position {
  const scale = 2 ** z;
  const worldX = (x + local[0] / extent) / scale;
  const worldY = (y + local[1] / extent) / scale;
  const lon = worldX * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180) / Math.PI;
  return [lon, lat];
}

export function lonLatToTileLocal(
  z: number,
  position: Position,
  extent: number,
): { readonly x: number; readonly y: number; readonly local: readonly [number, number] } {
  const scale = 2 ** z;
  const sine = Math.sin((position[1] * Math.PI) / 180);
  const worldX = (position[0] + 180) / 360;
  const worldY = 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
  const x = Math.min(scale - 1, Math.max(0, Math.floor(worldX * scale)));
  const y = Math.min(scale - 1, Math.max(0, Math.floor(worldY * scale)));
  return { x, y, local: [(worldX * scale - x) * extent, (worldY * scale - y) * extent] };
}
