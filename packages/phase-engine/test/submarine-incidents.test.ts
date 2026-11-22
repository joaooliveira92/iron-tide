import type { CampaignSnapshot, DiplomaticRelation, Ship } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
} from "./fixtures/trade-protection.js";

const rulesWith = (incidentBp: number): TradeProtectionRules => ({
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1000,
    lossPerHitBp: 700,
    blockadeReductionBp: 9999,
    unrestricted: { chanceMultiplierBp: 20_000, incidentBp },
  },
});

const relation = (over: Partial<DiplomaticRelation> = {}): DiplomaticRelation => ({
  nationA: "FRA",
  nationB: "GBR",
  relation: "neutral",
  tension: 3,
  nap: false,
  since: "1880-01",
  ...over,
});

interface Setup {
  readonly policy?: "UNRESTRICTED";
  readonly ships?: Ship[];
  readonly relation?: Partial<DiplomaticRelation>;
  readonly gbrPolicy?: "UNRESTRICTED";
}

const snapshot = (setup: Setup = {}): CampaignSnapshot => {
  const from = tradeSnapshot({
    gbrShips: [tradeShip("a", "d-dd")],
    designs: [tradeDesign("d-dd", "destroyer"), tradeDesign("d-ss", "submarine")],
    frashipsRaiders: setup.ships ?? [tradeShip("s1", "d-ss", {}, "FRA")],
    atWar: false,
  });
  const nations = new Map(from.nations);
  if (setup.policy !== undefined) {
    nations.set("FRA", { ...nations.get("FRA")!, submarinePolicy: setup.policy });
  }
  if (setup.gbrPolicy !== undefined) {
    nations.set("GBR", { ...nations.get("GBR")!, submarinePolicy: setup.gbrPolicy });
  }
  return {
    ...from,
    nations,
    politics: { relations: [relation(setup.relation)], shells: {} },
  };
};

const incidentDraws = (result: ReturnType<typeof runTrade>) =>
  result.randomLedger.all.filter((d) => d.reasonCode === "SUBMARINE_INCIDENT");

const tensionOf = (result: ReturnType<typeof runTrade>) =>
  result.finalSnapshot.politics.relations[0]!.tension;

describe("#1071: unrestricted submarine incidents", () => {
  it("raises tension by one on a hit and records the draw", () => {
    const result = runTrade(snapshot({ policy: "UNRESTRICTED" }), [], rulesWith(10_000));
    expect(tensionOf(result)).toBe(4);
    const draws = incidentDraws(result);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      streamId: "diplomacy/submarine_incident",
      entityKey: "FRA|GBR",
      outcome: "HIT",
      phase: "resolve_diplomacy",
    });
  });

  it("leaves tension alone on a miss but still records the draw", () => {
    const result = runTrade(snapshot({ policy: "UNRESTRICTED" }), [], rulesWith(0));
    expect(tensionOf(result)).toBe(3);
    expect(incidentDraws(result).map((d) => d.outcome)).toEqual(["MISS"]);
  });

  it("draws nothing without the unrestricted policy", () => {
    const result = runTrade(snapshot(), [], rulesWith(10_000));
    expect(incidentDraws(result)).toEqual([]);
    expect(tensionOf(result)).toBe(3);
  });

  it("draws nothing without an active submarine", () => {
    const none = runTrade(snapshot({ policy: "UNRESTRICTED", ships: [] }), [], rulesWith(10_000));
    expect(incidentDraws(none)).toEqual([]);
    const idle = runTrade(
      snapshot({
        policy: "UNRESTRICTED",
        ships: [
          tradeShip("s1", "d-ss", { isUnderConstruction: true }, "FRA"),
          tradeShip("s2", "d-ss", { readiness: "MOTHBALLED" }, "FRA"),
        ],
      }),
      [],
      rulesWith(10_000),
    );
    expect(incidentDraws(idle)).toEqual([]);
    expect(tensionOf(idle)).toBe(3);
  });

  it("draws nothing when the unrestricted posture is not authored", () => {
    const result = runTrade(snapshot({ policy: "UNRESTRICTED" }), [], TRADE_RULES);
    expect(incidentDraws(result)).toEqual([]);
  });

  it("covers neutral and trade-agreement pairs only", () => {
    const trade = runTrade(
      snapshot({ policy: "UNRESTRICTED", relation: { relation: "trade_agreement" } }),
      [],
      rulesWith(10_000),
    );
    expect(incidentDraws(trade)).toHaveLength(1);
    for (const kind of ["allied", "at_war"] as const) {
      const result = runTrade(
        snapshot({ policy: "UNRESTRICTED", relation: { relation: kind } }),
        [],
        rulesWith(10_000),
      );
      expect(incidentDraws(result)).toEqual([]);
    }
  });

  it("draws once per pair even when both sides are unrestricted", () => {
    const from = snapshot({ policy: "UNRESTRICTED", gbrPolicy: "UNRESTRICTED" });
    const nations = new Map(from.nations);
    const gbr = nations.get("GBR")!;
    nations.set("GBR", {
      ...gbr,
      fleets: [{ ...gbr.fleets[0]!, ships: [tradeShip("g1", "d-ss", {}, "GBR")] }],
    });
    const result = runTrade({ ...from, nations }, [], rulesWith(10_000));
    expect(incidentDraws(result)).toHaveLength(1);
    expect(tensionOf(result)).toBe(4);
  });

  it("does not draw once tension is at the cap", () => {
    const result = runTrade(
      snapshot({ policy: "UNRESTRICTED", relation: { tension: 10 } }),
      [],
      rulesWith(10_000),
    );
    expect(incidentDraws(result)).toEqual([]);
    expect(tensionOf(result)).toBe(10);
  });

  it("is deterministic for the same seed", () => {
    const a = runTrade(snapshot({ policy: "UNRESTRICTED" }), [], rulesWith(5000), "seed-x");
    const b = runTrade(snapshot({ policy: "UNRESTRICTED" }), [], rulesWith(5000), "seed-x");
    expect(incidentDraws(a)).toEqual(incidentDraws(b));
    expect(tensionOf(a)).toBe(tensionOf(b));
  });
});
