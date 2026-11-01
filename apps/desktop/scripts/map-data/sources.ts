import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { read as readShapefile } from "shapefile";

import { MapDataError, MapDataIntegrityError } from "./errors.ts";
import type { Position } from "./geodesy.ts";
import { readZip } from "./zip.ts";

export interface SourcePin {
  readonly id: string;
  readonly layer: string;
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface SourcePins {
  readonly dataset: string;
  readonly sources: readonly SourcePin[];
}

export interface LoadedLayer {
  readonly pin: SourcePin;
  readonly polygons: readonly (readonly (readonly Position[])[])[];
  readonly lines: readonly {
    readonly name: string;
    readonly parts: readonly (readonly Position[])[];
  }[];
  readonly depthMetres: number | null;
  readonly licenceFiles: ReadonlyMap<string, Uint8Array>;
  readonly extractedBytes: number;
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseSourcePins(value: unknown): SourcePins {
  const record = value as { dataset?: unknown; sources?: unknown };
  if (typeof record.dataset !== "string" || !Array.isArray(record.sources)) {
    throw new MapDataError("sources: malformed pin file");
  }
  const sources = (record.sources as Record<string, unknown>[]).map((entry): SourcePin => {
    const { id, layer, version, url, sha256, bytes } = entry;
    if (
      typeof id !== "string" ||
      typeof layer !== "string" ||
      typeof version !== "string" ||
      typeof url !== "string" ||
      typeof sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(sha256) ||
      typeof bytes !== "number"
    ) {
      throw new MapDataError(`sources: malformed pin '${String(id)}'`);
    }
    if (!url.startsWith("https://")) throw new MapDataError(`sources: '${id}' url must be https`);
    return { id, layer, version, url, sha256, bytes };
  });
  return { dataset: record.dataset, sources };
}

export async function fetchSources(pins: SourcePins, cacheDir: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  for (const pin of pins.sources) {
    const target = join(cacheDir, `${pin.id}.zip`);
    const existing = await readFile(target).catch(() => null);
    if (existing !== null && sha256Hex(existing) === pin.sha256) continue;
    const response = await fetch(pin.url);
    if (!response.ok) throw new MapDataError(`fetch ${pin.url}: HTTP ${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (sha256Hex(body) !== pin.sha256 || body.length !== pin.bytes) {
      throw new MapDataIntegrityError(
        `fetch ${pin.url}: archive does not match the pinned hash ${pin.sha256}`,
      );
    }
    await writeFile(target, body);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toRing(coordinates: readonly (readonly number[])[]): readonly Position[] {
  return coordinates.map((point): Position => [point[0] ?? 0, point[1] ?? 0]);
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replaceAll("\u0000", "").trim() : "";
}

export async function loadLayer(pin: SourcePin, cacheDir: string): Promise<LoadedLayer> {
  const archive = new Uint8Array(await readFile(join(cacheDir, `${pin.id}.zip`)));
  if (archive.length !== pin.bytes || sha256Hex(archive) !== pin.sha256) {
    throw new MapDataIntegrityError(
      `${pin.id}: archive hash does not match the pin (expected ${pin.sha256})`,
    );
  }
  const files = readZip(archive);
  const shp = files.get(`${pin.layer}.shp`);
  const dbf = files.get(`${pin.layer}.dbf`);
  if (shp === undefined || dbf === undefined) {
    throw new MapDataError(`${pin.id}: archive lacks ${pin.layer}.shp or .dbf`);
  }
  const collection = await readShapefile(toArrayBuffer(shp), toArrayBuffer(dbf));
  const polygons: (readonly (readonly Position[])[])[] = [];
  const lines: { name: string; parts: (readonly Position[])[] }[] = [];
  const depths = new Set<number>();
  for (const feature of collection.features) {
    const depth = feature.properties?.depth;
    if (typeof depth === "number") depths.add(depth);
    const geometry = feature.geometry;
    if (geometry.type === "Polygon") polygons.push(geometry.coordinates.map(toRing));
    else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) polygons.push(polygon.map(toRing));
    } else if (geometry.type === "LineString") {
      lines.push({
        name: cleanName(feature.properties?.name),
        parts: [toRing(geometry.coordinates)],
      });
    } else if (geometry.type === "MultiLineString") {
      lines.push({
        name: cleanName(feature.properties?.name),
        parts: geometry.coordinates.map(toRing),
      });
    }
  }
  const licenceFiles = new Map<string, Uint8Array>();
  for (const [name, data] of files) {
    if (name.endsWith(".README.html") || name.endsWith(".VERSION.txt"))
      licenceFiles.set(name, data);
  }
  let extractedBytes = 0;
  for (const data of files.values()) extractedBytes += data.length;
  if (depths.size > 1) {
    throw new MapDataError(`${pin.id}: mixed depth values ${[...depths].join(", ")}`);
  }
  const depthMetres = depths.size === 1 ? ([...depths][0] ?? null) : null;
  return { pin, polygons, lines, depthMetres, licenceFiles, extractedBytes };
}
