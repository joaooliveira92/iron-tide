/**
 * Compact binary format for the baked coastline (ADR-0055). Little-endian:
 *   u32 magic "BWCL", u32 polygonCount
 *   per polygon: u16 ringCount, then per ring: u32 pointCount, i16[2*n] (lon, lat)
 * Coordinates are stored in hundredths of a degree — the bake already quantises
 * to 0.01°, so the round trip is lossless. Replaces a 6 MB TypeScript literal.
 */

import type { FlatPolygon } from "./simplify-geometry.js";

const MAGIC = 0x4c435742; // "BWCL"
const SCALE = 100;

export function encodeCoastline(polygons: readonly FlatPolygon[]): Uint8Array {
  let bytes = 8;
  for (const rings of polygons) {
    bytes += 2;
    for (const ring of rings) bytes += 4 + ring.length * 2;
  }
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  let offset = 0;
  view.setUint32(offset, MAGIC, true);
  view.setUint32((offset += 4), polygons.length, true);
  offset += 4;
  for (const rings of polygons) {
    view.setUint16(offset, rings.length, true);
    offset += 2;
    for (const ring of rings) {
      view.setUint32(offset, ring.length / 2, true);
      offset += 4;
      for (const value of ring) {
        view.setInt16(offset, Math.round(value * SCALE), true);
        offset += 2;
      }
    }
  }
  return out;
}

export function decodeCoastline(buffer: ArrayBuffer): number[][][] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0, true) !== MAGIC) {
    throw new Error("Invalid coastline data: bad header");
  }
  const polygonCount = view.getUint32(4, true);
  let offset = 8;
  const polygons: number[][][] = [];
  for (let p = 0; p < polygonCount; p++) {
    const ringCount = view.getUint16(offset, true);
    offset += 2;
    const rings: number[][] = [];
    for (let r = 0; r < ringCount; r++) {
      const pointCount = view.getUint32(offset, true);
      offset += 4;
      const ring: number[] = [];
      for (let i = 0; i < pointCount * 2; i++) {
        ring.push(view.getInt16(offset, true) / SCALE);
        offset += 2;
      }
      rings.push(ring);
    }
    polygons.push(rings);
  }
  return polygons;
}
