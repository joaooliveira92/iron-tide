/**
 * Additive authoritative armament domain model (ADR-0093, "national armament integration" Step 1).
 *
 * This module is pure domain data: no React, no Electron, no Node filesystem, no campaign state and
 * no persistence. It is the neutral package both `@bluewave/ship-design` and `@bluewave/combat` may
 * depend on, so neither has to depend on the other for armament resolution.
 *
 * Every numeric field names its unit. Fields that current content cannot populate are optional and
 * carry no default: an absent optional field means "unknown", never a plausible-looking value. The
 * compatibility adapter in `@bluewave/ship-design` reports exactly which fields it cannot yet map.
 */
import type {
  AmmunitionId,
  ArmamentNationId,
  ArmamentTechnologyId,
  GunFamilyId,
  GunModelId,
  GunMountId,
} from "./ids.js";
import type { ArmamentProvenance } from "./provenance.js";

// Vocabularies

/** The gun categories the armament domain recognises (mirrors the ship-component gun categories). */
export const ARMAMENT_GUN_CATEGORIES = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
] as const;
export type ArmamentGunCategory = (typeof ARMAMENT_GUN_CATEGORIES)[number];

/** How a gun is installed (mirrors `MountType` in `@bluewave/ship-design`'s `nationProfile.ts`). */
export const ARMAMENT_MOUNT_TYPES = [
  "TURRET",
  "BARBETTE",
  "CASEMATE",
  "DECK_SHIELDED",
  "DECK_OPEN",
  "BROADSIDE_BATTERY",
  "SUBMERGED_TUBE",
  "ABOVE_WATER_TUBE",
] as const;
export type ArmamentMountType = (typeof ARMAMENT_MOUNT_TYPES)[number];

/** Shell families (mirrors `AmmunitionPattern` in `nationProfile.ts`). */
export const ARMAMENT_SHELL_TYPES = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;
export type ArmamentShellType = (typeof ARMAMENT_SHELL_TYPES)[number];

/** How a nation obtains a component (mirrors `ComponentAccessStatus`). */
export const ARMAMENT_ACCESS_STATUSES = [
  "DOMESTIC",
  "LICENSE_BUILT",
  "IMPORTED",
  "CAPTURED_OR_STUDIED",
  "UNAVAILABLE",
] as const;
export type ArmamentAccessStatus = (typeof ARMAMENT_ACCESS_STATUSES)[number];

// Entities

/** A shared gun family: the `components.yaml` entry a national model overlays. */
export interface GunFamily {
  readonly id: GunFamilyId;
  readonly designation: string;
  readonly category: ArmamentGunCategory;
  readonly provenance: ArmamentProvenance;
}

/**
 * A national gun model overlaying a shared family. Optional fields are populated only where current
 * content carries the value; the resolver tolerates their absence.
 */
export interface GunModel {
  readonly id: GunModelId;
  readonly familyId: GunFamilyId;
  readonly designation: string;
  /** Bore diameter, micrometres. */
  readonly caliberUm?: number;
  /** Barrel length in calibres (L/number), unitless ratio. Not authored today. */
  readonly barrelLengthCalibers?: number;
  /** Bare gun mass, kilograms (excluding the mount). */
  readonly gunMassKg?: number;
  /** How the gun is loaded/breeched. Not authored today. */
  readonly loadingSystem?: string;
  /** Nominal muzzle velocity, micrometres per second. Not authored today. */
  readonly nominalMuzzleVelocityUmPerSec?: number;
  /** Mechanical rate of fire, hundredths of a round per barrel per minute. */
  readonly mechanicalRateOfFireRoundsPerMinuteX100?: number;
  /** Propellant charge as basis points of shell mass (10000 = charge equals shell mass). */
  readonly propellantChargeBp?: number;
  /** Projectile mass, grams. */
  readonly shellMassG?: number;
  /** Stowed volume of one complete round, millilitres. */
  readonly roundVolumeMl?: number;
  /** Mechanical reliability, basis points (10000 = fully reliable). Not authored today. */
  readonly reliabilityBp?: number;
  /** First month the model is available (YYYY-MM). */
  readonly introductionMonth?: string;
  /** Last month the model is available (YYYY-MM), or null for "until further notice". */
  readonly retirementMonth?: string | null;
  /** Mount types this model may be installed in. */
  readonly supportedMountTypes?: readonly ArmamentMountType[];
  /** Technologies the model requires before it can be installed. */
  readonly requiredTechnologyIds?: readonly ArmamentTechnologyId[];
  readonly provenance: ArmamentProvenance;
}

/**
 * A gun mount definition: the installation, kept separate from the gun model. Optional fields are
 * populated only where current content carries the value.
 */
export interface GunMountDef {
  readonly id: GunMountId;
  readonly mountType: ArmamentMountType;
  /** Gun families this mount accepts. Absent = no family constraint. */
  readonly compatibleGunFamilies?: readonly GunFamilyId[];
  /** Number of guns the mount carries. */
  readonly gunCount: number;
  /** Fixed installation mass (independent of gun count), kilograms. */
  readonly baseInstallationMassKg?: number;
  /** Per-gun installation mass (gun slide/mounting), kilograms. */
  readonly perGunInstallationMassKg?: number;
  /** Above-deck (top-weight) contribution, kilograms. Not authored today. */
  readonly topWeightKg?: number;
  /** Thickest armour the mount supports, millimetres. Not authored today. */
  readonly supportedArmorMm?: number;
  /** Total traverse, degrees. Not authored today. */
  readonly traverseDeg?: number;
  /** Minimum elevation, degrees. Not authored today. */
  readonly elevationMinDeg?: number;
  /** Maximum elevation, degrees. Not authored today. */
  readonly elevationMaxDeg?: number;
  /** Degrees that can bear on one beam before obstruction. */
  readonly firingArcDeg?: number;
  /** Rate-of-fire modifier, basis points (10000 = neutral). Absent = neutral. */
  readonly rateOfFireModifierBp?: number;
  /** Ammunition-handling modifier, basis points (10000 = neutral). Absent = neutral. */
  readonly ammunitionHandlingModifierBp?: number;
  /** Crew-protection classification. Not authored today. */
  readonly crewProtection?: string;
  /** Hull space the mount occupies, litres. Not authored today. */
  readonly hullSpaceUsageLitre?: number;
  /** Stability contribution, kilogram-metres. Not authored today. */
  readonly stabilityContributionKgM?: number;
  /** Vulnerability classification. Not authored today. */
  readonly vulnerability?: string;
  /** First month the mount is available (YYYY-MM). */
  readonly introductionMonth?: string;
  /** Last month the mount is available (YYYY-MM), or null. */
  readonly retirementMonth?: string | null;
  /** Technologies the mount requires. */
  readonly requiredTechnologyIds?: readonly ArmamentTechnologyId[];
  readonly provenance: ArmamentProvenance;
}

/** An ammunition pattern (shell family + effect parameters). */
export interface AmmunitionPattern {
  readonly id: AmmunitionId;
  readonly shellType: ArmamentShellType;
  /** Gun families this pattern fits. Absent = no family constraint. */
  readonly compatibleGunFamilies?: readonly GunFamilyId[];
  /** Gun models this pattern fits. Absent = no model constraint. */
  readonly compatibleGunModelIds?: readonly GunModelId[];
  /** Projectile mass, grams, when it differs from the gun's own shell. */
  readonly shellMassG?: number;
  /** Propellant/muzzle-velocity interaction, basis points. Not authored today. */
  readonly propellantInteractionBp?: number;
  /** Armour-piercing bias 0..10000 (10000 = pure AP, 0 = pure HE). */
  readonly penetrationBiasBp?: number;
  /** Explosive filler, grams. Not authored today. */
  readonly explosiveFillerG?: number;
  /** Bursting-effect parameter, basis points. Not authored today. */
  readonly burstingEffectBp?: number;
  /** Fire-effect parameter, basis points. Not authored today. */
  readonly fireEffectBp?: number;
  /** Storage-hazard classification. Not authored today. */
  readonly storageHazard?: string;
  /** Ammunition cost, budget micro-units per round. Not authored today. */
  readonly ammunitionCostMicro?: number;
  /** Rate-of-fire modifier, basis points (10000 = neutral). Absent = neutral. */
  readonly rateOfFireModifierBp?: number;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly provenance: ArmamentProvenance;
}

// Contexts

/** The technology/date context a resolution is evaluated against. */
export interface ArmamentTechnologyContext {
  /** The campaign month, YYYY-MM. */
  readonly month: string;
  /** Technology ids already unlocked by the nation at that month. */
  readonly unlockedTechnologyIds: ReadonlySet<ArmamentTechnologyId>;
}

/** The national-access context a resolution is evaluated against. */
export interface ArmamentAccessContext {
  readonly nationId: ArmamentNationId;
  /** Component-family id → how the nation obtains it. An absent family defaults to DOMESTIC. */
  readonly componentAccess: Readonly<Record<string, ArmamentAccessStatus>>;
}

// Resolved output

/** One applied modifier, for the "applied modifier breakdown" of a resolved armament. */
export interface AppliedArmamentModifier {
  /** Where the factor came from, e.g. "mount.rateOfFireModifierBp". */
  readonly source: string;
  /** The factor, basis points. */
  readonly valueBp: number;
}

/**
 * A resolved armament. Every value is grounded in the input content or derived unambiguously; a
 * value absent from the content is omitted (undefined) rather than guessed. No combat penetration,
 * hit chance or damage is computed here — only the grounded inputs those later calculations need.
 */
export interface ResolvedArmament {
  readonly gunModelId: GunModelId;
  readonly gunFamilyId: GunFamilyId;
  readonly mountId: GunMountId;
  readonly ammunitionId: AmmunitionId;
  /** Number of guns in the mount. */
  readonly gunCount: number;
  /** Bore diameter, micrometres. */
  readonly caliberUm?: number;
  /** Projectile mass, grams. */
  readonly shellMassG?: number;
  /** Propellant charge as basis points of shell mass (10000 = charge equals shell mass). */
  readonly propellantChargeBp?: number;
  /** Mass of one complete round (shell + propellant), grams. */
  readonly ammunitionUnitMassG?: number;
  /** Stowed volume of one complete round, millilitres. */
  readonly ammunitionUnitVolumeMl?: number;
  /** Nominal muzzle velocity, micrometres per second. */
  readonly nominalMuzzleVelocityUmPerSec?: number;
  /** Mechanical rate of fire, hundredths of a round per barrel per minute. */
  readonly mechanicalRateOfFireRoundsPerMinuteX100?: number;
  /** Composed rate-of-fire modifier, basis points (10000 = neutral). */
  readonly resolvedRateOfFireModifierBp: number;
  /** Bare gun mass per gun, kilograms. */
  readonly gunMassKg?: number;
  /** Mount structure mass (base + per-gun × count), kilograms. */
  readonly mountInstallationMassKg?: number;
  /** Total installation mass (guns + mount structure), kilograms. */
  readonly totalInstallationMassKg?: number;
  /** Above-deck contribution, kilograms. */
  readonly topWeightKg?: number;
  /** Degrees that can bear on one beam before obstruction (from the mount). */
  readonly firingArcDeg?: number;
  /** Hull space the mount occupies, litres. */
  readonly hullSpaceUsageLitre?: number;
  /** Mechanical reliability, basis points. */
  readonly reliabilityBp?: number;
  /** How the nation obtains the gun family. */
  readonly accessStatus: ArmamentAccessStatus;
  readonly provenance: {
    readonly gunModel: ArmamentProvenance;
    readonly mount: ArmamentProvenance;
    readonly ammunition: ArmamentProvenance;
  };
  /** The modifiers actually applied, in a deterministic order. */
  readonly appliedModifiers: readonly AppliedArmamentModifier[];
}
