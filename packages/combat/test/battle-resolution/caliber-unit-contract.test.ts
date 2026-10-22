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

const UK_HEAVY_UM = 343_000;
const FRENCH_HEAVY_UM = 305_000;
const GERMAN_HEAVY_UM = 263_000;
const SECONDARY_UM = 152_000;

describe("caliber unit contract: micrometre boundary", () => {
  it("declares micrometres as the single canonical caliber unit", () => {
    expect(CALIBER_CANONICAL_UNIT).toBe("micrometre");
    expect(MICROMETRES_PER_MILLIMETRE).toBe(1_000);
  });

  it("converts a production caliber to a non-zero micrometre penetration capability", () => {
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
    expect(shellPenetrationUm(UK_HEAVY_UM, v)).toBe(261_366);
    expect(shellPenetrationUm(FRENCH_HEAVY_UM, v)).toBe(232_410);
  });

  it("preserves fractional millimetres with a single floor (no double rounding)", () => {
    expect(shellPenetrationUm(343_000, 762)).toBe(261_366);
    expect(shellPenetrationUm(119_380, 1_000)).toBe(119_380);
  });

  it("is an exact integer, deterministic, and free of input mutation", () => {
    const caliberUm = 343_000;
    const first = shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS);
    expect(Number.isInteger(first)).toBe(true);
    expect(shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS)).toBe(first);
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
    const belt = autoZonesForBelt(305_000)[0]!;
    expect(belt.thicknessUm).toBe(305_000);
    const capability = shellPenetrationUm(UK_HEAVY_UM, SHELL_MUZZLE_VELOCITY_MS);
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
