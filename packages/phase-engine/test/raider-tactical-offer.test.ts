import type { RaiderInterceptionRules } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { makeRecordedInput, type OfferRequest, type RecordedInput } from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthResult } from "../src/index.js";
import { TRADE_RULES, tradeShip, tradeSnapshot } from "./fixtures/trade-protection.js";

const BASE: RaiderInterceptionRules = {
  interceptBaseBp: 1,
  interceptPatrolBp: 1,
  breakoutInterceptBp: 1,
  raiderSunkBp: 1,
  maxEngagementDamageBp: 1,
  scuttleThresholdBp: 1,
  scuttleShareBp: 1,
  fuelInternBp: 1,
  breakdownInternBp: 1,
};

const rules = (over: Partial<RaiderInterceptionRules>): TradeProtectionRules => ({
  ...TRADE_RULES,
  raiderInterception: { ...BASE, ...over },
});

const ALWAYS = rules({ interceptBaseBp: 10_000, breakoutInterceptBp: 10_000 });
const TURN = "turn-raider";

function run(
  snapshot: ReturnType<typeof tradeSnapshot>,
  options: {
    readonly rules?: TradeProtectionRules;
    readonly offers?: boolean;
    readonly inputs?: readonly RecordedInput[];
  } = {},
): MonthResult {
  const offers = options.offers ?? true;
  return new MonthExecutor().execute(
    snapshot,
    [],
    "raider-seed",
    new DiagnosticCollector(),
    undefined,
    {
      playerNationId: "GBR",
      tradeProtection: options.rules ?? ALWAYS,
      ...(offers
        ? {
            battleOffers: FIXTURE_BATTLE_OFFER_RULES,
            interruptions: { turnId: TURN, recordedInputs: options.inputs ?? [] },
          }
        : {}),
    },
  );
}

const kinds = (result: MonthResult, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind);

const draws = (result: MonthResult, stream: string) =>
  result.randomLedger.all.filter((d) => d.streamId === stream);

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

const patrol = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });
const fraPatrol = (id: string) => tradeShip(id, "d-dd", {}, "FRA");
const fraRaider = (id: string) => tradeShip(id, "d-cp", { stationAssignment: "RAIDER" }, "FRA");
const gbrRaider = (id: string) => tradeShip(id, "d-cp", { stationAssignment: "RAIDER" });

describe("#1052: player raider encounters become tactical offers", () => {
  it("offers a RAIDER_INTERCEPTION to the player whose patrols intercept an enemy raider", () => {
    const result = run(
      tradeSnapshot({ gbrShips: [patrol("p1"), patrol("p2")], frashipsRaiders: [fraRaider("r1")] }),
    );
    expect(result.outcome).toBe("suspended");
    const offer = offerOf(result);
    expect(offer.missionType).toBe("RAIDER_INTERCEPTION");
    expect(offer.playerSide).toBe("ATTACKER");
    expect(offer.areaId).toBe("a-1");
    expect(offer.playerForce.map((s) => s.shipId).sort()).toEqual(["p1", "p2"]);
    expect(draws(result, "trade/interception")).toHaveLength(1);
    expect(draws(result, "trade/engagement")).toEqual([]);
    expect(kinds(result, "RaiderEngaged")).toEqual([]);
  });

  it("offers the player's own intercepted raider against the enemy's patrol hulls", () => {
    const result = run(
      tradeSnapshot({
        gbrShips: [gbrRaider("g-r")],
        frashipsRaiders: [fraPatrol("f1"), fraPatrol("f2")],
      }),
    );
    const offer = offerOf(result);
    expect(offer.missionType).toBe("RAIDER_INTERCEPTION");
    expect(offer.playerSide).toBe("DEFENDER");
    expect(offer.playerForce.map((s) => s.shipId)).toEqual(["g-r"]);
    expect(kinds(result, "RaiderEngaged")).toEqual([]);
  });

  it("offers a BLOCKADE_BREAKOUT that cannot be declined to a blockaded player's raider", () => {
    const result = run(
      tradeSnapshot({
        gbrShips: [gbrRaider("g-r")],
        frashipsRaiders: [fraPatrol("f1")],
        blockade: "FRA_BLOCKADES_GBR",
      }),
    );
    const offer = offerOf(result);
    expect(offer.missionType).toBe("BLOCKADE_BREAKOUT");
    expect(offer.acceptanceClass).toBe("OPERATIONALLY_UNAVOIDABLE");
    expect(offer.playerSide).toBe("ATTACKER");
  });

  it("falls back to the abstract engagement when the interceptor has no patrol hull", () => {
    const result = run(
      tradeSnapshot({
        gbrShips: [gbrRaider("g-r")],
        frashipsRaiders: [tradeShip("f-r", "d-cp", {}, "FRA")],
      }),
    );
    expect(result.outcome).toBe("completed");
    expect(kinds(result, "RaiderEngaged")).toHaveLength(1);
    expect(draws(result, "trade/engagement")).toHaveLength(1);
  });

  it("keeps the abstract engagement when offers are not configured", () => {
    const result = run(
      tradeSnapshot({ gbrShips: [patrol("p1")], frashipsRaiders: [fraRaider("r1")] }),
      { offers: false },
    );
    expect(result.outcome).toBe("completed");
    expect(kinds(result, "RaiderEngaged")).toHaveLength(1);
    expect(draws(result, "trade/engagement")).toHaveLength(1);
  });

  it("does not offer a battle when the raider escapes", () => {
    const result = run(
      tradeSnapshot({ gbrShips: [patrol("p1")], frashipsRaiders: [fraRaider("r1")] }),
      { rules: rules({}) },
    );
    expect(result.outcome).toBe("completed");
    expect(result.suspended).toBeUndefined();
  });

  it("completes the month after the player delegates, with the battle resolved and the raider reserved only for it", () => {
    const snapshot = tradeSnapshot({
      gbrShips: [patrol("p1"), patrol("p2")],
      frashipsRaiders: [fraRaider("r1")],
    });
    const first = run(snapshot);
    const offer = offerOf(first);
    const answered = makeRecordedInput({
      ordinal: offer.ordinal,
      kind: "offer",
      interruptionId: offer.interruptionId,
      payload: {
        interruptionId: offer.interruptionId,
        battleId: offer.battleId,
        response: "delegate",
      },
    });
    const done = run(snapshot, { inputs: [answered] });
    expect(done.outcome).toBe("completed");
    const battle = done.finalSnapshot.wars.battles.find((b) => b.id === offer.battleId);
    expect(battle?.phase).toBe("resolved");
    expect(kinds(done, "RaiderEngaged")).toEqual([]);
  });
});
