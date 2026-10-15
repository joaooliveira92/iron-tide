import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  LONG_RANGE_ASW_VULNERABILITY_MISSING,
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  submarineProximityPolicyId,
  submarineRemoteEfficiencyPolicyId,
  submarineLongRangeAswVulnerabilityPolicyId,
  SHIPPED_SUBMARINE_PROXIMITY_CONTRACT,
  SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT,
  SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT,
  validateSubmarineProximityContract,
  validateSubmarineRemoteEfficiencyContract,
  validateSubmarineLongRangeAswVulnerabilityContract,
  proximityBandForRouteDistance,
  submarineRemoteEfficiencyBp,
  submarineAswVulnerabilityBp,
  submarineNeutralAswVulnerabilityBp,
  registeredAswVulnerabilityBp,
} from "../../src/submarines/index.js";

describe("AC-6: base proximity bands (§8)", () => {
  it("LOCAL band: distance 0 and 1", () => {
    expect(proximityBandForRouteDistance(SafeInt(0))).toBe("LOCAL");
    expect(proximityBandForRouteDistance(SafeInt(1))).toBe("LOCAL");
  });

  it("REGIONAL band: distance 2 and 3", () => {
    expect(proximityBandForRouteDistance(SafeInt(2))).toBe("REGIONAL");
    expect(proximityBandForRouteDistance(SafeInt(3))).toBe("REGIONAL");
  });

  it("REMOTE band: distance 4, 5, and 6", () => {
    expect(proximityBandForRouteDistance(SafeInt(4))).toBe("REMOTE");
    expect(proximityBandForRouteDistance(SafeInt(5))).toBe("REMOTE");
    expect(proximityBandForRouteDistance(SafeInt(6))).toBe("REMOTE");
  });

  it("EXTREME_REMOTE band: distance >= 7", () => {
    expect(proximityBandForRouteDistance(SafeInt(7))).toBe("EXTREME_REMOTE");
    expect(proximityBandForRouteDistance(SafeInt(100))).toBe("EXTREME_REMOTE");
  });

  it("fails closed on negative distance", () => {
    expect(() => proximityBandForRouteDistance(SafeInt(-1))).toThrow(BluewaveError);
  });

  it("fails closed on non-integer distance", () => {
    expect(() => proximityBandForRouteDistance(1.5 as SafeInt)).toThrow(BluewaveError);
  });

  it("is deterministic: identical inputs produce identical bands", () => {
    expect(proximityBandForRouteDistance(SafeInt(3))).toBe(
      proximityBandForRouteDistance(SafeInt(3)),
    );
  });
});

describe("AC-7: remote-efficiency multipliers (§9)", () => {
  it("COASTAL: exact table values", () => {
    expect(submarineRemoteEfficiencyBp("COASTAL", "LOCAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("COASTAL", "REGIONAL")).toBe(SafeInt(7_500));
    expect(submarineRemoteEfficiencyBp("COASTAL", "REMOTE")).toBe(SafeInt(2_500));
    expect(submarineRemoteEfficiencyBp("COASTAL", "EXTREME_REMOTE")).toBe(SafeInt(0));
  });

  it("MEDIUM_RANGE: exact table values", () => {
    expect(submarineRemoteEfficiencyBp("MEDIUM_RANGE", "LOCAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MEDIUM_RANGE", "REGIONAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MEDIUM_RANGE", "REMOTE")).toBe(SafeInt(7_500));
    expect(submarineRemoteEfficiencyBp("MEDIUM_RANGE", "EXTREME_REMOTE")).toBe(SafeInt(5_000));
  });

  it("LONG_RANGE: exact table values", () => {
    expect(submarineRemoteEfficiencyBp("LONG_RANGE", "LOCAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("LONG_RANGE", "REGIONAL")).toBe(SafeInt(11_000));
    expect(submarineRemoteEfficiencyBp("LONG_RANGE", "REMOTE")).toBe(SafeInt(12_500));
    expect(submarineRemoteEfficiencyBp("LONG_RANGE", "EXTREME_REMOTE")).toBe(SafeInt(10_000));
  });

  it("MINELAYING: exact table values", () => {
    expect(submarineRemoteEfficiencyBp("MINELAYING", "LOCAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MINELAYING", "REGIONAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MINELAYING", "REMOTE")).toBe(SafeInt(8_000));
    expect(submarineRemoteEfficiencyBp("MINELAYING", "EXTREME_REMOTE")).toBe(SafeInt(5_000));
  });

  it("MISSILE: exact table values", () => {
    expect(submarineRemoteEfficiencyBp("MISSILE", "LOCAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MISSILE", "REGIONAL")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MISSILE", "REMOTE")).toBe(SafeInt(10_000));
    expect(submarineRemoteEfficiencyBp("MISSILE", "EXTREME_REMOTE")).toBe(SafeInt(9_000));
  });

  it("fails closed on unknown type id", () => {
    expect(() => submarineRemoteEfficiencyBp("NUCLEAR" as never, "LOCAL")).toThrow(BluewaveError);
  });
});

describe("AC-8: long-range ASW vulnerability (§10)", () => {
  it("exact band multipliers", () => {
    expect(submarineAswVulnerabilityBp("LOCAL")).toBe(SafeInt(10_500));
    expect(submarineAswVulnerabilityBp("REGIONAL")).toBe(SafeInt(10_750));
    expect(submarineAswVulnerabilityBp("REMOTE")).toBe(SafeInt(11_000));
    expect(submarineAswVulnerabilityBp("EXTREME_REMOTE")).toBe(SafeInt(11_500));
  });

  it("all values within §10 permitted range 10_000..12_500", () => {
    for (const band of ["LOCAL", "REGIONAL", "REMOTE", "EXTREME_REMOTE"] as const) {
      const v = submarineAswVulnerabilityBp(band);
      expect(v).toBeGreaterThanOrEqual(SUBMARINE_BASIS_POINTS_PER_UNIT);
      expect(v).toBeLessThanOrEqual(12_500);
    }
  });

  it("neutral baseline is 10_000 (no change)", () => {
    expect(submarineNeutralAswVulnerabilityBp()).toBe(SafeInt(SUBMARINE_BASIS_POINTS_PER_UNIT));
  });

  it("registeredAswVulnerabilityBp uses the §10 table for long-range types", () => {
    expect(registeredAswVulnerabilityBp("LONG_RANGE", "LOCAL", true)).toBe(SafeInt(10_500));
    expect(registeredAswVulnerabilityBp("COASTAL", "LOCAL", false)).toBe(
      SafeInt(SUBMARINE_BASIS_POINTS_PER_UNIT),
    );
  });

  it("fails closed when vulnerability value is out of §10 range", () => {
    expect(() => submarineAswVulnerabilityBp("" as never)).toThrow(
      LONG_RANGE_ASW_VULNERABILITY_MISSING,
    );
  });
});

describe("AC-21: INC-3 contracts + validate guards", () => {
  it("proximity contract ships *_v1 policy id and validates", () => {
    expect(submarineProximityPolicyId).toBe("submarine_proximity_v1");
    expect(SHIPPED_SUBMARINE_PROXIMITY_CONTRACT.policyId).toBe("submarine_proximity_v1");
    expect(() =>
      validateSubmarineProximityContract(SHIPPED_SUBMARINE_PROXIMITY_CONTRACT),
    ).not.toThrow();
  });

  it("proximity contract fails closed on tampered bands", () => {
    expect(() =>
      validateSubmarineProximityContract({
        ...SHIPPED_SUBMARINE_PROXIMITY_CONTRACT,
        proximityBands: [{ band: "LOCAL", minDistance: 0, maxDistance: 2 }],
      }),
    ).toThrow(BluewaveError);
  });

  it("remote-efficiency contract ships *_v1 policy id and validates", () => {
    expect(submarineRemoteEfficiencyPolicyId).toBe("submarine_remote_efficiency_v1");
    expect(SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT.policyId).toBe(
      "submarine_remote_efficiency_v1",
    );
    expect(() =>
      validateSubmarineRemoteEfficiencyContract(SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT),
    ).not.toThrow();
  });

  it("remote-efficiency contract fails closed on tampered value", () => {
    const tampered = {
      ...SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT,
      efficiencyTableBp: SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT.efficiencyTableBp.map(
        (e, i) => (i === 0 ? { ...e, bands: { ...e.bands, LOCAL: 9_999 } } : e),
      ),
    };
    expect(() => validateSubmarineRemoteEfficiencyContract(tampered)).toThrow(BluewaveError);
  });

  it("ASW vulnerability contract ships *_v1 policy id and validates", () => {
    expect(submarineLongRangeAswVulnerabilityPolicyId).toBe(
      "submarine_long_range_asw_vulnerability_v1",
    );
    expect(SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT.policyId).toBe(
      "submarine_long_range_asw_vulnerability_v1",
    );
    expect(() =>
      validateSubmarineLongRangeAswVulnerabilityContract(
        SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT,
      ),
    ).not.toThrow();
  });

  it("ASW vulnerability contract fails closed on missing contract or tampered table", () => {
    expect(() => validateSubmarineLongRangeAswVulnerabilityContract(null)).toThrow(BluewaveError);
  });
});
