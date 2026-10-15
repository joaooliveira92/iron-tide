import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  BASE_RELOAD_MS_BY_CALIBER,
  GUNNERY_CALIBERS,
  baseReloadMsForCaliber,
  gunneryBallisticsPolicyId,
  type GunneryCaliber,
  SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
  validateGunneryBallisticsContract,
} from "../../src/gunnery/index.js";

// Research table (docs/research/b3-m2-gunnery.md §1): broad caliber ->
// chosen baseReloadMilliseconds. Locked so a drift in either the research note or
// the shipped constant forces review. The 1880s RML heavy-gun caliber is NOT in
// this table: it has no primary-sourced precise integer (sources: "1-5 min/round")
// and ships as an explicit BALANCE TARGET (ADR-0020) — asserted separately.
const RESEARCHED_BASE_RELOAD_MS_BY_CALIBER: Partial<Record<GunneryCaliber, number>> = {
  CAL_6IN_152MM: 7_000,
  CAL_8IN_203MM: 18_000,
  CAL_12IN_305MM: 25_000,
  CAL_14IN_356MM: 36_000,
  CAL_15IN_381MM: 35_000,
  CAL_16IN_406MM: 40_000,
};

describe("AC-5 grounding: research-grounded base-reload-by-caliber constants", () => {
  it("ships the *_v1 policy id and SHIPPED_GUNNERY_BALLISTICS_CONTRACT", () => {
    expect(gunneryBallisticsPolicyId).toBe("gunnery_ballistics_v1");
    expect(SHIPPED_GUNNERY_BALLISTICS_CONTRACT.policyId).toBe("gunnery_ballistics_v1");
  });

  it("the shipped per-caliber values equal the researched table exactly", () => {
    for (const cal of GUNNERY_CALIBERS) {
      if (cal === "CAL_RML_HEAVY_1880") continue; // balance target, asserted separately
      expect(BASE_RELOAD_MS_BY_CALIBER[cal]).toBe(RESEARCHED_BASE_RELOAD_MS_BY_CALIBER[cal]);
      expect(SHIPPED_GUNNERY_BALLISTICS_CONTRACT.baseReloadMsByCaliber[cal]).toBe(
        RESEARCHED_BASE_RELOAD_MS_BY_CALIBER[cal],
      );
    }
    // the 1880s RML heavy-gun caliber is never silently pinned as a research fact
    expect(RESEARCHED_BASE_RELOAD_MS_BY_CALIBER.CAL_RML_HEAVY_1880).toBeUndefined();
  });

  it("every per-caliber value is a positive integer (tactical ms)", () => {
    expect(GUNNERY_CALIBERS.length).toBeGreaterThan(0);
    for (const cal of GUNNERY_CALIBERS) {
      const ms = BASE_RELOAD_MS_BY_CALIBER[cal]!;
      expect(ms).toBeGreaterThan(0);
      expect(Number.isInteger(ms)).toBe(true);
    }
  });

  it("the 1880s RML heavy-gun balance target equals the ADR-0020 midpoint", () => {
    // docs/research/b3-m2-gunnery.md §1: 1880s RML heavy guns are 1-5 min/round
    // (120 000-300 000 ms), NOT fully grounded -> recorded as a BALANCE TARGET at
    // the midpoint 210 000 ms (ADR-0020), never silently pinned as a primary fact
    // (open content-owner decision).
    expect(BASE_RELOAD_MS_BY_CALIBER.CAL_RML_HEAVY_1880).toBe(210_000);
    expect(Number.isInteger(BASE_RELOAD_MS_BY_CALIBER.CAL_RML_HEAVY_1880)).toBe(true);
    expect(SHIPPED_GUNNERY_BALLISTICS_CONTRACT.baseReloadMsByCaliber.CAL_RML_HEAVY_1880).toBe(
      210_000,
    );
  });

  it("baseReloadMsForCaliber returns every shipped caliber's shipped value", () => {
    for (const cal of GUNNERY_CALIBERS) {
      expect(baseReloadMsForCaliber(cal)).toBe(BASE_RELOAD_MS_BY_CALIBER[cal]);
    }
  });

  it("validates the shipped contract without throwing", () => {
    expect(() =>
      validateGunneryBallisticsContract(SHIPPED_GUNNERY_BALLISTICS_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on a tampered per-caliber value", () => {
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        baseReloadMsByCaliber: { ...BASE_RELOAD_MS_BY_CALIBER, CAL_6IN_152MM: 6_000 },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered caliber key set", () => {
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        calibers: [...GUNNERY_CALIBERS].slice(0, 3),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered 1880 RML balance-target value", () => {
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        baseReloadMsByCaliber: { ...BASE_RELOAD_MS_BY_CALIBER, CAL_RML_HEAVY_1880: 60_000 },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a missing contract and drifted versions", () => {
    expect(() => validateGunneryBallisticsContract(null)).toThrow(BluewaveError);
    expect(() => validateGunneryBallisticsContract(undefined)).toThrow(BluewaveError);
    expect(() =>
      validateGunneryBallisticsContract({
        ...SHIPPED_GUNNERY_BALLISTICS_CONTRACT,
        formulaVersion: "next",
      }),
    ).toThrow(BluewaveError);
  });
});
