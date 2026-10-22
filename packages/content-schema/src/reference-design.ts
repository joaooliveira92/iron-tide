import { Schema } from "effect";

import { SourceReferenceSchema } from "./provenance.js";
import { SHIP_ZONE_IDS } from "./ship-component.js";

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

export const ARMOUR_SCHEME_IDS = [
  "FLAT_DECK_ON_BELT",
  "PROTECTED_CRUISER",
  "BELT_AND_SLOPING_DECK",
  "ALL_OR_NOTHING",
] as const;

export const MOUNT_SIDES = ["CENTRE", "PORT", "STBD"] as const;

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
  freeboardProfile: Schema.optional(Schema.Literals(["NORMAL", "LOW"] as const)),
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
  enginePriorityBp: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: -10_000, maximum: 10_000 })),
  ),
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
  schemeId: Schema.optional(Schema.Literals(ARMOUR_SCHEME_IDS)),
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
  fireControl: Schema.optional(Schema.Struct({ positions: nonNegativeInt })),
  tertiary: Schema.optional(Schema.Struct({ caliberUm: positiveInt, count: nonNegativeInt })),
  colonialServiceFitted: Schema.optional(Schema.Boolean),
  aluminiumSuperstructure: Schema.optional(Schema.Boolean),
  antiAircraft: Schema.optional(
    Schema.Struct({
      lightGuns: nonNegativeInt,
      mediumGuns: nonNegativeInt,
      directors: nonNegativeInt,
    }),
  ),
});

export const REFERENCE_VALUE_STATUSES = ["VERIFIED", "DERIVED", "ESTIMATE"] as const;
export const REFERENCE_VALUE_STATUSES_SCHEMA = Schema.Literals(REFERENCE_VALUE_STATUSES);

export const ReferenceValueProvenanceSchema = Schema.Struct({
  value: Schema.NonEmptyString,
  status: REFERENCE_VALUE_STATUSES_SCHEMA,
  sources: Schema.Array(SourceReferenceSchema).check(Schema.isMinLength(1)),
  note: Schema.optional(Schema.String),
});

export type ReferenceValueProvenance = typeof ReferenceValueProvenanceSchema.Type;

export const ReferenceDesignProvenanceSchema = Schema.Struct({
  completionDate: ReferenceValueProvenanceSchema,
  displacementBasis: ReferenceValueProvenanceSchema,
  armourScheme: ReferenceValueProvenanceSchema,
  armamentConfiguration: ReferenceValueProvenanceSchema,
  machineryOutput: ReferenceValueProvenanceSchema,
  speed: ReferenceValueProvenanceSchema,
});

export type ReferenceDesignProvenance = typeof ReferenceDesignProvenanceSchema.Type;

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
  historical: Schema.optional(Schema.Boolean),
  draft: DesignDraftSchema,
  provenance: Schema.optional(ReferenceDesignProvenanceSchema),
});

export type ReferenceDesign = typeof ReferenceDesignSchema.Type;
export type DesignDraft = typeof DesignDraftSchema.Type;
