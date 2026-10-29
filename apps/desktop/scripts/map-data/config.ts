import { MapDataError } from "./errors.ts";

export interface PipelineConfig {
  readonly schemaVersion: 1;
  readonly pipelineVersion: string;
  readonly projection: string;
  readonly edgeSemantics: "lonlat-linear";
  readonly densifyToleranceMetres: number;
  readonly maxMercatorLatitude: number;
  readonly tileExtent: number;
  readonly tileBuffer: number;
  readonly tileMinZoom: number;
  readonly tileMaxZoom: number;
  readonly fitForPurposeMaxZoom: number;
  readonly overscaleMaxZoom: number;
  readonly bounds: readonly [number, number, number, number];
  readonly simplificationPixels: number;
  readonly climateSimplificationPixels: number;
  readonly protectedPinRadiusPixels: number;
  readonly overlayRenderedWidthPixels: number;
  readonly layers: {
    readonly land: string;
    readonly protected: string;
    readonly areas: string;
    readonly areaOutlines: string;
    readonly areaLabels: string;
    readonly climate: string;
  };
  readonly packFormat: string;
  readonly generationTimestampPolicy: string;
}

export function parsePipelineConfig(value: unknown): PipelineConfig {
  const record = value as Record<string, unknown>;
  const numeric = [
    "densifyToleranceMetres",
    "maxMercatorLatitude",
    "tileExtent",
    "tileBuffer",
    "tileMinZoom",
    "tileMaxZoom",
    "fitForPurposeMaxZoom",
    "overscaleMaxZoom",
    "simplificationPixels",
    "climateSimplificationPixels",
    "protectedPinRadiusPixels",
    "overlayRenderedWidthPixels",
  ] as const;
  for (const key of numeric) {
    if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      throw new MapDataError(`config: '${key}' must be a finite number`);
    }
  }
  if (record.schemaVersion !== 1 || record.edgeSemantics !== "lonlat-linear") {
    throw new MapDataError("config: unsupported schemaVersion or edgeSemantics");
  }
  const config = value as PipelineConfig;
  const layerNames = Object.values(config.layers ?? {});
  if (
    layerNames.length !== 6 ||
    layerNames.some((name) => typeof name !== "string" || name.length === 0) ||
    new Set(layerNames).size !== 6
  ) {
    throw new MapDataError("config: layers must name six distinct layers");
  }
  if (config.tileMaxZoom < config.tileMinZoom || config.tileMaxZoom > 12) {
    throw new MapDataError("config: tile zoom range is invalid");
  }
  if (config.fitForPurposeMaxZoom > config.tileMaxZoom) {
    throw new MapDataError("config: fitForPurposeMaxZoom cannot exceed tileMaxZoom");
  }
  return config;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
