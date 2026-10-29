import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { MapDataError, MapDataIntegrityError } from "./errors.ts";
import type { Position } from "./geodesy.ts";
import { sha256Hex } from "./sources.ts";

export const CLIMATE_BINARY_FILE = "climate-zones.v1.bin";
export const CLIMATE_PROVENANCE_FILE = "climate-zones.v1.json";

const MAGIC = 0x5a435742;
const SCALE = 100;

export interface ClimateZoneGeometry {
  readonly zone: number;
  readonly polygons: readonly (readonly (readonly Position[])[])[];
}

export interface ClimateProvenance {
  readonly schemaVersion: 1;
  readonly binarySha256: string;
  readonly binaryBytes: number;
  readonly source: Readonly<Record<string, string>>;
  readonly method: Readonly<Record<string, string | number>>;
  readonly zones: readonly {
    readonly id: number;
    readonly name: string;
    readonly koppen: readonly number[];
  }[];
}

export interface ClimateData {
  readonly provenance: ClimateProvenance;
  readonly provenanceRaw: unknown;
  readonly geometry: readonly ClimateZoneGeometry[];
}

class ByteWriter {
  private readonly bytes: number[] = [];

  uint(value: number): void {
    let rest = value;
    while (rest >= 0x80) {
      this.bytes.push((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    this.bytes.push(rest);
  }

  int(value: number): void {
    this.uint(value >= 0 ? value * 2 : -value * 2 - 1);
  }

  raw(value: number): void {
    this.bytes.push(value);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class ByteReader {
  private offset = 0;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  raw(): number {
    const value = this.bytes[this.offset];
    if (value === undefined) throw new MapDataError("climate data: truncated");
    this.offset += 1;
    return value;
  }

  uint(): number {
    let result = 0;
    let factor = 1;
    for (;;) {
      const byte = this.raw();
      result += (byte & 0x7f) * factor;
      if ((byte & 0x80) === 0) return result;
      factor *= 128;
    }
  }

  int(): number {
    const value = this.uint();
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }
}

export function encodeClimate(geometry: readonly ClimateZoneGeometry[]): Uint8Array {
  const writer = new ByteWriter();
  for (let shift = 0; shift < 32; shift += 8) writer.raw((MAGIC >>> shift) & 0xff);
  writer.uint(geometry.length);
  for (const zone of geometry) {
    writer.uint(zone.zone);
    writer.uint(zone.polygons.length);
    for (const polygon of zone.polygons) {
      writer.uint(polygon.length);
      for (const ring of polygon) {
        writer.uint(ring.length);
        let x = 0;
        let y = 0;
        for (const point of ring) {
          const nextX = Math.round(point[0] * SCALE);
          const nextY = Math.round(point[1] * SCALE);
          writer.int(nextX - x);
          writer.int(nextY - y);
          x = nextX;
          y = nextY;
        }
      }
    }
  }
  return writer.finish();
}

export function decodeClimate(bytes: Uint8Array): readonly ClimateZoneGeometry[] {
  const reader = new ByteReader(bytes);
  let magic = 0;
  for (let shift = 0; shift < 32; shift += 8) magic += reader.raw() * 2 ** shift;
  if (magic !== MAGIC) throw new MapDataError("climate data: bad header");
  const zones: ClimateZoneGeometry[] = [];
  const zoneCount = reader.uint();
  for (let z = 0; z < zoneCount; z++) {
    const zone = reader.uint();
    const polygonCount = reader.uint();
    const polygons: Position[][][] = [];
    for (let p = 0; p < polygonCount; p++) {
      const ringCount = reader.uint();
      const rings: Position[][] = [];
      for (let r = 0; r < ringCount; r++) {
        const pointCount = reader.uint();
        const ring: Position[] = [];
        let x = 0;
        let y = 0;
        for (let i = 0; i < pointCount; i++) {
          x += reader.int();
          y += reader.int();
          ring.push([x / SCALE, y / SCALE]);
        }
        rings.push(ring);
      }
      polygons.push(rings);
    }
    zones.push({ zone, polygons });
  }
  return zones;
}

export async function loadClimate(mapDataDir: string): Promise<ClimateData> {
  const provenanceRaw: unknown = JSON.parse(
    await readFile(join(mapDataDir, CLIMATE_PROVENANCE_FILE), "utf8"),
  );
  const provenance = provenanceRaw as ClimateProvenance;
  const bytes = new Uint8Array(await readFile(join(mapDataDir, CLIMATE_BINARY_FILE)));
  if (provenance.schemaVersion !== 1 || !/^[0-9a-f]{64}$/.test(provenance.binarySha256)) {
    throw new MapDataError("climate data: malformed provenance");
  }
  if (bytes.length !== provenance.binaryBytes || sha256Hex(bytes) !== provenance.binarySha256) {
    throw new MapDataIntegrityError(
      `climate data: ${CLIMATE_BINARY_FILE} does not match the provenance hash ${provenance.binarySha256}`,
    );
  }
  return { provenance, provenanceRaw, geometry: decodeClimate(bytes) };
}
