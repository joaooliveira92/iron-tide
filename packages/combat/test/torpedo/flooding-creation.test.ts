// AC-16 (DESIGN-40 §18): progressive-flooding CREATION —
//   floodingRateKgMin = floor(baseBreachRate * seaPressureMultiplierBp *
//     hullDamageMultiplierBp * compartmentMultiplierBp * isolationMultiplierBp
//     / 10_000^4)
// with the shipped isolation table INTACT 5_000 / DEGRADED 10_000 / FAILED
// 15_000 and the authored base-breach rate (per m², BALANCE TARGET). Creation
// is this slice's ONLY deliverable — nothing ticks a source forward (per-
// minute RESOLUTION is C-5); a zero-rate compartment creates NO source; every
// created source carries TORPEDO_PROGRESSIVE_FLOODING_CREATED and the shape
// matches the B-4 FloodingSourceRecord exactly. The §21 severe-tube extra
// source (rate multiplier 15_000 bp, cause UNDERWATER_TUBE_SEVERE_FLOODING)
// is proven here too.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeBaseBreachRateKgMin,
  computeTorpedoFloodingRateKgMin,
  createSevereTubeFloodingSource,
  resolveTorpedoFloodingCreation,
  TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2,
  TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP,
  TORPEDO_PROGRESSIVE_FLOODING_CREATED,
  UNDERWATER_TUBE_SEVERE_FLOODING,
} from "../../src/torpedoes/index.js";

describe("AC-16: base breach rate from the hull-breach area", () => {
  it("computes floor(areaM2 × shipped rate)", () => {
    expect(TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2).toBe(1_000);
    expect(computeBaseBreachRateKgMin(30)).toBe(30_000); // a cruiser-scale breach
    expect(computeBaseBreachRateKgMin(53)).toBe(53_000); // North Carolina scale
    expect(computeBaseBreachRateKgMin(0)).toBe(0); // no breach -> no rate
  });

  it("rejects malformed areas (fail closed)", () => {
    expect(() => computeBaseBreachRateKgMin(30.5)).toThrow(BluewaveError);
    expect(() => computeBaseBreachRateKgMin(-1)).toThrow(BluewaveError);
  });
});

describe("AC-16: the exact §18 flooding-rate formula", () => {
  // floor(base × sea × hull × compartment × isolation / 10_000^4). The
  // sea/hull/compartment factors default to the neutral 10_000.
  it("ships the exact isolation multiplier table", () => {
    expect(TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP).toEqual({
      INTACT: 5_000,
      DEGRADED: 10_000,
      FAILED: 15_000,
    });
  });

  it("applies the four-factor product with one FLOOR", () => {
    // base 20_000 kg/min, intact isolation (5_000), neutral rest:
    // floor(20_000 × 10_000³ × 5_000 / 10_000^4) = floor(10_000) = 10_000
    expect(
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 20_000,
        isolationState: "INTACT",
      }),
    ).toBe(10_000);
    // FAILED isolation (15_000): floor(20_000 × 15_000 / 10_000) = 30_000
    expect(
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 20_000,
        isolationState: "FAILED",
      }),
    ).toBe(30_000);
    // DEGRADED (10_000) is the straight line: 20_000.
    expect(
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 20_000,
        isolationState: "DEGRADED",
      }),
    ).toBe(20_000);
  });

  it("every factor is a multiplier (all four scale the rate exactly)", () => {
    const base = 10_000;
    const sea = 12_500;
    const hull = 9_000;
    const comp = 11_000;
    // floor(10_000 × 12_500 × 9_000 × 11_000 × 5_000 / 10_000^4):
    // numerator = 10_000 · 12_500 · 9_000 · 11_000 · 5_000 = 6.1875e19;
    // 10_000^4 = 1e16 -> floor(6_187.5) = 6_187
    const heavy = computeTorpedoFloodingRateKgMin({
      baseBreachRateKgMin: base,
      seaPressureMultiplierBp: sea,
      hullDamageMultiplierBp: hull,
      compartmentMultiplierBp: comp,
      isolationState: "INTACT",
    });
    expect(heavy).toBe(6_187);
    // the neutral sea/hull/compartment trigger no change: 5_000.
    expect(
      computeTorpedoFloodingRateKgMin({ baseBreachRateKgMin: 10_000, isolationState: "INTACT" }),
    ).toBe(5_000);
  });

  it("rejects non-integer / out-of-band multipliers (fail closed)", () => {
    expect(() =>
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 10_000,
        isolationState: "INTACT",
        seaPressureMultiplierBp: 1.5,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 10_000,
        isolationState: "INTACT",
        hullDamageMultiplierBp: -1,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 10_000,
        isolationState: "INTACT",
        compartmentMultiplierBp: 100_001,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoFloodingRateKgMin({ baseBreachRateKgMin: 10_000.5, isolationState: "INTACT" }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-16: flood-source CREATION (creation-only)", () => {
  it("creates one FloodingSourceRecord per compartment with the computed rate + cause", () => {
    const sources = resolveTorpedoFloodingCreation({
      compartments: [
        { compartmentId: "ENG-ROOM-A", baseBreachRateKgMin: 30_000, isolationState: "INTACT" },
        { compartmentId: "ENG-ROOM-B", baseBreachRateKgMin: 30_000, isolationState: "FAILED" },
      ],
    });
    expect(sources).toEqual([
      {
        compartmentId: "ENG-ROOM-A",
        rateKgMin: 15_000,
        cause: TORPEDO_PROGRESSIVE_FLOODING_CREATED,
      },
      {
        compartmentId: "ENG-ROOM-B",
        rateKgMin: 45_000,
        cause: TORPEDO_PROGRESSIVE_FLOODING_CREATED,
      },
    ]);
    for (const s of sources) {
      expect(Object.isFrozen(s)).toBe(true);
    }
    expect(Object.isFrozen(sources)).toBe(true);
  });

  it("a zero-rate compartment creates NO source (zero or more records)", () => {
    const sources = resolveTorpedoFloodingCreation({
      compartments: [
        { compartmentId: "SEALED-VOID", baseBreachRateKgMin: 0, isolationState: "INTACT" },
        { compartmentId: "BREACH", baseBreachRateKgMin: 500, isolationState: "INTACT" },
      ],
    });
    // floor(500 × 10_000³ × 5_000 / 10_000^4) = floor(250) = 250 > 0, while
    // the sealed void computes 0 → only the breach compartment creates a source
    expect(sources).toHaveLength(1);
    expect(sources[0].compartmentId).toBe("BREACH");
  });

  it("an empty compartment list creates zero sources", () => {
    expect(resolveTorpedoFloodingCreation({ compartments: [] })).toEqual([]);
  });

  it("is CREATION-ONLY — no per-minute resolution field or loop exists", () => {
    const sources = resolveTorpedoFloodingCreation({
      compartments: [
        { compartmentId: "HOLD-1", baseBreachRateKgMin: 10_000, isolationState: "DEGRADED" },
      ],
    });
    // the record surface is exactly { compartmentId, rateKgMin, cause }.
    expect(Object.keys(sources[0]).sort()).toEqual(["cause", "compartmentId", "rateKgMin"]);
  });

  it("rejects malformed compartment inputs (fail closed)", () => {
    expect(() =>
      resolveTorpedoFloodingCreation({
        compartments: [{ compartmentId: "", baseBreachRateKgMin: 1 }],
      }),
    ).toThrow(BluewaveError);
    expect(() => resolveTorpedoFloodingCreation({ compartments: "nope" as never })).toThrow(
      BluewaveError,
    );
  });
});

describe("AC-18 §21: the severe-tube extra flooding source", () => {
  it("creates ONE extra source at the shipped rate multiplier 15_000 bp", () => {
    const source = createSevereTubeFloodingSource({
      compartmentId: "TUBE-BAY-1",
      baseProgressiveRateKgMin: 10_000,
    });
    // floor(10_000 × 15_000 / 10_000) = 15_000
    expect(source).toEqual({
      compartmentId: "TUBE-BAY-1",
      rateKgMin: 15_000,
      cause: UNDERWATER_TUBE_SEVERE_FLOODING,
    });
    expect(Object.isFrozen(source)).toBe(true);
  });

  it("rejects malformed inputs", () => {
    expect(() =>
      createSevereTubeFloodingSource({ compartmentId: "", baseProgressiveRateKgMin: 1 }),
    ).toThrow(BluewaveError);
    expect(() =>
      createSevereTubeFloodingSource({ compartmentId: "X", baseProgressiveRateKgMin: 0.5 }),
    ).toThrow(BluewaveError);
  });
});
