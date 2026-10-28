import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  canonicalAreaHash,
  decodeAreaSpec,
  prepareAreas,
  validateAreaSource,
  type AreaOutlineSpec,
  type AreaSource,
} from "./areas.ts";
import {
  bakeTiles,
  configurationHash,
  type BakeOptions,
  type BakeOutput,
  type GeometryInput,
  type Resolution,
} from "./bake.ts";
import { decodeCatalogue, type ProtectedCatalogue } from "./catalogue.ts";
import { canonicalJson, parsePipelineConfig, type PipelineConfig } from "./config.ts";
import { MapDataError, MapDataIntegrityError } from "./errors.ts";
import {
  loadLayer,
  parseSourcePins,
  sha256Hex,
  type LoadedLayer,
  type SourcePins,
} from "./sources.ts";
import { validateAreaOutlines } from "./area-validate.ts";
import { validateProtectedFeatures, type ValidationReport } from "./validate.ts";
import { TilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";
import { AREAS } from "../../src/renderer/components/world-map/map-geometry.ts";

export const PACK_FILE = "land.bwtp";
export const MANIFEST_FILE = "manifest.json";
export const RESOLUTION_FILE = "protected-resolution.json";
export const VALIDATION_FILE = "validation.json";

export interface Inputs {
  readonly config: PipelineConfig;
  readonly catalogue: ProtectedCatalogue;
  readonly pins: SourcePins;
  readonly pinsRaw: unknown;
  readonly areaSpec: AreaOutlineSpec;
  readonly areaSources: readonly AreaSource[];
}

export function areaTextHash(text: string): string {
  return sha256Hex(new TextEncoder().encode(text));
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadInputs(mapDataDir: string): Promise<Inputs> {
  const config = parsePipelineConfig(await readJson(join(mapDataDir, "pipeline.config.v1.json")));
  const catalogue = decodeCatalogue(await readJson(join(mapDataDir, "protected-features.v1.json")));
  const pinsRaw = await readJson(join(mapDataDir, "sources.v1.json"));
  const areaSpec = decodeAreaSpec(await readJson(join(mapDataDir, "area-outlines.v1.json")));
  const areaSources = AREAS.map((area): AreaSource => ({
    id: area.id,
    name: area.short,
    ring: area.ring as AreaSource["ring"],
  }));
  validateAreaSource(areaSources, areaSpec, areaTextHash);
  return { config, catalogue, pins: parseSourcePins(pinsRaw), pinsRaw, areaSpec, areaSources };
}

export async function loadGeometry(
  inputs: Inputs,
  cacheDir: string,
): Promise<{ readonly geometry: GeometryInput; readonly layers: readonly LoadedLayer[] }> {
  const layers: LoadedLayer[] = [];
  for (const pin of inputs.pins.sources) layers.push(await loadLayer(pin, cacheDir));
  const byId = new Map(layers.map((layer) => [layer.pin.id, layer]));
  const land = byId.get("ne_10m_land");
  const islands = byId.get("ne_10m_minor_islands");
  const rivers = byId.get("ne_10m_rivers_lake_centerlines");
  if (land === undefined || islands === undefined || rivers === undefined) {
    throw new MapDataError("sources: land, minor islands and rivers layers are all required");
  }
  return {
    geometry: {
      landPolygons: [...land.polygons, ...islands.polygons],
      riverLines: rivers.lines,
      areas: prepareAreas(inputs.areaSources, inputs.areaSpec),
    },
    layers,
  };
}

export interface BuiltFiles {
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly manifest: Record<string, unknown>;
  readonly report: ValidationReport;
  readonly output: BakeOutput;
}

function text(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

async function lockfileSha(repoRoot: string): Promise<string> {
  return sha256Hex(new Uint8Array(await readFile(join(repoRoot, "pnpm-lock.yaml"))));
}

async function packageVersion(repoRoot: string, name: string): Promise<string> {
  const raw = await readFile(
    join(repoRoot, "apps", "desktop", "node_modules", name, "package.json"),
    "utf8",
  );
  return (JSON.parse(raw) as { version: string }).version;
}

export async function buildAll(
  inputs: Inputs,
  geometry: GeometryInput,
  layers: readonly LoadedLayer[],
  repoRoot: string,
  options: BakeOptions = { pinning: true },
): Promise<BuiltFiles> {
  const output = bakeTiles(inputs.catalogue, geometry, inputs.config, sha256Hex, options);
  const pack = TilePack.parse(output.pack);
  const report = validateProtectedFeatures(
    pack,
    inputs.catalogue,
    output.resolution,
    inputs.config,
  );
  const areaReport = validateAreaOutlines(pack, geometry.areas, inputs.config);
  const combined: ValidationReport & { readonly areaOutlines: typeof areaReport } = {
    ...report,
    passed: report.passed && areaReport.passed,
    findings: [...report.findings, ...areaReport.findings],
    checks: report.checks + areaReport.checks,
    areaOutlines: areaReport,
  };
  const files = new Map<string, Uint8Array>();
  files.set(PACK_FILE, output.pack);
  const resolutionBytes = text(serialiseResolution(output.resolution));
  files.set(RESOLUTION_FILE, resolutionBytes);
  files.set(VALIDATION_FILE, text(combined));
  for (const layer of layers) {
    for (const [name, data] of layer.licenceFiles) files.set(`licences/${name}`, data);
  }
  const terms = await readFile(
    new URL("../../map-data/licences/natural-earth-terms.txt", import.meta.url),
  );
  files.set("licences/natural-earth-terms.txt", new Uint8Array(terms));
  const totalBytes = [...files.values()].reduce((sum, data) => sum + data.length, 0);
  const manifest = {
    manifestVersion: 2,
    pipelineVersion: inputs.config.pipelineVersion,
    packFormat: inputs.config.packFormat,
    dataset: {
      name: inputs.pins.dataset,
      sources: inputs.pins.sources.map((pin) => ({
        id: pin.id,
        layer: pin.layer,
        version: pin.version,
        url: pin.url,
        archiveSha256: pin.sha256,
        archiveBytes: pin.bytes,
      })),
    },
    licence: {
      identifier: "Natural Earth: public domain",
      attributionRequired: false,
      files: [...files.keys()].filter((name) => name.startsWith("licences/")).sort(),
    },
    generationTimestampPolicy: inputs.config.generationTimestampPolicy,
    toolchain: {
      node: process.version,
      "geojson-vt": await packageVersion(repoRoot, "geojson-vt"),
      "vt-pbf": await packageVersion(repoRoot, "vt-pbf"),
      shapefile: await packageVersion(repoRoot, "shapefile"),
      "@mapbox/vector-tile": await packageVersion(repoRoot, "@mapbox/vector-tile"),
      pbf: await packageVersion(repoRoot, "pbf"),
      lockfileSha256: await lockfileSha(repoRoot),
    },
    configurationSha256: configurationHash(
      inputs.config,
      inputs.catalogue,
      inputs.pinsRaw,
      sha256Hex,
      { spec: inputs.areaSpec, sourceSha256: canonicalAreaHash(inputs.areaSources, areaTextHash) },
    ),
    areaOutlines: {
      datasetVersion: inputs.areaSpec.datasetVersion,
      sourceSha256: canonicalAreaHash(inputs.areaSources, areaTextHash),
      sourceModule: `${inputs.areaSpec.source.module}#${inputs.areaSpec.source.export}`,
      sourceCount: inputs.areaSpec.source.count,
      edgeSemantics: inputs.areaSpec.edgeSemantics,
      longitudeConvention: "unwrapped; split at the antimeridian by the tiler",
      densifyToleranceMetres: inputs.areaSpec.densifyToleranceMetres,
      quantisation: {
        tileExtent: inputs.config.tileExtent,
        unitsPerTile: inputs.config.tileExtent,
        note: "integer tile units; the worst baked vertex error is bounded by half a unit per axis",
      },
      clipping: {
        tileBuffer: inputs.config.tileBuffer,
        outlineGeometry: "open line pieces, no artificial edges",
      },
      layers: { fill: inputs.config.layers.areas, outline: inputs.config.layers.areaOutlines },
      geometryCount: {
        areas: geometry.areas.length,
        fillAndOutlineFeatures: geometry.areas.length * 2,
      },
      vertices: areaReport.vertexCounts,
      perLevel: output.levels.map((level) => ({
        zoom: level.zoom,
        tilesWithAreas: level.areaTiles,
        vertices: level.areaVertices,
      })),
      fitForPurposeMaxZoom: inputs.config.fitForPurposeMaxZoom,
      protectedCatalogueVersion: inputs.catalogue.catalogueVersion,
      generationTool: `map-data pipeline ${inputs.config.pipelineVersion}`,
      validation: {
        passed: areaReport.passed,
        findings: areaReport.findings.length,
        checks: areaReport.checks,
        fidelityWorstUnits: areaReport.fidelity.worstUnits,
        crackWorstUnits: areaReport.cracks.worstUnits,
        crackWorstMetres: areaReport.cracks.worstMetres,
      },
    },
    protectedFeatures: {
      catalogueVersion: inputs.catalogue.catalogueVersion,
      features: inputs.catalogue.features.length,
      resolutionSha256: sha256Hex(resolutionBytes),
    },
    projection: inputs.config.projection,
    edgeSemantics: inputs.config.edgeSemantics,
    bounds: inputs.config.bounds,
    zoom: {
      tileMin: inputs.config.tileMinZoom,
      tileMax: inputs.config.tileMaxZoom,
      fitForPurposeMax: inputs.config.fitForPurposeMaxZoom,
      overscaleMax: inputs.config.overscaleMaxZoom,
    },
    tileExtent: inputs.config.tileExtent,
    tileBuffer: inputs.config.tileBuffer,
    simplificationPixels: inputs.config.simplificationPixels,
    quantisation: "integer tile units, extent per config; per-level metres in levels[]",
    layers: inputs.config.layers,
    counts: {
      tiles: output.levels.reduce((sum, level) => sum + level.tiles, 0),
      files: files.size + 1,
      sourceVertices: output.sourceVertices,
      densifiedVertices: output.densifiedVertices,
    },
    sizes: {
      packBytes: output.pack.length,
      outputBytes: totalBytes,
      sourceArchiveBytes: inputs.pins.sources.reduce((sum, pin) => sum + pin.bytes, 0),
      sourceExtractedBytes: layers.reduce((sum, layer) => sum + layer.extractedBytes, 0),
    },
    integrity: {
      packSha256: sha256Hex(output.pack),
      files: Object.fromEntries(
        [...files]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([name, data]) => [name, sha256Hex(data)]),
      ),
    },
    levels: output.levels,
    attribution:
      "Made with Natural Earth. Natural Earth is public domain; attribution is optional.",
    validation: {
      passed: report.passed,
      findings: report.findings.length,
      checks: report.checks,
      reportSha256: sha256Hex(files.get(VALIDATION_FILE) ?? new Uint8Array(0)),
    },
  };
  files.set(MANIFEST_FILE, text(manifest));
  return { files, manifest, report: combined, output };
}

function serialiseResolution(resolution: Resolution): unknown {
  return JSON.parse(canonicalJson(resolution));
}

export async function writeFiles(
  outDir: string,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  for (const [name, data] of files) {
    const target = join(outDir, name);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, data);
  }
}

export async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(relative(dir, full));
    }
  }
  await walk(dir);
  return out;
}

export async function directoryBytes(dir: string): Promise<number> {
  let total = 0;
  for (const name of await listFiles(dir)) total += (await stat(join(dir, name))).size;
  return total;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly report: ValidationReport | null;
}

export async function verifyOutput(outDir: string, inputs: Inputs): Promise<VerifyResult> {
  const problems: string[] = [];
  let manifest: Record<string, unknown>;
  try {
    manifest = (await readJson(join(outDir, MANIFEST_FILE))) as Record<string, unknown>;
  } catch (error) {
    return {
      ok: false,
      problems: [`manifest: ${error instanceof Error ? error.message : String(error)}`],
      report: null,
    };
  }
  const integrity = manifest.integrity as { packSha256: string; files: Record<string, string> };
  for (const [name, expected] of Object.entries(integrity.files)) {
    try {
      const actual = sha256Hex(new Uint8Array(await readFile(join(outDir, name))));
      if (actual !== expected)
        problems.push(`${name}: sha256 ${actual} does not match the manifest ${expected}`);
    } catch {
      problems.push(`${name}: listed in the manifest but missing from the output`);
    }
  }
  let report: ValidationReport | null = null;
  try {
    const pack = TilePack.parse(new Uint8Array(await readFile(join(outDir, PACK_FILE))));
    for (const entry of pack.entries()) pack.read(entry);
    const resolution = (await readJson(join(outDir, RESOLUTION_FILE))) as Resolution;
    const protectedReport = validateProtectedFeatures(
      pack,
      inputs.catalogue,
      resolution,
      inputs.config,
    );
    const areaReport = validateAreaOutlines(
      pack,
      prepareAreas(inputs.areaSources, inputs.areaSpec),
      inputs.config,
    );
    report = {
      ...protectedReport,
      findings: [...protectedReport.findings, ...areaReport.findings],
    };
    for (const finding of report.findings) {
      problems.push(
        `${finding.featureId} z${finding.level ?? "-"} ${finding.rule}: ${finding.detail}`,
      );
    }
  } catch (error) {
    problems.push(`pack: ${error instanceof Error ? error.message : String(error)}`);
  }
  const expectedConfig = configurationHash(
    inputs.config,
    inputs.catalogue,
    inputs.pinsRaw,
    sha256Hex,
    { spec: inputs.areaSpec, sourceSha256: canonicalAreaHash(inputs.areaSources, areaTextHash) },
  );
  if (manifest.configurationSha256 !== expectedConfig) {
    problems.push(
      "manifest: configurationSha256 does not match the current config, catalogue and source pins",
    );
  }
  return { ok: problems.length === 0, problems, report };
}

export function integrityError(message: string): MapDataIntegrityError {
  return new MapDataIntegrityError(message);
}

export function sha(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
