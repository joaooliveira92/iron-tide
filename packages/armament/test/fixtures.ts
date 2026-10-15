import {
  ammunitionId,
  armamentNationId,
  armamentTechnologyId,
  gunFamilyId,
  gunModelId,
  gunMountId,
  type AmmunitionPattern,
  type ArmamentAccessContext,
  type ArmamentProvenance,
  type ArmamentTechnologyContext,
  type GunModel,
  type GunMountDef,
} from "../src/index.js";

export const provenance = (overrides: Partial<ArmamentProvenance> = {}): ArmamentProvenance => ({
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
  ...overrides,
});

export const gunModel = (overrides: Partial<GunModel> = {}): GunModel => ({
  id: gunModelId("test_gun"),
  familyId: gunFamilyId("test_family"),
  designation: "Test Gun",
  caliberUm: 152_000,
  gunMassKg: 5_000,
  shellMassG: 45_000,
  propellantChargeBp: 4_800,
  roundVolumeMl: 30_000,
  mechanicalRateOfFireRoundsPerMinuteX100: 400,
  reliabilityBp: 9_000,
  introductionMonth: "1880-01",
  retirementMonth: null,
  supportedMountTypes: ["TURRET", "BARBETTE"],
  requiredTechnologyIds: [armamentTechnologyId("gun_breech_rifled")],
  provenance: provenance(),
  ...overrides,
});

export const mount = (overrides: Partial<GunMountDef> = {}): GunMountDef => ({
  id: gunMountId("test_mount"),
  mountType: "TURRET",
  compatibleGunFamilies: [gunFamilyId("test_family")],
  gunCount: 2,
  baseInstallationMassKg: 1_800,
  perGunInstallationMassKg: 7_600,
  firingArcDeg: 150,
  introductionMonth: "1880-01",
  retirementMonth: null,
  requiredTechnologyIds: [],
  provenance: provenance(),
  ...overrides,
});

export const ammunition = (overrides: Partial<AmmunitionPattern> = {}): AmmunitionPattern => ({
  id: ammunitionId("test_ap"),
  shellType: "AP",
  penetrationBiasBp: 9_000,
  provenance: provenance(),
  ...overrides,
});

export const technologyContext = (
  overrides: Partial<ArmamentTechnologyContext> = {},
): ArmamentTechnologyContext => ({
  month: "1885-01",
  unlockedTechnologyIds: new Set([armamentTechnologyId("gun_breech_rifled")]),
  ...overrides,
});

export const accessContext = (
  overrides: Partial<ArmamentAccessContext> = {},
): ArmamentAccessContext => ({
  nationId: armamentNationId("uk"),
  componentAccess: { test_family: "DOMESTIC" },
  ...overrides,
});
