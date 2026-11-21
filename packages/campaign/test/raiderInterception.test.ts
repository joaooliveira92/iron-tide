import { describe, expect, it } from "vite-plus/test";
import {
  breakoutRequired,
  engagementOutcome,
  heavilyDamagedDisposition,
  internmentCause,
  interceptionChanceBp,
  patrolCoverageBp,
  type RaiderInterceptionRules,
} from "../src/raiderInterception.js";

const rules: RaiderInterceptionRules = {
  interceptBaseBp: 500,
  interceptPatrolBp: 3000,
  breakoutInterceptBp: 4000,
  raiderSunkBp: 2000,
  maxEngagementDamageBp: 6000,
  scuttleThresholdBp: 3000,
  scuttleShareBp: 5000,
  fuelInternBp: 200,
  breakdownInternBp: 100,
};

describe("patrol coverage", () => {
  it("is the assigned share of the quota, capped at full cover", () => {
    expect(patrolCoverageBp(4, 1)).toBe(2500);
    expect(patrolCoverageBp(4, 9)).toBe(10_000);
  });

  it("is zero when no patrol is required", () => {
    expect(patrolCoverageBp(0, 3)).toBe(0);
  });
});

describe("interception chance", () => {
  it("adds the patrol term scaled by coverage to the base chance", () => {
    expect(interceptionChanceBp(rules, 0)).toBe(500);
    expect(interceptionChanceBp(rules, 5000)).toBe(2000);
    expect(interceptionChanceBp(rules, 10_000)).toBe(3500);
  });

  it("never exceeds certainty", () => {
    expect(interceptionChanceBp({ ...rules, interceptBaseBp: 9000 }, 10_000)).toBe(10_000);
  });
});

describe("breakout predicate", () => {
  it("is required only when the raider's own nation is the blockaded one", () => {
    const blockades = [{ blockaderId: "GBR", blockadedNationId: "FRA" }];
    expect(breakoutRequired(blockades, "FRA")).toBe(true);
    expect(breakoutRequired(blockades, "GBR")).toBe(false);
  });
});

describe("engagement outcome", () => {
  it("sinks the raider when the draw falls under the sunk share", () => {
    expect(engagementOutcome(rules, 0, 100, 100)).toEqual({ kind: "SUNK" });
    expect(engagementOutcome(rules, 1999, 100, 100)).toEqual({ kind: "SUNK" });
  });

  it("scales survivor damage across the remaining draw range", () => {
    expect(engagementOutcome(rules, 2000, 100, 100)).toEqual({
      kind: "SURVIVED",
      damageBp: 0,
      hitPointsAfter: 100,
      heavilyDamaged: false,
    });
    expect(engagementOutcome(rules, 9999, 100, 100)).toEqual({
      kind: "SURVIVED",
      damageBp: 5999,
      hitPointsAfter: 41,
      heavilyDamaged: false,
    });
  });

  it("flags a survivor at or under the scuttle threshold", () => {
    const harsh = { ...rules, maxEngagementDamageBp: 10_000 };
    expect(engagementOutcome(harsh, 9999, 100, 100)).toMatchObject({
      kind: "SURVIVED",
      heavilyDamaged: true,
    });
  });

  it("measures the threshold against the hull strength before the fight", () => {
    expect(engagementOutcome(rules, 2000, 30, 100)).toMatchObject({
      hitPointsAfter: 30,
      heavilyDamaged: true,
    });
  });
});

describe("heavily damaged disposition", () => {
  it("scuttles under the share and interns otherwise", () => {
    expect(heavilyDamagedDisposition(rules, 4999)).toBe("SCUTTLED");
    expect(heavilyDamagedDisposition(rules, 5000)).toBe("INTERNED");
  });
});

describe("fuel and breakdown internment", () => {
  it("splits one draw into fuel exhaustion, breakdown or neither", () => {
    expect(internmentCause(rules, 0)).toBe("FUEL_EXHAUSTION");
    expect(internmentCause(rules, 199)).toBe("FUEL_EXHAUSTION");
    expect(internmentCause(rules, 200)).toBe("BREAKDOWN");
    expect(internmentCause(rules, 299)).toBe("BREAKDOWN");
    expect(internmentCause(rules, 300)).toBeUndefined();
  });
});
