import { describe, expect, it } from "vite-plus/test";
import {
  damageOutcome,
  engagementOutcome,
  warshipAttackChanceBp,
  warshipScreenRatioBp,
  type RaiderInterceptionRules,
  type WarshipAttackRules,
} from "../src/index.js";

const rules: WarshipAttackRules = {
  attackBp: 250,
  policyMultiplierBp: { FLEET_SUPPORT: 16_000, PRIZE_RULES: 10_000, UNRESTRICTED: 5000 },
  screenReductionBp: 7000,
  sunkBp: 1000,
  maxDamageBp: 4000,
  heavyHullTypes: ["dreadnought"],
  screenHullTypes: ["destroyer"],
};

describe("warshipScreenRatioBp", () => {
  it("is the free destroyers per heavy ship, capped at one", () => {
    expect(warshipScreenRatioBp(0, 4)).toBe(0);
    expect(warshipScreenRatioBp(1, 4)).toBe(2500);
    expect(warshipScreenRatioBp(4, 4)).toBe(10_000);
    expect(warshipScreenRatioBp(9, 4)).toBe(10_000);
  });

  it("is zero with no heavy ships", () => {
    expect(warshipScreenRatioBp(3, 0)).toBe(0);
  });
});

describe("warshipAttackChanceBp", () => {
  it("applies the policy multiplier then the screen reduction", () => {
    expect(warshipAttackChanceBp(rules, "PRIZE_RULES", 0)).toBe(250);
    expect(warshipAttackChanceBp(rules, "FLEET_SUPPORT", 0)).toBe(400);
    expect(warshipAttackChanceBp(rules, "UNRESTRICTED", 0)).toBe(125);
    expect(warshipAttackChanceBp(rules, "PRIZE_RULES", 10_000)).toBe(75);
  });

  it("orders the policies FLEET_SUPPORT above PRIZE_RULES above UNRESTRICTED", () => {
    for (let ratio = 0; ratio <= 10_000; ratio += 500) {
      const fleet = warshipAttackChanceBp(rules, "FLEET_SUPPORT", ratio);
      const prize = warshipAttackChanceBp(rules, "PRIZE_RULES", ratio);
      const unrestricted = warshipAttackChanceBp(rules, "UNRESTRICTED", ratio);
      expect(fleet).toBeGreaterThanOrEqual(prize);
      expect(prize).toBeGreaterThanOrEqual(unrestricted);
    }
  });

  it("never rises with the screen ratio and is capped at 10000 integer basis points", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ratio = 0; ratio <= 10_000; ratio += 250) {
      const chance = warshipAttackChanceBp(rules, "FLEET_SUPPORT", ratio);
      expect(Number.isInteger(chance)).toBe(true);
      expect(chance).toBeLessThanOrEqual(previous);
      previous = chance;
    }
    const huge = { ...rules, attackBp: 10_000 };
    expect(warshipAttackChanceBp(huge, "FLEET_SUPPORT", 0)).toBe(10_000);
  });
});

describe("damageOutcome", () => {
  it("sinks below sunkBp and otherwise damages within maxDamageBp", () => {
    expect(damageOutcome(1000, 4000, 999, 100, 100)).toEqual({ kind: "SUNK" });
    expect(damageOutcome(1000, 4000, 1000, 100, 100)).toEqual({
      kind: "DAMAGED",
      damageBp: 0,
      hitPointsAfter: 100,
    });
    const worst = damageOutcome(1000, 4000, 9999, 100, 100);
    expect(worst).toMatchObject({ kind: "DAMAGED", damageBp: 3999 });
  });

  it("never lowers hit points below zero", () => {
    for (let draw = 1000; draw < 10_000; draw += 101) {
      const outcome = damageOutcome(1000, 10_000, draw, 5, 100);
      if (outcome.kind === "DAMAGED") expect(outcome.hitPointsAfter).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("engagementOutcome after the damageOutcome extraction", () => {
  const raider: RaiderInterceptionRules = {
    interceptBaseBp: 1000,
    interceptPatrolBp: 5000,
    breakoutInterceptBp: 5000,
    raiderSunkBp: 2000,
    maxEngagementDamageBp: 6000,
    scuttleThresholdBp: 2500,
    scuttleShareBp: 5000,
    fuelInternBp: 100,
    breakdownInternBp: 100,
  };

  function reference(draw: number, hp: number, max: number) {
    if (draw < raider.raiderSunkBp) return { kind: "SUNK" };
    const damageBp = Math.floor(
      ((draw - raider.raiderSunkBp) * raider.maxEngagementDamageBp) /
        (10_000 - raider.raiderSunkBp),
    );
    const hitPointsAfter = Math.max(0, hp - Math.floor((max * damageBp) / 10_000));
    return {
      kind: "SURVIVED",
      damageBp,
      hitPointsAfter,
      heavilyDamaged: Math.floor((hitPointsAfter * 10_000) / max) <= raider.scuttleThresholdBp,
    };
  }

  it("matches the reference over a draw sweep", () => {
    for (let draw = 0; draw < 10_000; draw += 7) {
      for (const hp of [100, 37, 1]) {
        expect(engagementOutcome(raider, draw, hp, 100)).toEqual(reference(draw, hp, 100));
      }
    }
  });
});
