import { Schema } from "effect";

import { SourceReferenceSchema } from "./provenance.js";
import { SHIP_ZONE_IDS } from "./ship-component.js";

/**
 * Authored reference-design schema (CAH-SCH-1). Reference designs are compiled
 * into the ship-building catalogue's `referenceDesigns`; before this schema they
 * were only duplicate-id and cross-reference checked, so a structurally
 * malformed design could still compile. The shape mirrors the drawing board's
 * domain `DesignDraft` (packages/ship-design/src/compileShared.ts) without
 * importing it, keeping content-schema free of engine dependencies.
 */

/** Mirrors `ARMOUR_REGIONS` in `@bluewave/ship-design` (a test keeps the two lists identical). */
export const ARMOUR_REGION_IDS = [
  "BELT_MAIN",
  "BELT_UPPER",
  "BELT_ENDS",
  "DECK_MAIN",
  "DECK_SLOPE",
  "DECK_EXTENDED",
  "TURRET",
  "TURRET_TOP",
  "SECONDARY_GUN",
  "CONNING_TOWER",
  "MAGAZINE_BOX",
  "SPLINTER_PLATING",
  "TORPEDO_BULKHEAD",
  "TORPEDO_BELT",
] as const;

/** Mirrors `MountSide` in `@bluewave/ship-design` (a test keeps the two lists identical). */
export const MOUNT_SIDES = ["CENTRE", "PORT", "STBD"] as const;

/** Mirrors `AccommodationStandard` in `@bluewave/ship-design` (a test keeps the two lists identical). */
export const ACCOMMODATION_STANDARDS = ["SPARTAN", "STANDARD", "GENEROUS"] as const;

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10_000 }));

const ZoneIdSchema = Schema.Literals(SHIP_ZONE_IDS);

export const DesignRequirementSchema = Schema.Struct({
  category: Schema.NonEmptyString,
  requiredSpeedMilliKnots: nonNegativeInt,
  cruiseSpeedMilliKnots: nonNegativeInt,
  requiredRangeNm: nonNegativeInt,
  designThreatId: Schema.NonEmptyString,
  modernizationExpectation: Schema.Literals(["NONE", "MINOR", "MAJOR"]),
  crewQualityBp: bp,
  accommodationStandard: Schema.Literals(ACCOMMODATION_STANDARDS),
  protectionGoal: Schema.optional(Schema.Literals(["NONE", "STANDARD"])),
});

export const HullSpecSchema = Schema.Struct({
  hullFormId: Schema.NonEmptyString,
  lengthWl: positiveInt,
  beam: positiveInt,
  draught: positiveInt,
  depthToMainDeck: positiveInt,
  blockCoeffBp: bp,
  materialId: Schema.NonEmptyString,
  structuralSchemeId: Schema.NonEmptyString,
  subdivisionGrade: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 4 }),
  ),
  targetDisplacementKg: positiveInt,
  limitDisplacementKg: Schema.NullOr(positiveInt),
  designMarginBp: bp,
  growthReserveBp: bp,
});

const MachineryRoomSchema = Schema.Struct({
  zoneId: ZoneIdSchema,
  stationPermille: bp,
  shareBp: bp,
});

const MachineryPlanSchema = Schema.Struct({
  plantId: Schema.NonEmptyString,
  installedKw: nonNegativeInt,
  zoneId: ZoneIdSchema,
  stationPermille: bp,
  fuelCapacityKg: nonNegativeInt,
  fuelZoneId: ZoneIdSchema,
  fuelStationPermille: bp,
  foulingBp: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(-10_000)),
  rooms: Schema.optional(Schema.Array(MachineryRoomSchema)),
});

const ArmourRegionSchema = Schema.Struct({
  region: Schema.Literals(ARMOUR_REGION_IDS),
  thicknessUm: positiveInt,
  lengthMm: positiveInt,
  heightMm: positiveInt,
  materialId: Schema.NonEmptyString,
  cosObliquityBp: bp,
});

const ArmourPlanSchema = Schema.Struct({
  regions: Schema.Array(ArmourRegionSchema),
  citadelLengthMm: nonNegativeInt,
  torpedoWarheadKg: nonNegativeInt,
  bunkerProtectionBp: bp,
});

const PlacementSpecSchema = Schema.Struct({
  instanceId: Schema.NonEmptyString,
  componentId: Schema.NonEmptyString,
  zoneId: ZoneIdSchema,
  stationPermille: bp,
  side: Schema.optional(Schema.Literals(MOUNT_SIDES)),
  params: Schema.optional(Schema.Record(Schema.String, Schema.Finite)),
  magazineRef: Schema.optional(Schema.NonEmptyString),
});

const DesignDraftSchema = Schema.Struct({
  nationId: Schema.NonEmptyString,
  requirement: DesignRequirementSchema,
  hull: HullSpecSchema,
  machinery: MachineryPlanSchema,
  armour: ArmourPlanSchema,
  placements: Schema.Array(PlacementSpecSchema),
});

/**
 * The status a reconstructed value can carry (CAH-SCH-1, ticket 39). A strict
 * subset of the shared `SOURCE_STATUSES`: a historical reference value is either
 * read VERIFIED (period primary/near-primary, or two independent sources that
 * agree), DERIVED (a single compilation such as navypedia, or arithmetic on
 * cited figures), or ESTIMATE (a reasoned value with no source).
 */
export const REFERENCE_VALUE_STATUSES = ["VERIFIED", "DERIVED", "ESTIMATE"] as const;
export const REFERENCE_VALUE_STATUSES_SCHEMA = Schema.Literals(REFERENCE_VALUE_STATUSES);

/**
 * One reconstructed fact of a historical reference design (ticket 39). `value`
 * is the fact as read (e.g. "9,387 t normal (Thunderer 9,390)"), `status` its
 * confidence, and `sources` the real citations behind it (an array so a VERIFIED
 * value can name both agreeing sources; at least one is required). `note` records
 * an admitted approximation or a source conflict. The schema is structural only;
 * the reference-design provenance test acts on it.
 */
export const ReferenceValueProvenanceSchema = Schema.Struct({
  value: Schema.NonEmptyString,
  status: REFERENCE_VALUE_STATUSES_SCHEMA,
  sources: Schema.Array(SourceReferenceSchema).check(Schema.isMinLength(1)),
  note: Schema.optional(Schema.String),
});

export type ReferenceValueProvenance = typeof ReferenceValueProvenanceSchema.Type;

/**
 * The machine-readable provenance every HISTORICAL reference design carries
 * (ticket 39): the six facts the January-1880 reconstruction review grounded in
 * `docs/research/ship-building-1880-ships-by-nation.md` and its companions. A
 * design that declares `historical: true` must fill all six (the
 * `referenceProvenance` test enforces it); non-historical templates omit it.
 */
export const ReferenceDesignProvenanceSchema = Schema.Struct({
  completionDate: ReferenceValueProvenanceSchema,
  displacementBasis: ReferenceValueProvenanceSchema,
  armourScheme: ReferenceValueProvenanceSchema,
  armamentConfiguration: ReferenceValueProvenanceSchema,
  machineryOutput: ReferenceValueProvenanceSchema,
  speed: ReferenceValueProvenanceSchema,
});

export type ReferenceDesignProvenance = typeof ReferenceDesignProvenanceSchema.Type;

/** The six facts a historical design's provenance must cover, in report order. */
export const REFERENCE_PROVENANCE_FIELDS = [
  "completionDate",
  "displacementBasis",
  "armourScheme",
  "armamentConfiguration",
  "machineryOutput",
  "speed",
] as const;

export const ReferenceDesignSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  month,
  starterFor: Schema.optional(Schema.NonEmptyString),
  /**
   * True when the design reconstructs a documented real ship; absent/false means
   * a non-historical doctrine or illustrative template. A historical design must
   * carry full `provenance` (the reference-design provenance test enforces it).
   */
  historical: Schema.optional(Schema.Boolean),
  draft: DesignDraftSchema,
  provenance: Schema.optional(ReferenceDesignProvenanceSchema),
});

export type ReferenceDesign = typeof ReferenceDesignSchema.Type;
export type DesignDraft = typeof DesignDraftSchema.Type;
