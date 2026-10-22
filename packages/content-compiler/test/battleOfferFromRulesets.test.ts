import { describe, expect, it } from "vite-plus/test";
import { battleOffersFromRulesets } from "../src/index.js";

const FIXTURE_BATTLE_OFFER_RULES = {
  sectionVersion: 1,
  estimateModel: { kind: "EXACT", showComposition: false },
  declineVictoryPoints: {
    pointsByMission: { FLEET_BATTLE: 4 },
    distanceModifier: { kind: "NONE" },
    rounding: "FLOOR",
    opponentCredit: { kind: "NONE" },
  },
  declineCounter: { threshold: 2, scope: "WAR", reset: { kind: "NONE" } },
  enemyDecline: { comparison: "LESS_THAN", thresholdBp: 4_000, probabilityBp: 6_000 },
  supportForce: { presenceChanceBp: 2_500, shareOfCapBp: 5_000, source: "ALLIED_ONLY" },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
};

describe("battleOffersFromRulesets", () => {
  it("is dormant when no ruleset carries the section", () => {
    expect(battleOffersFromRulesets([])).toBeUndefined();
    expect(battleOffersFromRulesets([{ id: "core" }, { id: "other" }])).toBeUndefined();
  });

  it("returns the strictly decoded section of the ruleset that carries it", () => {
    const rules = battleOffersFromRulesets([
      { id: "core" },
      { id: "withOffers", battleOffers: FIXTURE_BATTLE_OFFER_RULES },
    ]);
    expect(rules).toEqual(FIXTURE_BATTLE_OFFER_RULES);
  });

  it("throws on a section that does not decode, naming the field", () => {
    expect(() =>
      battleOffersFromRulesets([{ id: "core", battleOffers: { sectionVersion: 1 } }]),
    ).toThrow(/battleOffers section is invalid at/);
  });
});
