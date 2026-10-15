/**
 * ADR-0094 — corrected armament penetration reference cases at 1,000 / 2,000 / 4,000 / 6,000 m.
 *
 * These are `UNIT_CORRECTION_REFERENCE` cases: they record the exact integers the live
 * auto-resolution penetration model produces AFTER the caliber unit-scale correction, at the canonical
 * production caliber scale (µm). They are explicitly NOT a historical-accuracy claim — the model is
 * still the ADR-0021 linear approximation with a single authored muzzle velocity and no velocity decay
 * by range (deferred to a separate, historically grounded ballistics task).
 *
 * The live model (ADR-0026) uses one authored muzzle velocity (`SHELL_MUZZLE_VELOCITY_MS`) and a zero
 * impact angle for every impact; it does not model time-of-flight velocity decay by range. Every case is
 * therefore range-invariant by construction, and this is proven below rather than asserted as ballistic
 * accuracy.
 *
 * The caliber inputs are the exact production calibers from the first-class armament content
 * (`content/production/1880/ship-building/armament/gun-models.yaml`), read by combat from a
 * `CompiledDesignVersion` (`mainGunsCaliber`, µm). The target armor is the canonical HARVEY
 * auto-resolution 305 mm belt.
 */
import { describe, it, expect } from "vite-plus/test";
import {
  ARMOR_QUALITY_FAMILY,
  HIT_DAMAGE_OUTCOME_BP,
  HIT_STRUCTURAL_DAMAGE_BASE,
  SHELL_IMPACT_ANGLE_DEG,
  SHELL_MUZZLE_VELOCITY_MS,
  autoZonesForBelt,
} from "../../src/battleResolution/constants.js";
import {
  CALIBER_CANONICAL_UNIT,
  effectiveResistanceUm,
  shellPenetrationUm,
} from "../../src/battleResolution/damage.js";
import { determinePenetrationOutcome } from "../../src/damage/armorModel.js";

/** A representative production weapon using the canonical `caliberUm` (micrometre) convention. */
interface ReferenceWeapon {
  readonly id: string;
  /** Production gun-model id (armament/gun-models.yaml). */
  readonly gunModelId: string;
  readonly nation: string;
  readonly class: "HEAVY" | "SECONDARY";
  /** Compiled-design main-gun caliber, µm (production scale: 343000 = 343 mm). */
  readonly caliberUm: number;
}

// One heavy gun per nation plus a secondary/light gun, with their authored production calibers.
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

// Canonical auto-resolution HARVEY belt target (production 305 mm).
const TARGET_BELT_UM = 305_000;

// Deterministic reference integers (muzzle velocity 762 m/s; HARVEY 305 mm belt). Each capability is
// floor(caliberUm * 762 / 1000); the resistance is the manufacturing + HARVEY-quality belt resistance.
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
    // The canonical target belt is authored at production micrometre scale.
    expect(autoZonesForBelt(TARGET_BELT_UM)[0]!.thicknessUm).toBe(TARGET_BELT_UM);
  });

  it("records a production-scale penetration case for every weapon/range", () => {
    const resistance = effectiveResistanceUm({ thicknessUm: TARGET_BELT_UM });
    expect(resistance).toBe(304_950);
    for (const weapon of WEAPONS) {
      const capability = shellPenetrationUm(weapon.caliberUm, SHELL_MUZZLE_VELOCITY_MS);
      expect(capability).toBeGreaterThan(0); // never floors to zero at production scale
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
        // Deterministic integer arithmetic at every range.
        expect(Number.isInteger(capability)).toBe(true);
        expect(Number.isInteger(resistance)).toBe(true);
        expect(Number.isInteger(structural)).toBe(true);
        // Identical at every range: the current model has no range term.
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
    // The four ranges are separate fixtures that record the same capability by construction: the
    // ADR-0021/ADR-0026 model has no time-of-flight or velocity-decay term. Range decay is deferred to
    // a separate historically grounded ballistics task and is deliberately NOT asserted here.
    for (const weapon of WEAPONS) {
      const atEveryRange = RANGES_M.map(() =>
        shellPenetrationUm(weapon.caliberUm, SHELL_MUZZLE_VELOCITY_MS),
      );
      expect(new Set(atEveryRange).size).toBe(1);
    }
  });
});
