import { Schema } from "effect";

import { CatalogueError } from "./errors.ts";
import { MAX_MERCATOR_LATITUDE, type Position } from "./geodesy.ts";

const PositionSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
const LineSchema = Schema.Array(PositionSchema).check(Schema.isMinLength(2));

const ProvenanceSchema = Schema.Struct({
  method: Schema.Literals(["derived-from-dataset", "authored", "validation-probe"]),
  source: Schema.String.check(Schema.isMinLength(10)),
  accuracyClass: Schema.Literals(["dataset", "schematic"]),
  positionalAccuracyMetres: Schema.Finite.check(Schema.isGreaterThan(0)),
  retrieved: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  notes: Schema.String,
});

const LicenceSchema = Schema.Struct({
  status: Schema.Literals(["public-domain", "bluewave-authored"]),
  identifier: Schema.String.check(Schema.isMinLength(3)),
  attributionRequired: Schema.Boolean,
});

const GeometrySchema = Schema.Union([
  Schema.Struct({
    source: Schema.Literal("natural-earth"),
    layer: Schema.String,
    name: Schema.String,
  }),
  Schema.Struct({ source: Schema.Literal("authored"), lines: Schema.Array(LineSchema) }),
]);

const TransectSchema = Schema.Struct({
  id: Schema.String,
  from: PositionSchema,
  to: PositionSchema,
});

const FallbackOverlaySchema = Schema.Struct({
  lines: Schema.Array(LineSchema).check(Schema.isMinLength(1)),
  provenance: ProvenanceSchema,
});

const FeatureSchema = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
  name: Schema.String.check(Schema.isMinLength(2)),
  type: Schema.Literals(["canal", "strait"]),
  representation: Schema.Literals(["overlay-line", "base-water-passage"]),
  edgeSemantics: Schema.Literals(["lonlat-linear", "great-circle", "rhumb", "mercator-linear"]),
  gameplayReason: Schema.String.check(Schema.isMinLength(20)),
  requiredFromZoom: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 12 }),
  ),
  geometry: Schema.optionalKey(GeometrySchema),
  transects: Schema.optionalKey(Schema.Array(TransectSchema)),
  fallbackOverlay: Schema.optionalKey(FallbackOverlaySchema),
  renderedWidthPixels: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0))),
  referenceWidthMetres: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0))),
  maxNarrowingFraction: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  maxDisplacementMetres: Schema.Finite.check(Schema.isGreaterThan(0)),
  visualContinuityRequired: Schema.Boolean,
  simulationNavigabilityImplicated: Schema.Boolean,
  displayOnly: Schema.Boolean,
  opensYear: Schema.optionalKey(Schema.Finite.check(Schema.isInt())),
  provenance: ProvenanceSchema,
  license: LicenceSchema,
  validationNotes: Schema.String,
});

const CatalogueSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  catalogueVersion: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  edgeSemanticsPolicy: Schema.String.check(Schema.isMinLength(20)),
  features: Schema.Array(FeatureSchema).check(Schema.isMinLength(1)),
});

export type ProtectedFeature = Schema.Schema.Type<typeof FeatureSchema>;
export type ProtectedCatalogue = Schema.Schema.Type<typeof CatalogueSchema>;

export const REQUIRED_FEATURE_IDS: readonly string[] = [
  "suez-canal",
  "panama-canal",
  "bosporus",
  "dardanelles",
  "corinth-canal",
  "kiel-canal",
  "strait-of-gibraltar",
  "strait-of-hormuz",
  "bab-el-mandeb",
  "strait-of-malacca",
  "dover-strait",
];

function checkPosition(position: Position, label: string): void {
  if (Math.abs(position[0]) > 180 || Math.abs(position[1]) > MAX_MERCATOR_LATITUDE) {
    throw new CatalogueError(
      `${label}: ${position.join(",")} is outside longitude/latitude bounds`,
    );
  }
}

function checkFeature(feature: ProtectedFeature): void {
  const label = feature.id;
  if (feature.edgeSemantics !== "lonlat-linear") {
    throw new CatalogueError(
      `${label}: unsupported edge semantics '${feature.edgeSemantics}'; only 'lonlat-linear' is implemented`,
    );
  }
  if (feature.representation === "overlay-line") {
    if (feature.geometry === undefined)
      throw new CatalogueError(`${label}: overlay-line needs geometry`);
    if (feature.renderedWidthPixels === undefined) {
      throw new CatalogueError(`${label}: overlay-line needs renderedWidthPixels`);
    }
  } else {
    if (feature.transects === undefined || feature.transects.length === 0) {
      throw new CatalogueError(`${label}: base-water-passage needs at least one transect`);
    }
    if (feature.referenceWidthMetres === undefined) {
      throw new CatalogueError(`${label}: base-water-passage needs referenceWidthMetres`);
    }
  }
  if (feature.geometry?.source === "authored") {
    for (const line of feature.geometry.lines) {
      line.forEach((point, index) => checkPosition(point, `${label} line vertex ${index}`));
    }
    if (feature.provenance.method !== "authored") {
      throw new CatalogueError(
        `${label}: authored geometry must declare provenance.method 'authored'`,
      );
    }
    if (feature.license.status !== "bluewave-authored") {
      throw new CatalogueError(
        `${label}: authored geometry must have licence status 'bluewave-authored'`,
      );
    }
  }
  if (feature.geometry?.source === "natural-earth" && feature.license.status !== "public-domain") {
    throw new CatalogueError(
      `${label}: Natural Earth geometry must have licence status 'public-domain'`,
    );
  }
  for (const transect of feature.transects ?? []) {
    checkPosition(transect.from, `${label} ${transect.id} from`);
    checkPosition(transect.to, `${label} ${transect.id} to`);
  }
  for (const line of feature.fallbackOverlay?.lines ?? []) {
    line.forEach((point, index) => checkPosition(point, `${label} fallback vertex ${index}`));
  }
  if (feature.simulationNavigabilityImplicated && feature.displayOnly) {
    throw new CatalogueError(`${label}: displayOnly contradicts simulationNavigabilityImplicated`);
  }
}

export function decodeCatalogue(value: unknown): ProtectedCatalogue {
  let catalogue: ProtectedCatalogue;
  try {
    catalogue = Schema.decodeUnknownSync(CatalogueSchema)(value, { onExcessProperty: "error" });
  } catch (error) {
    throw new CatalogueError(error instanceof Error ? error.message : String(error));
  }
  const seen = new Set<string>();
  for (const feature of catalogue.features) {
    if (seen.has(feature.id)) throw new CatalogueError(`duplicate feature id '${feature.id}'`);
    seen.add(feature.id);
    checkFeature(feature);
  }
  const missing = REQUIRED_FEATURE_IDS.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new CatalogueError(`catalogue is missing required features: ${missing.join(", ")}`);
  }
  return catalogue;
}
