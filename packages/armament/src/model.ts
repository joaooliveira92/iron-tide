import type {
  AmmunitionId,
  ArmamentNationId,
  ArmamentTechnologyId,
  GunFamilyId,
  GunModelId,
  GunMountId,
} from "./ids.js";
import type { ArmamentProvenance } from "./provenance.js";

export const ARMAMENT_GUN_CATEGORIES = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
] as const;
export type ArmamentGunCategory = (typeof ARMAMENT_GUN_CATEGORIES)[number];

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

export const ARMAMENT_SHELL_TYPES = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;
export type ArmamentShellType = (typeof ARMAMENT_SHELL_TYPES)[number];

export const ARMAMENT_ACCESS_STATUSES = [
  "DOMESTIC",
  "LICENSE_BUILT",
  "IMPORTED",
  "CAPTURED_OR_STUDIED",
  "UNAVAILABLE",
] as const;
export type ArmamentAccessStatus = (typeof ARMAMENT_ACCESS_STATUSES)[number];

export interface GunFamily {
  readonly id: GunFamilyId;
  readonly designation: string;
  readonly category: ArmamentGunCategory;
  readonly provenance: ArmamentProvenance;
}

export interface GunModel {
  readonly id: GunModelId;
  readonly familyId: GunFamilyId;
  readonly designation: string;
  readonly caliberUm?: number;
  readonly barrelLengthCalibers?: number;
  readonly gunMassKg?: number;
  readonly loadingSystem?: string;
  readonly nominalMuzzleVelocityUmPerSec?: number;
  readonly mechanicalRateOfFireRoundsPerMinuteX100?: number;
  readonly propellantChargeBp?: number;
  readonly shellMassG?: number;
  readonly roundVolumeMl?: number;
  readonly reliabilityBp?: number;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly supportedMountTypes?: readonly ArmamentMountType[];
  readonly requiredTechnologyIds?: readonly ArmamentTechnologyId[];
  readonly provenance: ArmamentProvenance;
}

export interface GunMountDef {
  readonly id: GunMountId;
  readonly mountType: ArmamentMountType;
  readonly compatibleGunFamilies?: readonly GunFamilyId[];
  readonly gunCount: number;
  readonly baseInstallationMassKg?: number;
  readonly perGunInstallationMassKg?: number;
  readonly topWeightKg?: number;
  readonly supportedArmorMm?: number;
  readonly traverseDeg?: number;
  readonly elevationMinDeg?: number;
  readonly elevationMaxDeg?: number;
  readonly firingArcDeg?: number;
  readonly rateOfFireModifierBp?: number;
  readonly ammunitionHandlingModifierBp?: number;
  readonly crewProtection?: string;
  readonly hullSpaceUsageLitre?: number;
  readonly stabilityContributionKgM?: number;
  readonly vulnerability?: string;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly requiredTechnologyIds?: readonly ArmamentTechnologyId[];
  readonly provenance: ArmamentProvenance;
}

export interface AmmunitionPattern {
  readonly id: AmmunitionId;
  readonly shellType: ArmamentShellType;
  readonly compatibleGunFamilies?: readonly GunFamilyId[];
  readonly compatibleGunModelIds?: readonly GunModelId[];
  readonly shellMassG?: number;
  readonly propellantInteractionBp?: number;
  readonly penetrationBiasBp?: number;
  readonly explosiveFillerG?: number;
  readonly burstingEffectBp?: number;
  readonly fireEffectBp?: number;
  readonly storageHazard?: string;
  readonly ammunitionCostMicro?: number;
  readonly rateOfFireModifierBp?: number;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly provenance: ArmamentProvenance;
}

export interface ArmamentTechnologyContext {
  readonly month: string;
  readonly unlockedTechnologyIds: ReadonlySet<ArmamentTechnologyId>;
}

export interface ArmamentAccessContext {
  readonly nationId: ArmamentNationId;
  readonly componentAccess: Readonly<Record<string, ArmamentAccessStatus>>;
}

export interface AppliedArmamentModifier {
  readonly source: string;
  readonly valueBp: number;
}

export interface ResolvedArmament {
  readonly gunModelId: GunModelId;
  readonly gunFamilyId: GunFamilyId;
  readonly mountId: GunMountId;
  readonly ammunitionId: AmmunitionId;
  readonly gunCount: number;
  readonly caliberUm?: number;
  readonly shellMassG?: number;
  readonly propellantChargeBp?: number;
  readonly ammunitionUnitMassG?: number;
  readonly ammunitionUnitVolumeMl?: number;
  readonly nominalMuzzleVelocityUmPerSec?: number;
  readonly mechanicalRateOfFireRoundsPerMinuteX100?: number;
  readonly resolvedRateOfFireModifierBp: number;
  readonly gunMassKg?: number;
  readonly mountInstallationMassKg?: number;
  readonly totalInstallationMassKg?: number;
  readonly topWeightKg?: number;
  readonly firingArcDeg?: number;
  readonly hullSpaceUsageLitre?: number;
  readonly reliabilityBp?: number;
  readonly accessStatus: ArmamentAccessStatus;
  readonly provenance: {
    readonly gunModel: ArmamentProvenance;
    readonly mount: ArmamentProvenance;
    readonly ammunition: ArmamentProvenance;
  };
  readonly appliedModifiers: readonly AppliedArmamentModifier[];
}
