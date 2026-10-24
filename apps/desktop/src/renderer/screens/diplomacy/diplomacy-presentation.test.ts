import { describe, expect, it } from "vite-plus/test";
import {
  DEFERRED_INTEL_ITEMS,
  DEFERRED_WAR_ITEMS,
  RELATION_LABELS,
  diplomacyLegalActions,
  tensionBadgeLabel,
  warScoreSplit,
} from "./diplomacy-presentation.js";

describe("diplomacyLegalActions", () => {
  it("derives legal actions from the projected relation state (UI affordance only)", () => {
    expect(diplomacyLegalActions({ relation: "neutral", nap: false })).toEqual([
      "DeclareWar",
      "FormAlliance",
      "FormNonAggressionPact",
    ]);
    expect(diplomacyLegalActions({ relation: "allied", nap: false })).toEqual([
      "DeclareWar",
      "BreakAlliance",
      "FormNonAggressionPact",
    ]);
    expect(diplomacyLegalActions({ relation: "at_war", nap: false })).toEqual(["DeclareBlockade"]);
    expect(diplomacyLegalActions({ relation: "neutral", nap: true })).toEqual([
      "DeclareWar",
      "FormAlliance",
      "BreakNonAggressionPact",
    ]);
  });
});

describe("RELATION_LABELS", () => {
  it("exposes relation labels for honest rendering", () => {
    expect(RELATION_LABELS).toMatchObject({
      neutral: "Neutral",
      allied: "Allied",
      at_war: "At war",
    });
  });
});

describe("tensionBadgeLabel", () => {
  it("shows a readable tension band alongside a differing relation", () => {
    expect(tensionBadgeLabel("neutral", 10)).toBe("War imminent");
    expect(tensionBadgeLabel("allied", 0)).toBe("Cordial");
    expect(tensionBadgeLabel("at_war", 8)).toBe("Hostile");
  });

  it("drops the badge only where it would repeat the relation badge (neutral/neutral)", () => {
    expect(tensionBadgeLabel("neutral", 3)).toBeNull();
    expect(tensionBadgeLabel("neutral", 5)).toBeNull();
    expect(tensionBadgeLabel("allied", 4)).toBe("Neutral");
  });
});

describe("warScoreSplit", () => {
  it("reads the player's score from the correct side", () => {
    const attacker = {
      attackerWarScore: 6,
      defenderWarScore: 2,
      playerSide: "attacker",
    } as const;
    expect(warScoreSplit(attacker)).toEqual({
      yours: 6,
      enemy: 2,
      yourShare: 0.75,
    });
    expect(warScoreSplit({ ...attacker, playerSide: "defender" })).toEqual({
      yours: 2,
      enemy: 6,
      yourShare: 0.25,
    });
  });

  it("centres the bar when nobody has scored and never divides by zero", () => {
    const even = {
      attackerWarScore: 0,
      defenderWarScore: 0,
      playerSide: "attacker",
    } as const;
    expect(warScoreSplit(even).yourShare).toBe(0.5);
  });

  it("clamps negative scores out of the bar share but reports them honestly", () => {
    const split = warScoreSplit({
      attackerWarScore: -3,
      defenderWarScore: 4,
      playerSide: "attacker",
    });
    expect(split.yours).toBe(-3);
    expect(split.yourShare).toBe(0);
  });
});

describe("DEFERRED_WAR_ITEMS", () => {
  it("lists the four unsupported RTW3 items, each with a stated reason and a unique id", () => {
    expect(DEFERRED_WAR_ITEMS.map((i) => i.id)).toEqual([
      "trade-protection",
      "asw",
      "submarine-policy",
      "invasion",
    ]);
    expect(DEFERRED_WAR_ITEMS.every((i) => i.reason.length > 20)).toBe(true);
  });
});

describe("DEFERRED_INTEL_ITEMS", () => {
  it("lists the unsupported intelligence items with reasons and unique ids", () => {
    expect(DEFERRED_INTEL_ITEMS.map((i) => i.id)).toEqual([
      "intel-levels",
      "intel-spending",
      "intel-reports",
    ]);
    expect(DEFERRED_INTEL_ITEMS.every((i) => i.reason.length > 20)).toBe(true);
  });
});
