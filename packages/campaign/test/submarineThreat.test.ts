import { describe, expect, it } from "vite-plus/test";
import {
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

describe("submarine attack chance", () => {
  it("amplifies with the victim shortfall like a raider hit", () => {
    expect(submarineAttackChanceBp(rules, 0, false)).toBe(1000);
    expect(submarineAttackChanceBp(rules, 4000, false)).toBe(3000);
  });

  it("is sharply reduced when the attacker blockades the victim", () => {
    expect(submarineAttackChanceBp(rules, 0, true)).toBe(200);
    expect(submarineAttackChanceBp(rules, 4000, true)).toBe(600);
  });

  it("caps at certainty", () => {
    expect(submarineAttackChanceBp(rules, 10_000, false)).toBe(6000);
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
