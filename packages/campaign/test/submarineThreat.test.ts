import { describe, expect, it } from "vite-plus/test";
import {
  aswEscortAttackChanceBp,
  countAswEscorts,
  countEnemySubmarines,
  shortfallPrestigeLossBp,
  submarineAttackChanceBp,
  submarineQuotaTerm,
  type ShortfallPrestigeRules,
  type SubmarineThreatRules,
} from "../src/submarineThreat.js";
import { tradeProtectionQuota, type TradeProtectionRules } from "../src/tradeProtection.js";

const submarineThreat: SubmarineThreatRules = {
  hullType: "submarine",
  quotaPerBoatBp: 2500,
  attackBp: 1000,
  lossPerHitBp: 120,
  blockadeReductionBp: 8000,
  aswEscortReductionBp: 2000,
};

const shortfallPrestige: ShortfallPrestigeRules = { thresholdBp: 2000, lossBp: 150 };

const rules: TradeProtectionRules = {
  fleetShareBp: 2500,
  resourcesPerRequiredShip: 100,
  contributingHullTypes: ["destroyer"],
  raiderHullTypes: ["protected_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 1500,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 300,
  pressureChanceBp: 3000,
  pressureLossBp: 200,
  recoveryBpPerMonth: 100,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1000,
  unrestCadenceMonths: 3,
  unrestStep: 1,
  submarineThreat,
  shortfallPrestige,
};

const ship = (id: string, designVersionId: string, readiness = "ACTIVE", underway = false) => ({
  id,
  designVersionId,
  readiness,
  isUnderConstruction: underway,
});

describe("enemy submarine strength", () => {
  const designs = new Map([
    ["ss", { hullType: "submarine", normalizedSpeedUms: 1 }],
    ["dd", { hullType: "destroyer", normalizedSpeedUms: 1 }],
  ]);

  it("counts operational submarines only", () => {
    const ships = [
      ship("a", "ss"),
      ship("b", "ss", "RESERVE"),
      ship("c", "ss", "ACTIVE", true),
      ship("d", "ss", "MOTHBALLED"),
      ship("e", "dd"),
      ship("f", "missing"),
    ];
    expect(countEnemySubmarines(submarineThreat, ships, designs)).toBe(1);
  });

  it("is zero without a submarine hull match", () => {
    expect(countEnemySubmarines(submarineThreat, [ship("e", "dd")], designs)).toBe(0);
  });
});

describe("submarine term of the requirement", () => {
  it("rounds up whole ships per boat share", () => {
    expect(submarineQuotaTerm(submarineThreat, 0)).toBe(0);
    expect(submarineQuotaTerm(submarineThreat, 1)).toBe(1);
    expect(submarineQuotaTerm(submarineThreat, 4)).toBe(1);
    expect(submarineQuotaTerm(submarineThreat, 5)).toBe(2);
  });

  it("raises the quota when enemy submarines exist and not otherwise", () => {
    expect(tradeProtectionQuota(rules, 10, 0)).toBe(3);
    expect(tradeProtectionQuota(rules, 10, 0, 6)).toBe(5);
    const dormant: TradeProtectionRules = { ...rules };
    delete (dormant as { submarineThreat?: SubmarineThreatRules }).submarineThreat;
    expect(tradeProtectionQuota(dormant, 10, 0, 6)).toBe(3);
  });
});

const attackRules = { shortfallAmplifyBp: rules.shortfallAmplifyBp, submarineThreat };

describe("submarine attack chance", () => {
  it("amplifies with the victim shortfall like a raider hit", () => {
    expect(submarineAttackChanceBp(attackRules, 0, false)).toBe(1000);
    expect(submarineAttackChanceBp(attackRules, 4000, false)).toBe(3000);
  });

  it("is sharply reduced when the attacker blockades the victim", () => {
    expect(submarineAttackChanceBp(attackRules, 0, true)).toBe(200);
    expect(submarineAttackChanceBp(attackRules, 4000, true)).toBe(600);
  });

  it("caps at certainty", () => {
    expect(submarineAttackChanceBp(attackRules, 10_000, false)).toBe(6000);
  });
});

describe("shortfall prestige", () => {
  it("charges nothing under the threshold and the authored loss at or above it", () => {
    expect(shortfallPrestigeLossBp(shortfallPrestige, 0)).toBe(0);
    expect(shortfallPrestigeLossBp(shortfallPrestige, 1999)).toBe(0);
    expect(shortfallPrestigeLossBp(shortfallPrestige, 2000)).toBe(150);
    expect(shortfallPrestigeLossBp(shortfallPrestige, 10_000)).toBe(150);
  });
});

describe("anti-submarine escorts", () => {
  const designs = new Map([
    ["dd-asw", { hullType: "destroyer", normalizedSpeedUms: 1, aswLevel: 2 }],
    ["dd", { hullType: "destroyer", normalizedSpeedUms: 1 }],
    ["cl-asw", { hullType: "light_cruiser", normalizedSpeedUms: 1, aswLevel: 1 }],
  ]);
  const escort = (
    id: string,
    designVersionId: string,
    readiness = "ACTIVE",
    station = "TRADE_PROTECTION",
  ) => ({ id, designVersionId, readiness, stationAssignment: station });

  it("counts only active, contributing, trade-protection ships fitted for anti-submarine attack", () => {
    const ships = [
      escort("a", "dd-asw"),
      escort("b", "dd"),
      escort("c", "dd-asw", "RESERVE"),
      escort("d", "dd-asw", "ACTIVE", "RAIDER"),
      escort("e", "cl-asw"),
      escort("f", "missing"),
      escort("g", "dd-asw"),
    ];
    expect(countAswEscorts(rules, ships, designs)).toBe(2);
  });

  it("is the identity with no escorts", () => {
    expect(aswEscortAttackChanceBp(submarineThreat, 3000, 0)).toBe(3000);
  });

  it("is the identity when no reduction is authored", () => {
    const unauthored: SubmarineThreatRules = {
      hullType: "submarine",
      quotaPerBoatBp: 2500,
      attackBp: 1000,
      lossPerHitBp: 120,
      blockadeReductionBp: 8000,
    };
    expect(aswEscortAttackChanceBp(unauthored, 3000, 5)).toBe(3000);
  });

  it("reduces the chance per escort and never raises it", () => {
    expect(aswEscortAttackChanceBp(submarineThreat, 3000, 1)).toBe(2400);
    expect(aswEscortAttackChanceBp(submarineThreat, 3000, 2)).toBe(1920);
    let previous = 3000;
    for (let escorts = 0; escorts <= 40; escorts += 1) {
      const chance = aswEscortAttackChanceBp(submarineThreat, 3000, escorts);
      expect(chance).toBeLessThanOrEqual(previous);
      expect(chance).toBeGreaterThanOrEqual(0);
      previous = chance;
    }
  });

  it("removes the chance entirely at a full reduction", () => {
    const full = { ...submarineThreat, aswEscortReductionBp: 10_000 };
    expect(aswEscortAttackChanceBp(full, 3000, 1)).toBe(0);
  });
});
