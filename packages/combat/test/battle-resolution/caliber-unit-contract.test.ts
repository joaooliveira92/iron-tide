/**
 * Canonical caliber unit contract at the armament-to-combat boundary.
 *
 * Compiled armament content authors gun caliber in micrometres (`caliberUm`; 343 mm = 343000 µm).
 * The live auto-resolution penetration model (`battleResolution/damage.ts::shellPenetrationUm`) reads
 * that same micrometre value from `CompiledDesignVersion.mainGunsCaliber`. These are regression
 * guards that the boundary is unit-explicit and exact: a production caliber must produce a non-zero
 * micrometre penetration capability, and the conversion must be a single, exact integer floor.
 *
 * They deliberately do NOT assert historical penetration accuracy: the model is the ADR-0021 linear
 * approximation, retained unchanged.
 */
import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  CALIBER_CANONICAL_UNIT,
  MICROMETRES_PER_MILLIMETRE,
  shellPenetrationUm,
} from "../../src/battleResolution/damage.js";
import {
  SHELL_MUZZLE_VELOCITY_MS,
  autoZonesForBelt,
} from "../../src/battleResolution/constants.js";

// Representative production calibers, in the canonical unit (micrometres).
const UK_HEAVY_UM = 343_000; // 13.5 in — uk_bl_135in_30_mk1
const FRENCH_HEAVY_UM = 305_000; // 12 in — fr_canon_305mm_mle1893
const GERMAN_HEAVY_UM = 263_000; // 26 cm — de_26cm_rk_l20
const SECONDARY_UM = 152_000; // 6 in — uk_qf_6in_40_mk1

describe("caliber unit contract: micrometre boundary", () => {
  it("declares micrometres as the single canonical caliber unit", () => {
    expect(CALIBER_CANONICAL_UNIT).toBe("micrometre");
    expect(MICROMETRES_PER_MILLIMETRE).toBe(1_000);
  });

  it("converts a production caliber to a non-zero micrometre penetration capability", () => {
    // Pre-fix the boundary divided by 1_000_000, so floor(343000 / 1e6) = 0 and every production
    // gun recorded zero penetration. The corrected boundary must never floor a real caliber to 0.
    for (const caliberUm of [UK_HEAVY_UM, FRENCH_HEAVY_UM, GERMAN_HEAVY_UM, SECONDARY_UM]) {
      expect(shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS)).toBeGreaterThan(0);
    }
  });

  it("matches the exact integer formula floor(caliberUm * velocity / 1000)", () => {
    const v = SHELL_MUZZLE_VELOCITY_MS;
    const cases: readonly [number, number][] = [
      [UK_HEAVY_UM, Math.floor((UK_HEAVY_UM * v) / 1_000)],
      [FRENCH_HEAVY_UM, Math.floor((FRENCH_HEAVY_UM * v) / 1_000)],
      [GERMAN_HEAVY_UM, Math.floor((GERMAN_HEAVY_UM * v) / 1_000)],
      [SECONDARY_UM, Math.floor((SECONDARY_UM * v) / 1_000)],
    ];
    for (const [um, expected] of cases) {
      expect(shellPenetrationUm(um, v)).toBe(expected);
    }
    // Pinned production values (762 m/s muzzle velocity, ADR-0026).
    expect(shellPenetrationUm(UK_HEAVY_UM, v)).toBe(261_366);
    expect(shellPenetrationUm(FRENCH_HEAVY_UM, v)).toBe(232_410);
  });

  it("preserves fractional millimetres with a single floor (no double rounding)", () => {
    // 343000 µm = 343 mm exactly; 343 * 762 / 1000 = 261.366 mm = 261366 µm. Rounding at the mm
    // step first would lose the 366 µm remainder; the contract rounds exactly once, at the end.
    expect(shellPenetrationUm(343_000, 762)).toBe(261_366);
    // A non-multiple-of-1000 µm caliber (119380 µm = 119.38 mm) keeps its fractional millimetre.
    expect(shellPenetrationUm(119_380, 1_000)).toBe(119_380);
  });

  it("is an exact integer, deterministic, and free of input mutation", () => {
    const caliberUm = 343_000;
    const first = shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS);
    expect(Number.isInteger(first)).toBe(true);
    expect(shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS)).toBe(first);
    // Repeat with a frozen input: scalars cannot mutate, but assert the helper is pure over its args.
    const mutable = { caliberUm: SafeInt(343_000), velocity: SHELL_MUZZLE_VELOCITY_MS };
    const snapshot = { ...mutable };
    shellPenetrationUm(Number(mutable.caliberUm), mutable.velocity);
    expect(mutable).toEqual(snapshot);
  });

  it("does not reduce base penetration as caliber grows (monotone)", () => {
    const v = SHELL_MUZZLE_VELOCITY_MS;
    let previous = -1;
    for (const caliberUm of [76_000, 120_000, 152_000, 254_000, 305_000, 343_000]) {
      const pen = shellPenetrationUm(caliberUm, v);
      expect(pen).toBeGreaterThanOrEqual(previous);
      previous = pen;
    }
  });

  it("keeps a production caliber comparable to canonical micrometre armor zones", () => {
    // A production belt is authored in µm too; the auto-resolution zone builder must not inflate it.
    const belt = autoZonesForBelt(305_000)[0]!;
    expect(belt.thicknessUm).toBe(305_000);
    const capability = shellPenetrationUm(UK_HEAVY_UM, SHELL_MUZZLE_VELOCITY_MS);
    // Same order of magnitude: both are micrometre thicknesses, so the comparison is meaningful.
    expect(capability).toBeLessThan(belt.thicknessUm * 3);
    expect(capability).toBeGreaterThan(0);
  });

  it("fails structurally for invalid caliber rather than silently flooring to zero", () => {
    expect(() => shellPenetrationUm(0, SHELL_MUZZLE_VELOCITY_MS)).toThrow();
    expect(() => shellPenetrationUm(-1, SHELL_MUZZLE_VELOCITY_MS)).toThrow();
    expect(() => shellPenetrationUm(Number.NaN, SHELL_MUZZLE_VELOCITY_MS)).toThrow();
    expect(() => shellPenetrationUm(Number.POSITIVE_INFINITY, SHELL_MUZZLE_VELOCITY_MS)).toThrow();
  });

  it("does not overflow at the safe caliber/velocity bounds", () => {
    expect(Number.isSafeInteger(shellPenetrationUm(1, 1))).toBe(true);
    expect(Number.isSafeInteger(shellPenetrationUm(660_400, 1_000))).toBe(true);
  });
});
