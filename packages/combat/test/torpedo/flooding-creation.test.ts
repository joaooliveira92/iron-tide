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
} from "@bluewave/combat/torpedoes";

describe("AC-16: base breach rate from the hull-breach area", () => {
  it("computes floor(areaM2 × shipped rate)", () => {
    expect(TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2).toBe(1_000);
    expect(computeBaseBreachRateKgMin(30)).toBe(30_000);
    expect(computeBaseBreachRateKgMin(53)).toBe(53_000);
    expect(computeBaseBreachRateKgMin(0)).toBe(0);
  });

  it("rejects malformed areas (fail closed)", () => {
    expect(() => computeBaseBreachRateKgMin(30.5)).toThrow(BluewaveError);
    expect(() => computeBaseBreachRateKgMin(-1)).toThrow(BluewaveError);
  });
});

describe("AC-16: the exact §18 flooding-rate formula", () => {
  it("ships the exact isolation multiplier table", () => {
    expect(TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP).toEqual({
      INTACT: 5_000,
      DEGRADED: 10_000,
      FAILED: 15_000,
    });
  });

  it("applies the four-factor product with one FLOOR", () => {
    expect(
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 20_000,
        isolationState: "INTACT",
      }),
    ).toBe(10_000);
    expect(
      computeTorpedoFloodingRateKgMin({
        baseBreachRateKgMin: 20_000,
        isolationState: "FAILED",
      }),
    ).toBe(30_000);
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
    const heavy = computeTorpedoFloodingRateKgMin({
      baseBreachRateKgMin: base,
      seaPressureMultiplierBp: sea,
      hullDamageMultiplierBp: hull,
      compartmentMultiplierBp: comp,
      isolationState: "INTACT",
    });
    expect(heavy).toBe(6_187);
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
