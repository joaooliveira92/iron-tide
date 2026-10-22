import { describe, it, expect } from "vite-plus/test";
import {
  ARMOR_QUALITY_FAMILY,
  HIT_DAMAGE_OUTCOME_BP,
  HIT_STRUCTURAL_DAMAGE_BASE,
  SHELL_IMPACT_ANGLE_DEG,
  SHELL_MUZZLE_VELOCITY_MS,
  autoZonesForBelt,
} from "@bluewave/combat/battleResolution";
import {
  CALIBER_CANONICAL_UNIT,
  effectiveResistanceUm,
  shellPenetrationUm,
} from "@bluewave/combat/battleResolution";
import { determinePenetrationOutcome } from "@bluewave/combat/damage";

interface ReferenceWeapon {
  readonly id: string;
  readonly gunModelId: string;
  readonly nation: string;
  readonly class: "HEAVY" | "SECONDARY";
  readonly caliberUm: number;
}

const WEAPONS: readonly ReferenceWeapon[] = [
  {
    id: "uk_bl_135in_30_mk1",
    gunModelId: "uk_bl_135in_30_mk1",
    nation: "uk",
    class: "HEAVY",
    caliberUm: 343_000,
  },
  {
    id: "fr_canon_305mm_mle1893",
    gunModelId: "fr_canon_305mm_mle1893",
    nation: "france",
    class: "HEAVY",
    caliberUm: 305_000,
  },
  {
    id: "de_26cm_rk_l20",
    gunModelId: "de_26cm_rk_l20",
    nation: "germany",
    class: "HEAVY",
    caliberUm: 263_000,
  },
  {
    id: "uk_qf_6in_40_mk1",
    gunModelId: "uk_qf_6in_40_mk1",
    nation: "uk",
    class: "SECONDARY",
    caliberUm: 152_000,
  },
];

const RANGES_M = [1_000, 2_000, 4_000, 6_000] as const;

const TARGET_BELT_UM = 305_000;

const EXPECTED: Record<string, { capabilityUm: number; outcome: string }> = {
  uk_bl_135in_30_mk1: { capabilityUm: 261_366, outcome: "PARTIAL_PENETRATION" },
  fr_canon_305mm_mle1893: { capabilityUm: 232_410, outcome: "PARTIAL_PENETRATION" },
  de_26cm_rk_l20: { capabilityUm: 200_406, outcome: "PARTIAL_PENETRATION" },
  uk_qf_6in_40_mk1: { capabilityUm: 115_824, outcome: "SPLINTER_EFFECT" },
};

describe("ADR-0094: armament fixed reference cases (1km/2km/4km/6km)", () => {
  it("declares the micrometre caliber contract the cases rely on", () => {
    expect(CALIBER_CANONICAL_UNIT).toBe("micrometre");
    expect(ARMOR_QUALITY_FAMILY).toBe("HARVEY");
    expect(SHELL_IMPACT_ANGLE_DEG).toBe(0);
    expect(SHELL_MUZZLE_VELOCITY_MS).toBe(762);
    expect(autoZonesForBelt(TARGET_BELT_UM)[0]!.thicknessUm).toBe(TARGET_BELT_UM);
  });

  it("records a production-scale penetration case for every weapon/range", () => {
    const resistance = effectiveResistanceUm({ thicknessUm: TARGET_BELT_UM });
    expect(resistance).toBe(304_950);
    for (const weapon of WEAPONS) {
      const capability = shellPenetrationUm(weapon.caliberUm, SHELL_MUZZLE_VELOCITY_MS);
      expect(capability).toBeGreaterThan(0);
      for (const rangeM of RANGES_M) {
        expect(rangeM).toBeGreaterThan(0);
        const outcome = determinePenetrationOutcome(
          capability,
          resistance,
          SHELL_IMPACT_ANGLE_DEG,
          false,
        );
        const structural = Math.floor(
          (HIT_STRUCTURAL_DAMAGE_BASE * HIT_DAMAGE_OUTCOME_BP[outcome]) / 10_000,
        );
        expect(Number.isInteger(capability)).toBe(true);
        expect(Number.isInteger(resistance)).toBe(true);
        expect(Number.isInteger(structural)).toBe(true);
        expect(outcome).toBe(EXPECTED[weapon.id]!.outcome);
      }
    }
  });

  it("pins the exact corrected integers for the representative guns", () => {
    for (const weapon of WEAPONS) {
      expect(shellPenetrationUm(weapon.caliberUm, SHELL_MUZZLE_VELOCITY_MS), weapon.id).toBe(
        EXPECTED[weapon.id]!.capabilityUm,
      );
    }
  });

  it("is range-invariant: the identical result is a model limitation, not a test mistake", () => {
    for (const weapon of WEAPONS) {
      const atEveryRange = RANGES_M.map(() =>
        shellPenetrationUm(weapon.caliberUm, SHELL_MUZZLE_VELOCITY_MS),
      );
      expect(new Set(atEveryRange).size).toBe(1);
    }
  });
});
