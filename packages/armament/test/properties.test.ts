import { describe, it, expect } from "vite-plus/test";
import { resolveArmament, type ArmamentResolutionResult } from "../src/index.js";
import { accessContext, ammunition, gunModel, mount, technologyContext } from "./fixtures.js";

/** Deterministic mulberry32 PRNG: reproducible bounded fixtures without a new dependency. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, values: readonly T[]): T =>
  values[Math.floor(rng() * values.length)]!;

/** Reference composition of n bp multipliers, rounded half up once (independent of the resolver). */
function referenceCompose(factors: readonly number[]): number {
  if (factors.length === 0) return 10_000;
  let num = 1n;
  for (const f of factors) num *= BigInt(f);
  const den = 10_000n ** BigInt(factors.length - 1);
  return Number((2n * num + den) / (2n * den));
}

describe("resolveArmament — bounded property fixtures", () => {
  const rng = mulberry32(0x5eed);
  const cases = Array.from({ length: 400 }, () => {
    const caliberUm = pick(rng, [1, 47_000, 152_000, 305_000, 406_000]);
    const shellMassG = pick(rng, [0, 206, 1_500, 45_000, 764_000]);
    const chargeBp = pick(rng, [0, 882, 2_670, 4_800]);
    const rof = pick(rng, [1, 30, 400, 20_000]);
    const gunCount = pick(rng, [1, 2, 4, 6]);
    const baseMass = pick(rng, [0, 1_800, 25_000]);
    const perGunMass = pick(rng, [0, 7_600, 40_000]);
    const modifiers = [
      pick(rng, [5_000, 10_000, 12_000]),
      pick(rng, [0, 9_000, 10_000]),
      pick(rng, [8_000, 10_000]),
    ];
    return { caliberUm, shellMassG, chargeBp, rof, gunCount, baseMass, perGunMass, modifiers };
  });

  it("never throws and always returns a structured result", () => {
    for (const c of cases) {
      const r = resolveArmament(
        gunModel({
          caliberUm: c.caliberUm,
          shellMassG: c.shellMassG,
          propellantChargeBp: c.chargeBp,
          mechanicalRateOfFireRoundsPerMinuteX100: c.rof,
        }),
        mount({
          gunCount: c.gunCount,
          baseInstallationMassKg: c.baseMass,
          perGunInstallationMassKg: c.perGunMass,
          rateOfFireModifierBp: c.modifiers[0],
          ammunitionHandlingModifierBp: c.modifiers[1],
        }),
        ammunition({ rateOfFireModifierBp: c.modifiers[2] }),
        technologyContext(),
        accessContext(),
      );
      expect(typeof r.ok).toBe("boolean");
      expect(Array.isArray(r.findings)).toBe(true);
    }
  });

  it("resolved numeric fields are safe, non-negative integers within range", () => {
    for (const c of cases) {
      const r = resolveArmament(
        gunModel({
          caliberUm: c.caliberUm,
          shellMassG: c.shellMassG,
          propellantChargeBp: c.chargeBp,
          mechanicalRateOfFireRoundsPerMinuteX100: c.rof,
        }),
        mount({
          gunCount: c.gunCount,
          baseInstallationMassKg: c.baseMass,
          perGunInstallationMassKg: c.perGunMass,
          rateOfFireModifierBp: c.modifiers[0],
          ammunitionHandlingModifierBp: c.modifiers[1],
        }),
        ammunition({ rateOfFireModifierBp: c.modifiers[2] }),
        technologyContext(),
        accessContext(),
      );
      expect(r.ok).toBe(true);
      const v = r.resolved!;
      expect(Number.isSafeInteger(v.ammunitionUnitMassG)).toBe(true);
      expect(v.ammunitionUnitMassG!).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(v.totalInstallationMassKg)).toBe(true);
      expect(v.totalInstallationMassKg!).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(v.resolvedRateOfFireModifierBp)).toBe(true);
      expect(v.resolvedRateOfFireModifierBp).toBeGreaterThanOrEqual(0);
    }
  });

  it("modifier composition and mass arithmetic match an independent exact reference", () => {
    for (const c of cases) {
      const r = resolveArmament(
        gunModel({ shellMassG: c.shellMassG, propellantChargeBp: c.chargeBp, gunMassKg: 5_000 }),
        mount({
          gunCount: c.gunCount,
          baseInstallationMassKg: c.baseMass,
          perGunInstallationMassKg: c.perGunMass,
          rateOfFireModifierBp: c.modifiers[0],
          ammunitionHandlingModifierBp: c.modifiers[1],
        }),
        ammunition({ rateOfFireModifierBp: c.modifiers[2] }),
        technologyContext(),
        accessContext(),
      );
      const v = r.resolved!;
      expect(v.resolvedRateOfFireModifierBp).toBe(referenceCompose(c.modifiers));
      const expectedUnitMass = Number(
        (BigInt(c.shellMassG) * BigInt(10_000 + c.chargeBp) + 5_000n) / 10_000n,
      );
      expect(v.ammunitionUnitMassG).toBe(expectedUnitMass);
      expect(v.totalInstallationMassKg).toBe(
        5_000 * c.gunCount + c.baseMass + c.perGunMass * c.gunCount,
      );
    }
  });

  it("is deterministic for every fixture", () => {
    for (const c of cases) {
      const build = (): ArmamentResolutionResult =>
        resolveArmament(
          gunModel({ caliberUm: c.caliberUm }),
          mount({ gunCount: c.gunCount, rateOfFireModifierBp: c.modifiers[0] }),
          ammunition({ rateOfFireModifierBp: c.modifiers[2] }),
          technologyContext(),
          accessContext(),
        );
      expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    }
  });
});
