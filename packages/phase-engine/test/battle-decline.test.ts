import type { CampaignSnapshot, DeclinedBattleRecord } from "@bluewave/campaign";
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
  unifiedSnapshotHash,
  MonthExecutor,
  priceDecline,
  type InterruptionChannel,
  type MonthResult,
} from "../src/index.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattleSnapshot,
  makeShip,
  makeWar,
} from "./battle-fixtures.js";

const SEED = "decline-seed";
const TURN = "turn-decline";

type Rules = typeof FIXTURE_BATTLE_OFFER_RULES;
const exactModel = { kind: "EXACT", showComposition: false } as const;

function rulesWith(
  decline: Partial<Rules["declineVictoryPoints"]> = {},
  model: Rules["estimateModel"] = exactModel,
): Rules {
  return {
    ...FIXTURE_BATTLE_OFFER_RULES,
    estimateModel: model,
    declineVictoryPoints: { ...FIXTURE_BATTLE_OFFER_RULES.declineVictoryPoints, ...decline },
  };
}

interface RunOptions {
  readonly inputs?: readonly RecordedInput[];
  readonly rules?: Rules;
  readonly player?: string;
}

function run(snapshot: CampaignSnapshot, options: RunOptions = {}): MonthResult {
  const channel: InterruptionChannel = { turnId: TURN, recordedInputs: options.inputs ?? [] };
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    playerNationId: options.player ?? ATTACKER_NATION,
    battleOffers: options.rules ?? rulesWith(),
    interruptions: channel,
  });
}

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

function declined(snapshot: CampaignSnapshot, options: RunOptions = {}): MonthResult {
  const request = offerOf(run(snapshot, options));
  return run(snapshot, { ...options, inputs: [answer(request, "decline")] });
}

const scores = (result: MonthResult) =>
  result.finalSnapshot.wars.wars.map((w) => [w.attackerWarScore, w.defenderWarScore]);

function warSnapshot(war: Parameters<typeof makeWar>[0] = {}): CampaignSnapshot {
  return makeBattleSnapshot({ wars: [makeWar(war)] });
}

function twoAreaSnapshot(): CampaignSnapshot {
  return makeBattleSnapshot({
    areas: ["a-1", "a-2"],
    attackerShips: [
      makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 200 }),
      makeShip("g2", "dv-att-b", ATTACKER_NATION, { firepower: 200 }),
      makeShip("g3", "dv-att-a", ATTACKER_NATION, { firepower: 200, loc: "a-2" }),
      makeShip("g4", "dv-att-b", ATTACKER_NATION, { firepower: 200, loc: "a-2" }),
    ],
    defenderShips: [
      makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: 200 }),
      makeShip("f2", "dv-def-b", DEFENDER_NATION, { firepower: 200 }),
      makeShip("f3", "dv-def-a", DEFENDER_NATION, { firepower: 200, loc: "a-2" }),
      makeShip("f4", "dv-def-b", DEFENDER_NATION, { firepower: 200, loc: "a-2" }),
    ],
  });
}

const allShips = (snapshot: CampaignSnapshot) =>
  [...snapshot.nations.values()].flatMap((n) => n.fleets.flatMap((f) => f.ships));

describe("a decline (R8)", () => {
  const result = declined(warSnapshot());
  const battle = result.finalSnapshot.wars.battles[0];

  it("completes the month with exactly one terminal declined record and a battle that never resolves", () => {
    expect(result.outcome).toBe("completed");
    const records = result.finalSnapshot.wars.declinedBattles ?? [];
    expect(records).toHaveLength(1);
    const [record] = records as [DeclinedBattleRecord];
    expect(record).toMatchObject({
      battleId: battle?.id,
      warId: "war_1",
      nationId: ATTACKER_NATION,
      areaId: "a-1",
      missionType: "FLEET_BATTLE",
      victoryPointCost: 4,
      opponentCredit: 0,
    });
    expect(record.month).toMatch(/^\d{4}-\d{2}$/);
    expect(record.responseInputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(battle?.phase).toBe("declined");
    expect(battle?.result).toBeUndefined();
    expect(result.finalSnapshot.wars.battles.some((b) => b.phase === "resolved")).toBe(false);
  });

  it("releases every reservation with no damage, no loss and no contribution points", () => {
    const before = allShips(warSnapshot());
    const after = allShips(result.finalSnapshot);
    expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id));
    expect(after.every((s) => s.inBattleId === undefined)).toBe(true);
    expect(after.map((s) => s.hitPoints)).toEqual(before.map((s) => s.hitPoints));
    expect(result.finalSnapshot.wars.participantMemberships).toEqual([]);
  });

  it("lowers only the decliner's war score, once, by the fixture rule", () => {
    expect(scores(result)).toEqual([[-4, 0]]);
  });

  it("records one BattleDeclined event with the cost, the credit and the stable reason", () => {
    const events = result.eventLedger.all.filter((e) => e.eventType === "BattleDeclined");
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({
      kind: "BattleDeclined",
      nationId: ATTACKER_NATION,
      battleId: battle?.id,
      missionType: "FLEET_BATTLE",
      areaId: "a-1",
      victoryPointCost: 4,
      opponentCredit: 0,
      declineCount: 1,
      reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES",
    });
    expect(result.eventLedger.all.some((e) => e.eventType === "BattleOfferAnswered")).toBe(false);
  });

  it("charges the defender-side player's own side", () => {
    const asDefender = declined(warSnapshot(), { player: DEFENDER_NATION });
    expect(scores(asDefender)).toEqual([[0, -4]]);
    expect(asDefender.finalSnapshot.wars.declinedBattles?.[0]?.nationId).toBe(DEFENDER_NATION);
  });

  it("is a pure function of its inputs: two passes agree byte for byte", () => {
    const again = declined(warSnapshot());
    expect(unifiedSnapshotHash(again.finalSnapshot)).toBe(
      unifiedSnapshotHash(result.finalSnapshot),
    );
    expect(again.randomLedger.all).toEqual(result.randomLedger.all);
    expect(again.eventLedger.all).toEqual(result.eventLedger.all);
  });
});

describe("the war-score seam (R8)", () => {
  it("clamps the decliner at -100", () => {
    expect(scores(declined(warSnapshot({ attackerWarScore: -98 })))).toEqual([[-100, 0]]);
  });

  it("credits the opponent only when the ruleset shape says so", () => {
    const credit = (opponentCredit: Rules["declineVictoryPoints"]["opponentCredit"]) =>
      scores(declined(warSnapshot(), { rules: rulesWith({ opponentCredit }) }));
    expect(credit({ kind: "NONE" })).toEqual([[-4, 0]]);
    expect(credit({ kind: "MIRROR" })).toEqual([[-4, 4]]);
    expect(credit({ kind: "FRACTION_BP", fractionBp: 3_000 })).toEqual([[-4, 1]]);
    expect(
      scores(
        declined(warSnapshot(), {
          rules: rulesWith({
            opponentCredit: { kind: "FRACTION_BP", fractionBp: 3_000 },
            rounding: "CEIL",
          }),
        }),
      ),
    ).toEqual([[-4, 2]]);
  });

  it("runs the surrender check: a credit that lifts the opponent to the surrender score ends the war", () => {
    const result = declined(warSnapshot({ defenderWarScore: 78 }), {
      rules: rulesWith({ opponentCredit: { kind: "MIRROR" } }),
    });
    expect(scores(result)).toEqual([[-4, 82]]);
    expect(result.finalSnapshot.wars.wars[0]?.status).toBe("ENDED");
  });

  it("does not end the war for a decline that stays under the surrender score", () => {
    expect(declined(warSnapshot({ defenderWarScore: 70 })).finalSnapshot.wars.wars[0]?.status).toBe(
      "ACTIVE",
    );
  });

  it("prices a decline per mission and refuses to price an unlisted mission or an undefined distance measure", () => {
    const rules = FIXTURE_BATTLE_OFFER_RULES;
    expect(priceDecline(rules, "FLEET_BATTLE")).toEqual({ cost: 4, credit: 0 });
    expect(priceDecline(rules, "CRUISER_BATTLE")).toEqual({ cost: 2, credit: 0 });
    expect(priceDecline(rules, "COASTAL_RAID")).toBeNull();
    expect(priceDecline(rules, "toString")).toBeNull();
    const distance = rulesWith({
      distanceModifier: { kind: "REDUCTION_BP", measure: "x", reductionBp: 100 },
    });
    expect(priceDecline(distance, "FLEET_BATTLE")).toBeNull();
  });

  it("refuses, leaving the offer pending, a decline the ruleset cannot price", () => {
    const rules = rulesWith({ pointsByMission: { CRUISER_BATTLE: 2 } });
    const request = offerOf(run(warSnapshot(), { rules }));
    const refused = run(warSnapshot(), { rules, inputs: [answer(request, "decline")] });
    expect(refused.outcome).toBe("suspended");
    expect(refused.suspended?.refusalTag).toBe("OfferDeclineUnpriced");
    expect(refused.suspended?.request).toEqual(request);
  });
});

describe("OPERATIONALLY_UNAVOIDABLE missions (R13)", () => {
  function unavoidable(): CampaignSnapshot {
    const suspended = run(warSnapshot()).finalSnapshot;
    return {
      ...suspended,
      wars: {
        ...suspended.wars,
        battleManifests: (suspended.wars.battleManifests ?? []).map((m) => ({
          ...m,
          acceptanceClass: "OPERATIONALLY_UNAVOIDABLE",
        })),
      },
    };
  }

  it("refuses the decline with the existing typed refusal and leaves the offer pending and unscored", () => {
    const snapshot = unavoidable();
    const request = offerOf(run(snapshot));
    expect(request.acceptanceClass).toBe("OPERATIONALLY_UNAVOIDABLE");
    const refused = run(snapshot, { inputs: [answer(request, "decline")] });
    expect(refused.outcome).toBe("suspended");
    expect(refused.suspended?.reason).toBe("invalid-input");
    expect(refused.suspended?.refusalTag).toBe("BATTLE_DECLINE_NOT_ALLOWED");
    expect(refused.suspended?.request).toEqual(request);
    expect(refused.finalSnapshot.wars.declinedBattles).toBeUndefined();
    expect(scores(refused)).toEqual([[0, 0]]);
  });

  it("still accepts the same battle, now as a player-fought battle", () => {
    const snapshot = unavoidable();
    const request = offerOf(run(snapshot));
    const accepted = run(snapshot, { inputs: [answer(request, "accept")] });
    expect(accepted.outcome).toBe("suspended");
    expect(accepted.suspended?.request?.kind).toBe("battle");
  });
});

describe("several offers in one month (R8, R15)", () => {
  it("a later offer sees the earlier decline's score; records keep canonical order", () => {
    const snapshot = twoAreaSnapshot();
    const first = offerOf(run(snapshot));
    const inputs = [answer(first, "decline")];
    const second = offerOf(run(snapshot, { inputs }));
    expect(second.areaId).toBe("a-2");
    inputs.push(answer(second, "decline"));

    const result = run(snapshot, { inputs });
    expect(result.outcome).toBe("completed");
    expect(scores(result)).toEqual([[-8, 0]]);
    expect(result.finalSnapshot.wars.declinedBattles?.map((r) => r.areaId)).toEqual(["a-1", "a-2"]);
    expect(result.finalSnapshot.wars.declinedBattles?.map((r) => r.battleId)).toEqual([
      first.battleId,
      second.battleId,
    ]);
    const midMonth = run(snapshot, { inputs: [answer(first, "decline")] });
    expect(scores(midMonth)).toEqual([[-4, 0]]);
    expect(midMonth.suspended?.request?.kind).toBe("offer");
  });

  it("answers a mix of decline and delegate; suspend-resume equals one run with every response", () => {
    const snapshot = twoAreaSnapshot();
    const first = offerOf(run(snapshot));
    const inputs = [answer(first, "decline")];
    const second = offerOf(run(snapshot, { inputs }));
    inputs.push(answer(second, "delegate"));
    const resumed = run(snapshot, { inputs });
    const single = run(snapshot, { inputs: [...inputs] });
    expect(resumed.outcome).toBe("completed");
    expect(unifiedSnapshotHash(single.finalSnapshot)).toBe(
      unifiedSnapshotHash(resumed.finalSnapshot),
    );
    expect(single.eventLedger.all).toEqual(resumed.eventLedger.all);
    expect(resumed.finalSnapshot.wars.declinedBattles).toHaveLength(1);
    expect(resumed.finalSnapshot.wars.battles.map((b) => b.phase).sort()).toEqual([
      "declined",
      "resolved",
    ]);
  });
});

describe("duplicates and later months (R8, R15)", () => {
  it("refuses a decline applied twice, scoring once", () => {
    const request = offerOf(run(warSnapshot()));
    const good = answer(request, "decline");
    const duplicate = run(warSnapshot(), { inputs: [good, good] });
    expect(duplicate.outcome).toBe("suspended");
    expect(duplicate.suspended?.refusalTag).toBe("OfferResponseDuplicate");
    expect(duplicate.finalSnapshot.wars.declinedBattles ?? []).toHaveLength(0);
  });

  it("never offers or scores a declined battle again in a later month", () => {
    const first = declined(warSnapshot());
    const next = run(
      { ...first.finalSnapshot, turnNumber: (first.finalSnapshot.turnNumber + 1) as never },
      { inputs: [] },
    );
    const after = next.finalSnapshot.wars;
    expect(after.declinedBattles).toEqual(first.finalSnapshot.wars.declinedBattles);
    expect(after.wars[0]?.attackerWarScore).toBe(
      first.finalSnapshot.wars.wars[0]?.attackerWarScore,
    );
    expect(after.battles.filter((b) => b.phase === "declined")).toHaveLength(1);
  });
});

describe("dormancy (R1, R15)", () => {
  it("a month that never declines carries no declined collection, so its hash is unchanged", () => {
    const control = new MonthExecutor().execute(warSnapshot(), [], SEED, new DiagnosticCollector());
    expect(control.finalSnapshot.wars.declinedBattles).toBeUndefined();
    expect("declinedBattles" in control.finalSnapshot.wars).toBe(false);
  });
});
