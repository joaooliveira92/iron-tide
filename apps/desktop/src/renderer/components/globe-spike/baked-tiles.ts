import { BakedTilesError } from "./globe-spike-errors.js";
import { TilePack, TilePackError } from "./tilepack.js";

export const BAKED_PROTOCOL = "bwtiles";
export const BAKED_PACK_FILE = "land.bwtp";
export const BAKED_MANIFEST_FILE = "manifest.json";

export const BAKED_MANIFEST_VERSION = 4;

export interface BakedAreaOutlines {
  readonly datasetVersion: string;
  readonly edgeSemantics: "lonlat-linear";
  readonly sourceSha256: string;
  readonly geometryCount: number;
}

export interface BakedAreaLabels {
  readonly datasetVersion: string;
  readonly sourceSha256: string;
  readonly count: number;
  readonly layer: string;
  readonly stableIdentity: boolean;
  readonly localizedText: string;
  readonly worstUnits: number;
  readonly boundUnits: number;
}

export interface BakedManifest {
  readonly pipelineVersion: string;
  readonly areaOutlines: BakedAreaOutlines;
  readonly areaLabels: BakedAreaLabels;
  readonly zoom: {
    readonly tileMin: number;
    readonly tileMax: number;
    readonly fitForPurposeMax: number;
    readonly overscaleMax: number;
  };
  readonly bounds: readonly [number, number, number, number];
  readonly tileExtent: number;
  readonly layers: {
    readonly land: string;
    readonly protected: string;
    readonly areas: string;
    readonly areaOutlines: string;
    readonly areaLabels: string;
    readonly climate: string;
  };
  readonly packSha256: string;
  readonly packBytes: number;
  readonly attribution: string;
}

export interface BakedDiagnostics {
  requests: number;
  served: number;
  empty: number;
  failures: string[];
  packBytes: number;
  loadMs: number;
  packVerified: boolean | null;
}

export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike>;
export type Digest = (bytes: Uint8Array) => Promise<string>;

export interface BakedTiles {
  readonly pack: TilePack;
  readonly manifest: BakedManifest;
  readonly diagnostics: BakedDiagnostics;
}

export interface TileRequestLike {
  readonly url: string;
}

function member(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function numberAt(value: unknown, key: string): number {
  const found = member(value, key);
  if (typeof found !== "number" || !Number.isFinite(found)) {
    throw new BakedTilesError(`manifest field '${key}' must be a finite number`);
  }
  return found;
}

function stringAt(value: unknown, key: string): string {
  const found = member(value, key);
  if (typeof found !== "string" || found.length === 0) {
    throw new BakedTilesError(`manifest field '${key}' must be a non-empty string`);
  }
  return found;
}

export function parseBakedManifest(value: unknown): BakedManifest {
  const zoom = member(value, "zoom");
  const bounds = member(value, "bounds");
  const layers = member(value, "layers");
  const integrity = member(value, "integrity");
  const sizes = member(value, "sizes");
  const areaOutlines = member(value, "areaOutlines");
  const areaLabels = member(value, "areaLabels");
  if (numberAt(value, "manifestVersion") !== BAKED_MANIFEST_VERSION) {
    throw new BakedTilesError(
      `manifest version ${String(member(value, "manifestVersion"))} is not supported; expected ${BAKED_MANIFEST_VERSION}`,
    );
  }
  if (member(areaOutlines, "edgeSemantics") !== "lonlat-linear") {
    throw new BakedTilesError(
      "manifest area outlines must declare 'lonlat-linear' edge semantics explicitly",
    );
  }
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    !bounds.every((entry) => typeof entry === "number")
  ) {
    throw new BakedTilesError("manifest field 'bounds' must be four numbers");
  }
  const [west, south, east, north] = bounds;
  const manifest: BakedManifest = {
    pipelineVersion: stringAt(value, "pipelineVersion"),
    areaOutlines: {
      datasetVersion: stringAt(areaOutlines, "datasetVersion"),
      edgeSemantics: "lonlat-linear",
      sourceSha256: stringAt(areaOutlines, "sourceSha256"),
      geometryCount: numberAt(member(areaOutlines, "geometryCount"), "areas"),
    },
    areaLabels: {
      datasetVersion: stringAt(areaLabels, "datasetVersion"),
      sourceSha256: stringAt(areaLabels, "sourceSha256"),
      count: numberAt(areaLabels, "count"),
      layer: stringAt(areaLabels, "layer"),
      stableIdentity: member(areaLabels, "stableIdentity") === true,
      localizedText: stringAt(areaLabels, "localizedText"),
      worstUnits: numberAt(member(areaLabels, "validation"), "worstUnits"),
      boundUnits: numberAt(member(areaLabels, "validation"), "boundUnits"),
    },
    zoom: {
      tileMin: numberAt(zoom, "tileMin"),
      tileMax: numberAt(zoom, "tileMax"),
      fitForPurposeMax: numberAt(zoom, "fitForPurposeMax"),
      overscaleMax: numberAt(zoom, "overscaleMax"),
    },
    bounds: [Number(west), Number(south), Number(east), Number(north)],
    tileExtent: numberAt(value, "tileExtent"),
    layers: {
      land: stringAt(layers, "land"),
      protected: stringAt(layers, "protected"),
      areas: stringAt(layers, "areas"),
      areaOutlines: stringAt(layers, "areaOutlines"),
      areaLabels: stringAt(layers, "areaLabels"),
      climate: stringAt(layers, "climate"),
    },
    packSha256: stringAt(integrity, "packSha256"),
    packBytes: numberAt(sizes, "packBytes"),
    attribution: stringAt(value, "attribution"),
  };
  if (manifest.zoom.tileMax < manifest.zoom.tileMin) {
    throw new BakedTilesError("manifest zoom range is inverted");
  }
  if (manifest.areaLabels.count <= 0) {
    throw new BakedTilesError("manifest must declare a positive area label count");
  }
  if (manifest.areaLabels.layer !== manifest.layers.areaLabels) {
    throw new BakedTilesError("manifest area label layer names disagree");
  }
  if (!manifest.areaLabels.stableIdentity) {
    throw new BakedTilesError("manifest area labels must declare stable identity");
  }
  return manifest;
}

export function createDiagnostics(): BakedDiagnostics {
  return {
    requests: 0,
    served: 0,
    empty: 0,
    failures: [],
    packBytes: 0,
    loadMs: 0,
    packVerified: null,
  };
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const subtleDigest: Digest = async (bytes) =>
  hex(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));

async function fetchBytes(fetcher: FetchLike, url: string): Promise<Uint8Array> {
  let response: FetchResponseLike;
  try {
    response = await fetcher(url);
  } catch (error) {
    throw new BakedTilesError(
      `cannot read ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) throw new BakedTilesError(`cannot read ${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadBakedTiles(
  baseUrl: string,
  fetcher: FetchLike,
  digest: Digest,
  now: () => number,
): Promise<BakedTiles> {
  const started = now();
  const diagnostics = createDiagnostics();
  const manifestBytes = await fetchBytes(fetcher, `${baseUrl}${BAKED_MANIFEST_FILE}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new BakedTilesError("manifest is not valid JSON");
  }
  const manifest = parseBakedManifest(parsed);
  const packBytes = await fetchBytes(fetcher, `${baseUrl}${BAKED_PACK_FILE}`);
  diagnostics.packBytes = packBytes.length;
  if (packBytes.length !== manifest.packBytes) {
    throw new BakedTilesError(
      `tile pack is ${packBytes.length} bytes but the manifest records ${manifest.packBytes}`,
    );
  }
  diagnostics.packVerified = (await digest(packBytes)) === manifest.packSha256;
  if (!diagnostics.packVerified) {
    throw new BakedTilesError("tile pack hash does not match the manifest");
  }
  let pack: TilePack;
  try {
    pack = TilePack.parse(packBytes);
  } catch (error) {
    throw new BakedTilesError(
      error instanceof TilePackError ? `tile pack: ${error.message}` : "tile pack is unreadable",
    );
  }
  diagnostics.loadMs = now() - started;
  return { pack, manifest, diagnostics };
}

const TILE_URL = /^bwtiles:\/\/[a-z]+\/(\d+)\/(\d+)\/(\d+)$/;

export function createBakedTileLoader(
  pack: TilePack,
  diagnostics: BakedDiagnostics,
): (params: TileRequestLike) => Promise<{ readonly data: ArrayBuffer }> {
  return async (params) => {
    diagnostics.requests += 1;
    const match = TILE_URL.exec(params.url);
    if (match === null) {
      diagnostics.failures.push(`bad tile url ${params.url}`);
      throw new BakedTilesError(`unrecognised tile url ${params.url}`);
    }
    const [z, x, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const entry = pack.find(z, x, y);
    if (entry === null) {
      diagnostics.empty += 1;
      return { data: new ArrayBuffer(0) };
    }
    try {
      const bytes = pack.read(entry);
      diagnostics.served += 1;
      return { data: bytes.slice().buffer };
    } catch (error) {
      const reason = error instanceof TilePackError ? error.reason : "unreadable";
      diagnostics.failures.push(`${z}/${x}/${y} ${reason}`);
      throw new BakedTilesError(`tile ${z}/${x}/${y} failed integrity check (${reason})`);
    }
  };
}

export function tileUrlTemplate(): string {
  return `${BAKED_PROTOCOL}://land/{z}/{x}/{y}`;
}
