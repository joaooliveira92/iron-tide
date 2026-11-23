import { TENSION_WAR, type CampaignSnapshot, type DiplomaticRelation } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
} from "./fixtures/trade-protection.js";

const rulesWith = (
  incidentBp: number,
  neutralEntryBp: number | undefined,
): TradeProtectionRules => ({
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1000,
    lossPerHitBp: 700,
    blockadeReductionBp: 9999,
    unrestricted: {
      chanceMultiplierBp: 20_000,
      incidentBp,
      ...(neutralEntryBp === undefined ? {} : { neutralEntryBp }),
    },
  },
});

const relation = (over: Partial<DiplomaticRelation> = {}): DiplomaticRelation => ({
  nationA: "FRA",
  nationB: "GBR",
  relation: "neutral",
  tension: 10,
  nap: false,
  since: "1880-01",
  ...over,
});

interface Setup {
  readonly ships?: Ship[];
  readonly relation?: Partial<DiplomaticRelation>;
  readonly gbrRaiding?: boolean;
  readonly gbrAtWarWith?: string;
}

type Ship = ReturnType<typeof tradeShip>;

const snapshot = (setup: Setup = {}): CampaignSnapshot => {
  const from = tradeSnapshot({
    gbrShips: [tradeShip("a", "d-dd")],
    designs: [tradeDesign("d-dd", "destroyer"), tradeDesign("d-ss", "submarine")],
    frashipsRaiders: setup.ships ?? [tradeShip("s1", "d-ss", {}, "FRA")],
    atWar: false,
  });
  const nations = new Map(from.nations);
  nations.set("FRA", { ...nations.get("FRA")!, submarinePolicy: "UNRESTRICTED" });
  if (setup.gbrRaiding === true) {
    const gbr = nations.get("GBR")!;
    nations.set("GBR", {
      ...gbr,
      submarinePolicy: "UNRESTRICTED",
      fleets: [{ ...gbr.fleets[0]!, ships: [tradeShip("g1", "d-ss", {}, "GBR")] }],
    });
  }
  const wars =
    setup.gbrAtWarWith === undefined
      ? from.wars
      : {
          ...from.wars,
          wars: [
            {
              id: "war_other",
              attackerSideId: "side_GBR",
              defenderSideId: `side_${setup.gbrAtWarWith}`,
              attackerSideMembers: ["GBR"],
              defenderSideMembers: [setup.gbrAtWarWith],
              attackerWarScore: 0,
              defenderWarScore: 0,
              attackerId: "GBR",
              defenderId: setup.gbrAtWarWith,
              startDate: "1880-01",
              status: "ACTIVE" as const,
            },
          ],
        };
  return {
    ...from,
    nations,
    wars,
    politics: { relations: [relation(setup.relation)], shells: {} },
  };
};

const entryDraws = (result: ReturnType<typeof runTrade>) =>
  result.randomLedger.all.filter((d) => d.reasonCode === "SUBMARINE_NEUTRAL_ENTRY");

const relationOf = (result: ReturnType<typeof runTrade>) =>
  result.finalSnapshot.politics.relations[0]!;

const warsOf = (result: ReturnType<typeof runTrade>) => result.finalSnapshot.wars.wars;

describe("#1100: neutral entry at the tension cap", () => {
  it("changes nothing when neutralEntryBp is not authored", () => {
    const result = runTrade(snapshot(), [], rulesWith(10_000, undefined));
    expect(entryDraws(result)).toEqual([]);
    expect(relationOf(result)).toMatchObject({ relation: "neutral", tension: 10 });
    expect(warsOf(result)).toEqual([]);
  });

  it("makes the neutral declare war on the raider on a hit and records the draw", () => {
    const result = runTrade(snapshot(), [], rulesWith(10_000, 10_000));
    expect(relationOf(result)).toMatchObject({ relation: "at_war", tension: TENSION_WAR });
    expect(warsOf(result)).toHaveLength(1);
    expect(warsOf(result)[0]).toMatchObject({
      id: "war_GBR_FRA_1880-06",
      attackerId: "GBR",
      defenderId: "FRA",
      attackerSideMembers: ["GBR"],
      defenderSideMembers: ["FRA"],
    });
    const draws = entryDraws(result);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      streamId: "diplomacy/submarine_neutral_entry",
      entityKey: "FRA|GBR",
      outcome: "HIT",
      phase: "resolve_diplomacy",
    });
  });

  it("keeps the pair neutral on a miss but still records the draw", () => {
    const result = runTrade(snapshot(), [], rulesWith(10_000, 0));
    expect(entryDraws(result).map((d) => d.outcome)).toEqual(["MISS"]);
    expect(relationOf(result)).toMatchObject({ relation: "neutral", tension: 10 });
    expect(warsOf(result)).toEqual([]);
  });

  it("does not draw below the cap", () => {
    const result = runTrade(snapshot({ relation: { tension: 8 } }), [], rulesWith(0, 10_000));
    expect(entryDraws(result)).toEqual([]);
    expect(warsOf(result)).toEqual([]);
  });

  it("enters in the same month an incident lifts the pair to the cap", () => {
    const result = runTrade(snapshot({ relation: { tension: 9 } }), [], rulesWith(10_000, 10_000));
    expect(relationOf(result)).toMatchObject({ relation: "at_war", tension: TENSION_WAR });
    expect(warsOf(result)).toHaveLength(1);
  });

  it("covers trade-agreement pairs", () => {
    const result = runTrade(
      snapshot({ relation: { relation: "trade_agreement" } }),
      [],
      rulesWith(0, 10_000),
    );
    expect(relationOf(result).relation).toBe("at_war");
  });

  it("skips allied, at-war and non-aggression pairs without drawing", () => {
    for (const over of [
      { relation: "allied" as const },
      { relation: "at_war" as const },
      { nap: true },
    ]) {
      const result = runTrade(snapshot({ relation: over }), [], rulesWith(0, 10_000));
      expect(entryDraws(result)).toEqual([]);
      expect(warsOf(result)).toEqual([]);
    }
  });

  it("does not draw without an active submarine or without the unrestricted policy", () => {
    const none = runTrade(snapshot({ ships: [] }), [], rulesWith(0, 10_000));
    expect(entryDraws(none)).toEqual([]);
    const from = snapshot();
    const nations = new Map(from.nations);
    nations.set("FRA", { ...nations.get("FRA")!, submarinePolicy: "PRIZE_RULES" });
    const prize = runTrade({ ...from, nations }, [], rulesWith(0, 10_000));
    expect(entryDraws(prize)).toEqual([]);
  });

  it("leaves a neutral that is already in another war alone", () => {
    const result = runTrade(snapshot({ gbrAtWarWith: "GER" }), [], rulesWith(0, 10_000));
    expect(entryDraws(result)).toEqual([]);
    expect(relationOf(result).relation).toBe("neutral");
  });

  it("lets the code-point first nation declare when both sides raid", () => {
    const result = runTrade(snapshot({ gbrRaiding: true }), [], rulesWith(0, 10_000));
    expect(entryDraws(result)).toHaveLength(1);
    expect(warsOf(result)[0]).toMatchObject({ attackerId: "FRA", defenderId: "GBR" });
  });

  it("is deterministic for the same seed", () => {
    const a = runTrade(snapshot(), [], rulesWith(0, 5000), "seed-x");
    const b = runTrade(snapshot(), [], rulesWith(0, 5000), "seed-x");
    expect(entryDraws(a)).toEqual(entryDraws(b));
    expect(relationOf(a)).toEqual(relationOf(b));
    expect(warsOf(a)).toEqual(warsOf(b));
  });
});
