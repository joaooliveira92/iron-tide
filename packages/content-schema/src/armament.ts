import { Schema } from "effect";
import { ProvenanceSchema } from "./provenance.js";

/**
 * Content schema for the first-class armament catalogue (ADR-0093, national armament integration
 * Step 2). Four separately authored collections live under
 * `content/production/<scenario>/ship-building/armament/`:
 *
 * - `gun-families.yaml`  — shared physical/technical families (never duplicated per nation);
 * - `gun-models.yaml`    — national models that reference a shared family;
 * - `gun-mounts.yaml`    — the mount catalogue, kept separate from the gun model;
 * - `ammunition.yaml`    — national ammunition patterns.
 *
 * Every numeric field names its unit (`caliberUm`, `gunMassKg`, `shellMassG`, `...UmPerSec`,
 * `...Bp`, `...KgM`, `...Litre`, `...Mm`, `...Deg`). Unknown fields are rejected at decode
 * (`onExcessProperty: "error"`), so an ambiguous field such as `weight`, `speed`, `rate`, `range`
 * or `size` is rejected rather than silently accepted. Structural authority only: cross-references,
 * ranges and provenance completeness are enforced by `lintArmament` in `@bluewave/armament` and the
 * ship-design release wrapper.
 */

const ID_RE = /^[a-z][a-z0-9_]*$/;
const id = Schema.String.check(
  Schema.isPattern(ID_RE, { message: "must be a canonical lower snake_case id" }),
);

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
const GUN_CATEGORY_VALUES = ["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"] as const;
const SHELL_TYPE_VALUES = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10_000 }));

export const GunFamilySchema = Schema.Struct({
  id,
  designation: Schema.NonEmptyString,
  category: Schema.Literals(GUN_CATEGORY_VALUES),
  /** The canonical installation a family is fielded in when a national model does not override it. */
  defaultMountType: Schema.Literals(MOUNT_TYPE_VALUES),
  provenance: ProvenanceSchema,
});

export const GunFamilyCatalogueSchema = Schema.Struct({
  gunFamilies: Schema.Array(GunFamilySchema),
});

export const GunModelSchema = Schema.Struct({
  id,
  familyId: Schema.NonEmptyString,
  /** The nation that fields this model. Purely data; the resolver has no nation-id branch. */
  nationId: Schema.NonEmptyString,
  designation: Schema.NonEmptyString,
  caliberUm: Schema.optional(positiveInt),
  barrelLengthCalibers: Schema.optional(Schema.Finite.check(Schema.isGreaterThan(0))),
  gunMassKg: Schema.optional(nonNegativeInt),
  loadingSystem: Schema.optional(Schema.String),
  nominalMuzzleVelocityUmPerSec: Schema.optional(positiveInt),
  mechanicalRateOfFireRoundsPerMinuteX100: Schema.optional(positiveInt),
  propellantChargeBp: Schema.optional(nonNegativeInt),
  shellMassG: Schema.optional(nonNegativeInt),
  roundVolumeMl: Schema.optional(nonNegativeInt),
  reliabilityBp: Schema.optional(bp),
  introductionMonth: Schema.optional(Schema.String),
  retirementMonth: Schema.optional(Schema.NullOr(Schema.String)),
  supportedMountTypes: Schema.Array(Schema.Literals(MOUNT_TYPE_VALUES)).check(
    Schema.isMinLength(1),
  ),
  requiredTechnologyIds: Schema.Array(Schema.String),
  provenance: ProvenanceSchema,
});

export const GunModelCatalogueSchema = Schema.Struct({
  gunModels: Schema.Array(GunModelSchema),
});

export const GunMountSchema = Schema.Struct({
  id,
  mountType: Schema.Literals(MOUNT_TYPE_VALUES),
  compatibleGunFamilies: Schema.optional(Schema.Array(Schema.String)),
  gunCount: positiveInt,
  baseInstallationMassKg: Schema.optional(nonNegativeInt),
  perGunInstallationMassKg: Schema.optional(nonNegativeInt),
  topWeightKg: Schema.optional(nonNegativeInt),
  supportedArmorMm: Schema.optional(nonNegativeInt),
  traverseDeg: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 360 })),
  ),
  elevationMinDeg: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: -90, maximum: 90 })),
  ),
  elevationMaxDeg: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: -90, maximum: 90 })),
  ),
  firingArcDeg: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 360 })),
  ),
  rateOfFireModifierBp: Schema.optional(nonNegativeInt),
  ammunitionHandlingModifierBp: Schema.optional(nonNegativeInt),
  crewProtection: Schema.optional(Schema.String),
  hullSpaceUsageLitre: Schema.optional(nonNegativeInt),
  stabilityContributionKgM: Schema.optional(Schema.Finite.check(Schema.isInt())),
  vulnerability: Schema.optional(Schema.String),
  introductionMonth: Schema.optional(Schema.String),
  retirementMonth: Schema.optional(Schema.NullOr(Schema.String)),
  requiredTechnologyIds: Schema.Array(Schema.String),
  provenance: ProvenanceSchema,
});

export const GunMountCatalogueSchema = Schema.Struct({
  gunMounts: Schema.Array(GunMountSchema),
});

export const AmmunitionPatternSchema = Schema.Struct({
  id,
  shellType: Schema.Literals(SHELL_TYPE_VALUES),
  nationId: Schema.NonEmptyString,
  compatibleGunFamilies: Schema.optional(Schema.Array(Schema.String)),
  compatibleGunModelIds: Schema.optional(Schema.Array(Schema.String)),
  shellMassG: Schema.optional(nonNegativeInt),
  propellantInteractionBp: Schema.optional(nonNegativeInt),
  penetrationBiasBp: Schema.optional(bp),
  explosiveFillerG: Schema.optional(nonNegativeInt),
  burstingEffectBp: Schema.optional(nonNegativeInt),
  fireEffectBp: Schema.optional(nonNegativeInt),
  storageHazard: Schema.optional(Schema.String),
  ammunitionCostMicro: Schema.optional(nonNegativeInt),
  rateOfFireModifierBp: Schema.optional(nonNegativeInt),
  introductionMonth: Schema.optional(Schema.String),
  retirementMonth: Schema.optional(Schema.NullOr(Schema.String)),
  provenance: ProvenanceSchema,
});

export const AmmunitionCatalogueSchema = Schema.Struct({
  ammunition: Schema.Array(AmmunitionPatternSchema),
});

export type GunFamilyData = typeof GunFamilySchema.Type;
export type GunModelData = typeof GunModelSchema.Type;
export type GunMountData = typeof GunMountSchema.Type;
export type AmmunitionPatternData = typeof AmmunitionPatternSchema.Type;
