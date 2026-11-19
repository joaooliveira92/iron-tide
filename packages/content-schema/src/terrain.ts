import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

export const TERRAIN_COORDINATE_LIMIT_M = 1_000_000;
export const TERRAIN_LAYERS = ["LAND", "SHALLOWS"] as const;
export const TERRAIN_VERSION = 1;
export const TERRAIN_HASH_DOMAIN = "bluewave.terrain.v1";
export const TERRAIN_ARTIFACT_KIND = "terrain-pack";
export const TERRAIN_COMPATIBILITY_VERSION = "0.2.0";

const metre = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -TERRAIN_COORDINATE_LIMIT_M, maximum: TERRAIN_COORDINATE_LIMIT_M }),
);
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));

export const TerrainVertexSchema = Schema.Struct({ xM: metre, yM: metre });

export const TerrainBoxSchema = Schema.Struct({
  minXM: metre,
  minYM: metre,
  maxXM: metre,
  maxYM: metre,
});

export const TerrainPolygonSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  layer: Schema.Literals(TERRAIN_LAYERS),
  vertices: Schema.Array(TerrainVertexSchema).check(Schema.isMinLength(3)),
  provenance: Schema.optional(ProvenanceSchema),
});

export const TerrainBaseSchema = Schema.Struct({
  portId: Schema.NonEmptyString,
  xM: metre,
  yM: metre,
});

export const TerrainAreaSchema = Schema.Struct({
  areaId: Schema.NonEmptyString,
  box: TerrainBoxSchema,
  polygons: Schema.Array(TerrainPolygonSchema),
  bases: Schema.Array(TerrainBaseSchema),
  battleOrigin: TerrainVertexSchema,
  provenance: ProvenanceSchema,
});

export const TerrainRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  exclusionRadiusM: positiveInt,
  maxVerticesPerPolygon: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(3)),
  provenance: ProvenanceSchema,
});

export const CompiledTerrainPolygonSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  vertices: Schema.Array(TerrainVertexSchema),
});

export const CompiledTerrainExclusionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  portId: Schema.NonEmptyString,
  xM: metre,
  yM: metre,
  radiusM: positiveInt,
});

export const CompiledTerrainRecordSchema = Schema.Struct({
  areaId: Schema.NonEmptyString,
  box: TerrainBoxSchema,
  battleOrigin: TerrainVertexSchema,
  land: Schema.Array(CompiledTerrainPolygonSchema),
  shallows: Schema.Array(CompiledTerrainPolygonSchema),
  exclusions: Schema.Array(CompiledTerrainExclusionSchema),
});

export const CompiledTerrainSchema = Schema.Struct({
  terrainVersion: Schema.Literal(TERRAIN_VERSION),
  rules: TerrainRulesSchema,
  records: Schema.Array(CompiledTerrainRecordSchema),
});

export type TerrainVertex = typeof TerrainVertexSchema.Type;
export type TerrainBox = typeof TerrainBoxSchema.Type;
export type TerrainPolygonSource = typeof TerrainPolygonSchema.Type;
export type TerrainArea = typeof TerrainAreaSchema.Type;
export type TerrainRules = typeof TerrainRulesSchema.Type;
export type CompiledTerrainRecord = typeof CompiledTerrainRecordSchema.Type;
export type CompiledTerrain = typeof CompiledTerrainSchema.Type;

export type TerrainRulesDecoded =
  | { readonly ok: true; readonly value: TerrainRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeTerrainRules(input: unknown): TerrainRulesDecoded {
  const result = Schema.decodeUnknownResult(TerrainRulesSchema, {
    ...CONTENT_DECODE_OPTIONS,
    errors: "all",
  })(input);
  if (Result.isSuccess(result)) return { ok: true, value: result.success };
  const [first] = formatter(result.failure.issue).issues;
  const path = (first?.path ?? []).filter(
    (key): key is string | number => typeof key === "string" || typeof key === "number",
  );
  return {
    ok: false,
    field: path.length > 0 ? path.join(".") : "(root)",
    message: first?.message ?? "is invalid",
  };
}
