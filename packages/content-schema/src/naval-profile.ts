import { Schema } from "effect";
import { CANONICAL_RESEARCH_FIELD_IDS } from "./research-fields.js";
import {
  COMPONENT_ACCESS_STATUSES_SCHEMA,
  NAVAL_POSTURES_SCHEMA,
  SHIP_TYPE_ID_VALUES,
} from "./naval-profile-vocab.js";
import { ProvenanceSchema, SourceReferenceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10_000 }));
const priority = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 4 }));

const ComponentAccessSchema = Schema.Struct({
  status: COMPONENT_ACCESS_STATUSES_SCHEMA,
  producer: Schema.optional(Schema.String),
  provenance: Schema.optional(ProvenanceSchema),
});

const MOUNT_TYPE_VALUES = [
  "TURRET",
  "BARBETTE",
  "CASEMATE",
  "DECK_SHIELDED",
  "DECK_OPEN",
  "BROADSIDE_BATTERY",
  "SUBMERGED_TUBE",
  "ABOVE_WATER_TUBE",
] as const;
const AMMUNITION_PATTERN_VALUES = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;

const OverridesSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Finite, Schema.Array(Schema.String)]),
);

const GunModelSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  familyId: Schema.NonEmptyString,
  designation: Schema.NonEmptyString,
  overrides: OverridesSchema,
  mounts: Schema.Array(Schema.Literals(MOUNT_TYPE_VALUES)).check(Schema.isMinLength(1)),
  introductionMonth: Schema.optional(Schema.String),
  obsoleteMonth: Schema.optional(Schema.NullOr(Schema.String)),
  provenance: ProvenanceSchema,
});

const AmmunitionPatternSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  pattern: Schema.Literals(AMMUNITION_PATTERN_VALUES),
  penetrationBiasBp: bp,
  provenance: ProvenanceSchema,
});

const ComponentVariantSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  familyId: Schema.NonEmptyString,
  designation: Schema.NonEmptyString,
  overrides: OverridesSchema,
  introductionMonth: Schema.optional(Schema.String),
  obsoleteMonth: Schema.optional(Schema.NullOr(Schema.String)),
  provenance: ProvenanceSchema,
});

const HardCapabilitiesSchema = Schema.Struct({
  maxGunCaliberUm: positiveInt,
  maxImportedGunCaliberUm: Schema.optional(positiveInt),
  maxArmourThicknessUm: positiveInt,
  domesticTorpedoDiameterUm: positiveInt,
  hullForms: Schema.Array(Schema.String),
  domesticPlants: Schema.Array(Schema.String),
  restrictedShipTypes: Schema.Array(Schema.Literals(SHIP_TYPE_ID_VALUES)),
  grants: Schema.Array(Schema.String),
});

const SoftPreferencesSchema = Schema.Struct({
  speedOverArmourBp: bp,
  secondaryBatteryWeightBp: positiveInt,
  enduranceWeightBp: positiveInt,
  riskToleranceBp: bp,
  colonialServiceWeightBp: positiveInt,
  torpedoOnCruisersBp: positiveInt,
  accommodationStandard: Schema.Literals(["SPARTAN", "STANDARD", "GENEROUS"]),
});

const DatedValueSchema = Schema.Struct({ fromMonth: Schema.String, value: nonNegativeInt });

const IndustrialProfileSchema = Schema.Struct({
  buildTimeMultiplierBp: positiveInt,
  costMultiplierBp: positiveInt,
  machineryReliabilityBp: bp,
  constructionQualityVarianceBp: nonNegativeInt,
  maxPracticalDisplacementKg: Schema.Array(DatedValueSchema).check(Schema.isMinLength(1)),
  heavyGunProduction: COMPONENT_ACCESS_STATUSES_SCHEMA,
  armourPlateProduction: COMPONENT_ACCESS_STATUSES_SCHEMA,
  provenance: ProvenanceSchema,
});

const DockDimensionsSchema = Schema.Struct({
  maxLengthMm: positiveInt,
  maxBeamMm: positiveInt,
  maxHeaviestComponentKg: positiveInt,
});

const DockSchema = Schema.Struct({
  maximumNewConstructionMassKg: positiveInt,
  maximumMajorRepairMassKg: positiveInt,
  maximumRebuildMassKg: positiveInt,
  maximumConversionMassKg: positiveInt,
  dimensions: Schema.optional(Schema.NullOr(DockDimensionsSchema)),
  provenance: ProvenanceSchema,
});

const DoctrineProfileSchema = Schema.Struct({
  engagementRangeM: positiveInt,
  hePreferenceBp: bp,
  postures: Schema.Array(NAVAL_POSTURES_SCHEMA).check(Schema.isMinLength(1)),
  provenance: ProvenanceSchema,
});

const ResearchPreferenceSchema = Schema.Struct({
  field: Schema.Literals(CANONICAL_RESEARCH_FIELD_IDS),
  priority,
});

const DesignWeightsSchema = Schema.Struct({
  firepowerBp: positiveInt,
  protectionBp: positiveInt,
  speedBp: positiveInt,
  enduranceBp: positiveInt,
  torpedoBp: positiveInt,
  reliabilityBp: positiveInt,
  colonialBp: positiveInt,
  costBp: positiveInt,
});

const ProcurementPolicySchema = Schema.Struct({
  battleLineShareBp: nonNegativeInt,
  cruiserShareBp: nonNegativeInt,
  torpedoCraftShareBp: nonNegativeInt,
  colonialShareBp: nonNegativeInt,
  foreignProcurementAppetiteBp: bp,
  unprovenTechAppetiteBp: bp,
  buildOrder: Schema.Array(Schema.Literals(SHIP_TYPE_ID_VALUES)).check(Schema.isMinLength(1)),
});

const NamingPolicySchema = Schema.Struct({
  stems: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  convention: Schema.Record(Schema.String, Schema.String),
});

export const NationNavalProfileSchema = Schema.Struct({
  nationId: Schema.NonEmptyString,
  activeFrom: Schema.String,
  activeUntil: Schema.NullOr(Schema.String),
  strategicSituation: Schema.NonEmptyString,
  hardCapabilities: HardCapabilitiesSchema,
  softPreferences: SoftPreferencesSchema,
  industrialProfile: IndustrialProfileSchema,
  dock: DockSchema,
  doctrineProfile: DoctrineProfileSchema,
  researchPreferences: Schema.Array(ResearchPreferenceSchema),
  componentAccess: Schema.Record(Schema.String, ComponentAccessSchema),
  gunModels: Schema.Array(GunModelSchema),
  ammunitionPatterns: Schema.Array(AmmunitionPatternSchema),
  componentVariants: Schema.Array(ComponentVariantSchema),
  designWeights: Schema.Record(Schema.String, DesignWeightsSchema),
  procurementPolicy: ProcurementPolicySchema,
  namingPolicy: NamingPolicySchema,
  sourceReferences: Schema.Array(SourceReferenceSchema),
  provenance: ProvenanceSchema,
});

export const NavalProfileCatalogueSchema = Schema.Struct({
  navalProfiles: Schema.Array(NationNavalProfileSchema),
});

export type NationNavalProfileData = typeof NationNavalProfileSchema.Type;
