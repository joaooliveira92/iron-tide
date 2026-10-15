import { describe, it, expect } from "vite-plus/test";
import {
  ammunitionId,
  armamentNationId,
  armamentTechnologyId,
  gunFamilyId,
  gunModelId,
  gunMountId,
  resolveArmament,
  type AmmunitionPattern,
  type ArmamentAccessContext,
  type ArmamentProvenance,
  type ArmamentTechnologyContext,
  type GunModel,
  type GunMountDef,
} from "@bluewave/armament";

/**
 * Contract proof (ADR-0093): `@bluewave/combat` can consume the authoritative armament resolver
 * directly, without depending on `@bluewave/ship-design`. The only workspace import in this file is
 * `@bluewave/armament`.
 */

const provenance: ArmamentProvenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "combat contract fixture" }],
};

const gunModel: GunModel = {
  id: gunModelId("battle_gun"),
  familyId: gunFamilyId("battle_family"),
  designation: "Battle Gun",
  caliberUm: 305_000,
  gunMassKg: 44_500,
  shellMassG: 324_000,
  propellantChargeBp: 4_136,
  mechanicalRateOfFireRoundsPerMinuteX100: 40,
  introductionMonth: "1885-01",
  retirementMonth: null,
  supportedMountTypes: ["BARBETTE"],
  requiredTechnologyIds: [armamentTechnologyId("gun_breech_rifled")],
  provenance,
};

const mount: GunMountDef = {
  id: gunMountId("battle_mount"),
  mountType: "BARBETTE",
  compatibleGunFamilies: [gunFamilyId("battle_family")],
  gunCount: 2,
  baseInstallationMassKg: 20_000,
  perGunInstallationMassKg: 30_000,
  introductionMonth: "1885-01",
  retirementMonth: null,
  requiredTechnologyIds: [],
  provenance,
};

const ammunition: AmmunitionPattern = {
  id: ammunitionId("battle_ap"),
  shellType: "AP",
  penetrationBiasBp: 9_000,
  provenance,
};

const technologyContext: ArmamentTechnologyContext = {
  month: "1890-01",
  unlockedTechnologyIds: new Set([armamentTechnologyId("gun_breech_rifled")]),
};

const accessContext: ArmamentAccessContext = {
  nationId: armamentNationId("uk"),
  componentAccess: { battle_family: "DOMESTIC" },
};

describe("combat consumes the armament resolver without ship-design", () => {
  it("resolves a representative main-battery combination", () => {
    const result = resolveArmament(gunModel, mount, ammunition, technologyContext, accessContext);
    expect(result.ok).toBe(true);
    expect(result.resolved!.totalInstallationMassKg).toBe(2 * 44_500 + 20_000 + 2 * 30_000);
  });

  it("returns structured findings for an out-of-date combination", () => {
    const result = resolveArmament(
      gunModel,
      mount,
      ammunition,
      { ...technologyContext, month: "1880-01" },
      accessContext,
    );
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain("ARMAMENT_BEFORE_INTRODUCTION");
  });
});
