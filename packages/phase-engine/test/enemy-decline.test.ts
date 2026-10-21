import type { CampaignSnapshot } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type OfferRequest,
  type OfferResponse,
  type RecordedInput,
} from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import {
  hashSnapshot,
  MonthExecutor,
  type InterruptionChannel,
  type MonthResult,
} from "../src/index.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

// T-1 07 (#116, spec #109 R11): the enemy may decline a battle the player would fight. Every ruleset value is a
// FIXTURE-CLASS value (predicate: enemy under 4000 bp of the player's force); none reaches production.
type Rules = typeof FIXTURE_BATTLE_OFFER_RULES;
const SEED = "enemy-decline-seed";
const TURN = "turn-enemy-decline";
const STREAM = "battle-offer/enemy-decline";

function rules(over: Partial<Rules["enemyDecline"]> = {}, extra: Partial<Rules> = {}): Rules {
  return {
    ...FIXTURE_BATTLE_OFFER_RULES,
    ...extra,
    enemyDecline: { ...FIXTURE_BATTLE_OFFER_RULES.enemyDecline, ...over },
  };
}

/**
 * One ship a side (so the committed forces are exactly these, with no random optional selection): the player (GBR) at
 * playerFp against the enemy (FRA) at enemyFp, in one area.
 */
function snapshotOf(playerFp: number, enemyFp: number): CampaignSnapshot {
  return makeBattleSnapshot({
    attackerShips: [makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: playerFp })],
    defenderShips: [makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: enemyFp })],
  });
}

function run(
  snapshot: CampaignSnapshot,
  battleOffers: Rules | undefined,
  inputs: readonly RecordedInput[] = [],
  channel = true,
): MonthResult {
  const interruptions: InterruptionChannel = { turnId: TURN, recordedInputs: inputs };
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    playerNationId: ATTACKER_NATION,
    ...(battleOffers === undefined ? {} : { battleOffers }),
    ...(channel ? { interruptions } : {}),
  });
}

const draws = (result: MonthResult) => result.randomLedger.all.filter((d) => d.streamId === STREAM);
const withdrawn = (result: MonthResult) =>
  result.eventLedger.all.filter((e) => e.body.kind === "EnemyDeclinedBattle");

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

function answer(request: OfferRequest, response: OfferResponse): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
  });
}

describe("the enemy declines (R11)", () => {
  const strongPlayer = snapshotOf(800, 310); // 3875 bp, under 4000

  it("with the predicate held and the draw succeeding, no battle, reservation, offer or score change exists", () => {
    const result = run(strongPlayer, rules({ probabilityBp: 10_000 }));
    expect(result.outcome).toBe("completed");
    expect(result.suspended).toBeUndefined();
    expect(result.finalSnapshot.wars.battles).toEqual([]);
    expect(result.finalSnapshot.wars.battleManifests ?? []).toEqual([]);
    expect("declinedBattles" in result.finalSnapshot.wars).toBe(false);
    const ships = [...result.finalSnapshot.nations.values()].flatMap((n) =>
      n.fleets.flatMap((f) => f.ships),
    );
    expect(ships.filter((s) => s.inBattleId !== undefined)).toEqual([]);
    const war = result.finalSnapshot.wars.wars[0]!;
    expect([war.attackerWarScore, war.defenderWarScore]).toEqual([0, 0]);
  });

  it("tells the player through one message-bearing event that holds neither the draw nor the enemy force", () => {
    const result = run(strongPlayer, rules({ probabilityBp: 10_000 }));
    const events = withdrawn(result);
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({
      kind: "EnemyDeclinedBattle",
      nationId: ATTACKER_NATION,
      enemyNationId: DEFENDER_NATION,
      battleId: expect.stringContaining("battle_war_1_a-1_fleet_battle"),
      missionType: "FLEET_BATTLE",
      areaId: "a-1",
      enemyVictoryPointCost: 0,
      reasonCode: "ENEMY_DECLINED_BATTLE",
    });
    const text = JSON.stringify(events[0]);
    expect(text).not.toContain("310");
    expect(text).not.toContain("draw");
  });

  it("records exactly one fully-described draw when the predicate holds", () => {
    const result = run(strongPlayer, rules({ probabilityBp: 10_000 }));
    expect(draws(result)).toHaveLength(1);
    const [decision] = draws(result);
    expect(decision).toMatchObject({
      streamId: STREAM,
      entityKey: expect.stringContaining("battle_war_1_a-1_fleet_battle"),
      phase: "battle_generation",
      rulesetVersion: strongPlayer.rulesetVersion,
      outcome: "DECLINED",
      reasonCode: "BATTLE_ENEMY_DECLINED",
    });
    expect(decision?.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isInteger(decision?.draw)).toBe(true);
    expect(decision?.draw).toBeGreaterThanOrEqual(0);
    expect(decision?.draw).toBeLessThan(10_000);
  });

  it("on the complementary draw the offer proceeds as without the section, with the draw still recorded", () => {
    const kept = run(strongPlayer, rules({ probabilityBp: 0 }));
    expect(draws(kept)).toHaveLength(1);
    expect(draws(kept)[0]).toMatchObject({
      outcome: "PROCEEDS",
      reasonCode: "BATTLE_ENEMY_PROCEEDS",
    });
    expect(withdrawn(kept)).toHaveLength(0);
    const request = offerOf(kept);
    expect(request.kind).toBe("offer");
    const accepted = run(strongPlayer, rules({ probabilityBp: 0 }), [answer(request, "accept")]);
    expect(accepted.outcome).toBe("completed");
    expect(accepted.finalSnapshot.wars.battles).toHaveLength(1);
  });

  it("on the complementary draw the offer and the accepted month equal those of a month whose predicate does not hold", () => {
    const proceeds = rules({ probabilityBp: 0 });
    const notHeld = rules({ thresholdBp: 0 });
    const offer = offerOf(run(strongPlayer, proceeds));
    expect(offerOf(run(strongPlayer, notHeld))).toEqual(offer);
    const a = run(strongPlayer, proceeds, [answer(offer, "accept")]);
    const b = run(strongPlayer, notHeld, [answer(offer, "accept")]);
    expect(hashSnapshot(a.finalSnapshot)).toBe(hashSnapshot(b.finalSnapshot));
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
  });

  it("makes no draw when the predicate does not hold", () => {
    for (const snapshot of [snapshotOf(800, 400), snapshotOf(400, 800)]) {
      const result = run(snapshot, rules({ probabilityBp: 10_000 }));
      expect(draws(result)).toHaveLength(0);
      expect(withdrawn(result)).toHaveLength(0);
      expect(result.suspended?.request?.kind).toBe("offer");
    }
  });

  it("states the comparison exactly: equality holds only under LESS_OR_EQUAL", () => {
    const equal = snapshotOf(800, 320); // exactly 4000 bp
    expect(draws(run(equal, rules({ comparison: "LESS_THAN" })))).toHaveLength(0);
    expect(draws(run(equal, rules({ comparison: "LESS_OR_EQUAL" })))).toHaveLength(1);
  });

  it("draws only for a battle in which the player is a party and only when the section and player are supplied", () => {
    const control = run(strongPlayer, undefined, [], false);
    expect(draws(control)).toHaveLength(0);
    expect(control.finalSnapshot.wars.battles).toHaveLength(1);
    const noPlayer = new MonthExecutor().execute(
      strongPlayer,
      [],
      SEED,
      new DiagnosticCollector(),
      undefined,
      { battleOffers: rules({ probabilityBp: 10_000 }) },
    );
    expect(draws(noPlayer)).toHaveLength(0);
    expect(noPlayer.finalSnapshot.wars.battles).toHaveLength(1);
  });

  it("charges the declining enemy only the cost the ruleset states", () => {
    const priced = run(strongPlayer, rules({ probabilityBp: 10_000, enemyCostPoints: 3 }));
    const war = priced.finalSnapshot.wars.wars[0]!;
    // The enemy (FRA) is on the defender side of the fixture war.
    expect([war.attackerWarScore, war.defenderWarScore]).toEqual([0, -3]);
    expect(withdrawn(priced)[0]?.body).toMatchObject({ enemyVictoryPointCost: 3 });
    expect(priced.finalSnapshot.wars.battles).toEqual([]);
  });

  it("is independent of the response order, re-execution and resume", () => {
    const hold = rules({ probabilityBp: 0 });
    const first = run(strongPlayer, hold);
    const request = offerOf(first);
    const again = run(strongPlayer, hold);
    expect(draws(again)).toEqual(draws(first));
    for (const response of ["accept", "delegate", "decline"] as const) {
      const done = run(strongPlayer, hold, [answer(request, response)]);
      expect(draws(done)).toEqual(draws(first));
    }
    const a = run(strongPlayer, rules({ probabilityBp: 10_000 }));
    const b = run(strongPlayer, rules({ probabilityBp: 10_000 }));
    expect(hashSnapshot(a.finalSnapshot)).toBe(hashSnapshot(b.finalSnapshot));
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
    expect(a.randomLedger.hash()).toBe(b.randomLedger.hash());
  });

  it("the draw does not move with the probability, so a ruleset change cannot reorder it", () => {
    const low = draws(run(strongPlayer, rules({ probabilityBp: 1 })))[0]?.draw;
    const high = draws(run(strongPlayer, rules({ probabilityBp: 9_999 })))[0]?.draw;
    expect(low).toBe(high);
  });
});
