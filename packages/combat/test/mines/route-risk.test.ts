import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  type AreaMinePressureRecord,
  computeRouteRiskBp,
  INVALID_MINE_PRESSURE_STATE,
  MINE_ROUTE_RISK_CREATED,
  MINE_ROUTE_RISK_DENOMINATOR,
  MINE_ROUTE_RISK_MAX_BP,
  routeExposureMultiplierBp,
  routeExposureMultiplierBpFor,
  ROUTE_EXPOSURE_MULTIPLIERS_BP,
  routeRiskBpToAllocationPriority,
  routeRiskPolicyId,
  SHIPPED_MINE_ROUTE_RISK_CONTRACT,
  type SweepingAllocationCandidate,
  sweepingAllocationOrder,
  validateMineRouteRiskContract,
} from "@bluewave/combat/mines";

function risk(pressure: number, freshness: number, exposure: number, susceptibility: number) {
  return computeRouteRiskBp(SafeInt(pressure), SafeInt(freshness), exposure, susceptibility);
}

describe("AC-12: exact §13 formula — bigint product, ONE FLOOR, clamp to 10_000", () => {
  it("collapsed max vector clamps at 10_000 (1_000_000 × 10_000² × 10_000 = 10_000bp)", () => {
    const res = risk(1_000_000, 10_000, 10_000, 10_000);
    expect(res.routeRiskBp).toBe(SafeInt(10_000));
    expect(res.riskFlag).toBe(MINE_ROUTE_RISK_CREATED);
  });

  it("open-sea exposure (5_000) halves the max risk to 5_000", () => {
    expect(risk(1_000_000, 10_000, 5_000, 10_000).routeRiskBp).toBe(SafeInt(5_000));
  });

  it("bigint bound: numerator 1e17 exceeds MAX_SAFE_INTEGER yet resolves exactly (10_000 × 10_000 × 1_000 = 1_000)", () => {
    const res = risk(1_000_000, 10_000, 10_000, 1_000);
    expect(res.routeRiskBp).toBe(SafeInt(1_000));
    expect(res.riskFlag).toBe(MINE_ROUTE_RISK_CREATED);
  });

  it("clamp: 15_000bp raw risk caps at 10_000", () => {
    const res = risk(1_000_000, 10_000, 15_000, 10_000);
    expect(res.routeRiskBp).toBe(SafeInt(10_000));
  });

  it("ONE FLOOR, never ceil: exact rational 1.5 -> 1 (not 2)", () => {
    const res = risk(500_000, 10_000, 10_000, 3);
    expect(res.routeRiskBp).toBe(SafeInt(1));
    expect(res.riskFlag).toBe(MINE_ROUTE_RISK_CREATED);
  });

  it("fractional sub-1 risk floors to 0 and emits no flag", () => {
    const res = risk(3, 1, 5_000, 1);
    expect(res.routeRiskBp).toBe(SafeInt(0));
    expect(res.riskFlag).toBeNull();
  });

  it("zero pressure (no minefield) yields 0 risk and no flag", () => {
    expect(risk(0, 10_000, 10_000, 10_000)).toEqual({ routeRiskBp: SafeInt(0), riskFlag: null });
  });

  it("exposes the exact §13 10^14 denominator", () => {
    expect(MINE_ROUTE_RISK_DENOMINATOR).toBe(100_000_000_000_000n);
  });
});

describe("AC-12: exact shipped route-exposure multipliers", () => {
  it("the §13 literal table is exact", () => {
    expect(ROUTE_EXPOSURE_MULTIPLIERS_BP).toEqual({
      OPEN_SEA_EDGE: 5_000,
      COASTAL_PASSAGE: 10_000,
      CANAL_APPROACH: 15_000,
      CHOKE_POINT: 15_000,
      PORT_APPROACH: 12_500,
    });
  });

  it("typed lookup (closed union) is total", () => {
    expect(routeExposureMultiplierBpFor("OPEN_SEA_EDGE")).toBe(5_000);
    expect(routeExposureMultiplierBpFor("COASTAL_PASSAGE")).toBe(10_000);
    expect(routeExposureMultiplierBpFor("CANAL_APPROACH")).toBe(15_000);
    expect(routeExposureMultiplierBpFor("CHOKE_POINT")).toBe(15_000);
    expect(routeExposureMultiplierBpFor("PORT_APPROACH")).toBe(12_500);
  });

  it("fail-closed unverified lookup: valid key resolves, unknown key throws (never a silent default)", () => {
    expect(routeExposureMultiplierBp("PORT_APPROACH")).toBe(12_500);
    for (const bad of ["UNKNOWN_EDGE", "", "open-sea", "Port_Approach"]) {
      let err: BluewaveError | undefined;
      try {
        routeExposureMultiplierBp(bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });
});

describe("AC-12: invalid inputs are rejected fail-closed", () => {
  it("rejects out-of-range / non-integer inputs with INVALID_MINE_PRESSURE_STATE", () => {
    const bad: Array<() => unknown> = [
      () => risk(-1, 5_000, 10_000, 10_000),
      () => risk(1_000_001, 5_000, 10_000, 10_000),
      () => risk(500_000, -1, 10_000, 10_000),
      () => risk(500_000, 10_001, 10_000, 10_000),
      () => risk(500_000, 5_000, -1, 10_000),
      () => risk(500_000, 5_000, 15_001, 10_000),
      () => risk(500_000, 5_000, 7_500.5, 10_000),
      () => risk(500_000, 5_000, 10_000, -1),
      () => risk(500_000, 5_000, 10_000, 10_001),
    ];
    for (const call of bad) {
      let err: BluewaveError | undefined;
      try {
        call();
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });

  it("accepts the full closed valid ranges", () => {
    expect(risk(1_000_000, 10_000, 15_000, 10_000).routeRiskBp).toBe(SafeInt(10_000));
    expect(risk(1, 1, 0, 0).routeRiskBp).toBe(SafeInt(0));
  });
});

describe("AC-12: mine_route_risk_v1 contract + fail-closed guard", () => {
  it("the shipped contract passes its own validation (runs at load, no throw)", () => {
    expect(() => validateMineRouteRiskContract(SHIPPED_MINE_ROUTE_RISK_CONTRACT)).not.toThrow();
    expect(SHIPPED_MINE_ROUTE_RISK_CONTRACT.policyId).toBe(routeRiskPolicyId);
    expect(SHIPPED_MINE_ROUTE_RISK_CONTRACT.clampBp).toBe(MINE_ROUTE_RISK_MAX_BP);
  });

  it("fail-closed on a tampered exposure multiplier / formula / denominator / boundaries", () => {
    const badExposure = {
      ...SHIPPED_MINE_ROUTE_RISK_CONTRACT,
      exposureMultipliers: {
        ...SHIPPED_MINE_ROUTE_RISK_CONTRACT.exposureMultipliers,
        OPEN_SEA_EDGE: 5_001,
      },
    };
    expect(() => validateMineRouteRiskContract(badExposure)).toThrow(INVALID_MINE_PRESSURE_STATE);

    const badFormula = { ...SHIPPED_MINE_ROUTE_RISK_CONTRACT, formula: "routeRiskBp = 0" };
    expect(() => validateMineRouteRiskContract(badFormula)).toThrow(INVALID_MINE_PRESSURE_STATE);

    const badDenominator = { ...SHIPPED_MINE_ROUTE_RISK_CONTRACT, denominator: "1" };
    expect(() => validateMineRouteRiskContract(badDenominator)).toThrow(
      INVALID_MINE_PRESSURE_STATE,
    );

    const badBound = { ...SHIPPED_MINE_ROUTE_RISK_CONTRACT, maxSusceptibilityBp: 9_999 };
    expect(() => validateMineRouteRiskContract(badBound)).toThrow(INVALID_MINE_PRESSURE_STATE);

    expect(() => validateMineRouteRiskContract(null)).toThrow(INVALID_MINE_PRESSURE_STATE);
    expect(() => validateMineRouteRiskContract({})).toThrow(INVALID_MINE_PRESSURE_STATE);
  });
});

describe("AC-12: INC-4 ─ INC-5 allocation seam (documented, INC-4 untouched)", () => {
  const fakeRecord = (id: string): AreaMinePressureRecord =>
    ({
      minePressureId: id,
      mineTypeId: "CONTACT",
      pressure: SafeInt(500_000),
    }) as unknown as AreaMinePressureRecord;

  const candidate = (
    record: AreaMinePressureRecord,
    priority: number,
  ): SweepingAllocationCandidate => ({
    record,
    threatensSweepingSide: false,
    strikeRiskPriority: priority,
    resistanceMultiplierBp: 10_000,
  });

  it("routeRiskBpToAllocationPriority maps a §13 value order-preservingly (higher risk = earlier)", () => {
    const lower = risk(200_000, 9_000, 10_000, 10_000);
    const higher = risk(800_000, 9_000, 10_000, 10_000);
    expect(Number(higher.routeRiskBp)).toBeGreaterThan(Number(lower.routeRiskBp));

    expect(routeRiskBpToAllocationPriority(Number(lower.routeRiskBp))).toBe(1_800);
    expect(routeRiskBpToAllocationPriority(Number(higher.routeRiskBp))).toBe(7_200);

    const a = candidate(
      fakeRecord("mp-a"),
      routeRiskBpToAllocationPriority(Number(lower.routeRiskBp)),
    );
    const b = candidate(
      fakeRecord("mp-b"),
      routeRiskBpToAllocationPriority(Number(higher.routeRiskBp)),
    );
    const sorted = [a, b].sort(sweepingAllocationOrder);
    expect(sorted[0]!.record.minePressureId).toBe("mp-b");
    expect(sorted[1]!.record.minePressureId).toBe("mp-a");
  });

  it("the adapter rejects a routeRiskBp outside 0..10_000", () => {
    for (const bad of [-1, 10_001, 100_000]) {
      let err: BluewaveError | undefined;
      try {
        routeRiskBpToAllocationPriority(bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });
});
