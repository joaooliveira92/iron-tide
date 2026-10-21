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

// T-1 06 (#115, spec #109 R10): the threshold crossing lowers the PLAYER's prestige through the S-2 seam. Every value is
// FIXTURE-CLASS: threshold 2, a fixed 3-point loss, fixture nations at prestige 20 inside the fixture bounds 0..100.
const SEED = "decline-prestige-seed";
const TURN = "turn-decline-prestige";

type Rules = typeof FIXTURE_BATTLE_OFFER_RULES;
const FIXED_LOSS_3: NonNullable<Rules["declinedBattlePrestige"]> = {
  rule: { kind: "FIXED_LOSS", amount: 3 },
  repeat: "ONCE_AT_THRESHOLD",
};
const withPrestige = (over: Rules["declinedBattlePrestige"]): Rules => ({
  ...FIXTURE_BATTLE_OFFER_RULES,
  ...(over === undefined ? {} : { declinedBattlePrestige: over }),
});

function run(
  snapshot: CampaignSnapshot,
  inputs: readonly RecordedInput[],
  rules: Rules,
  player = ATTACKER_NATION,
): MonthResult {
  const channel: InterruptionChannel = { turnId: TURN, recordedInputs: inputs };
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    playerNationId: player,
    battleOffers: rules,
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

/** Answer each offer in order until the month completes or the responses run out. */
function script(
  responses: readonly OfferResponse[],
  rules: Rules,
  player = ATTACKER_NATION,
  snapshot = twoAreaSnapshot(),
): MonthResult {
  const inputs: RecordedInput[] = [];
  let result = run(snapshot, inputs, rules, player);
  for (const response of responses) {
    inputs.push(answer(offerOf(result), response));
    result = run(snapshot, inputs, rules, player);
  }
  return result;
}

const prestigeOf = (result: MonthResult, nation: string) =>
  result.finalSnapshot.nations.get(nation)?.prestige;
const prestigeEvents = (result: MonthResult) =>
  result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged");

describe("declined battles cost the player prestige at the threshold (R10)", () => {
  it("changes nothing below the threshold, then lowers prestige once at the crossing with the full S-2 event", () => {
    const one = script(["decline"], withPrestige(FIXED_LOSS_3));
    expect(prestigeOf(one, ATTACKER_NATION)).toBe(20);
    expect(prestigeEvents(one)).toHaveLength(0);

    const two = script(["decline", "decline"], withPrestige(FIXED_LOSS_3));
    expect(two.outcome).toBe("completed");
    expect(prestigeOf(two, ATTACKER_NATION)).toBe(17);
    const events = prestigeEvents(two);
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({
      kind: "PrestigeChanged",
      nationId: ATTACKER_NATION,
      reasonCode: "DECLINED_BATTLE",
      ruleKind: "FIXED_LOSS",
      before: 20,
      after: 17,
      delta: -3,
      rulesetVersion: two.finalSnapshot.rulesetVersion,
    });
    const kinds = two.eventLedger.all.map((e) => e.body.kind);
    expect(kinds.indexOf("DeclineThresholdReached")).toBeLessThan(kinds.indexOf("PrestigeChanged"));
  });

  it("a proportional rule goes through the same seam", () => {
    const rules = withPrestige({
      rule: { kind: "PROPORTIONAL_LOSS", basisPoints: 1_000 },
      repeat: "ONCE_AT_THRESHOLD",
    });
    const two = script(["decline", "decline"], rules);
    expect(prestigeOf(two, ATTACKER_NATION)).toBe(18);
  });

  it("a zero-delta rule emits nothing and changes nothing", () => {
    const rules = withPrestige({
      rule: { kind: "FIXED_LOSS", amount: 0 },
      repeat: "ONCE_AT_THRESHOLD",
    });
    const two = script(["decline", "decline"], rules);
    expect(prestigeOf(two, ATTACKER_NATION)).toBe(20);
    expect(prestigeEvents(two)).toHaveLength(0);
  });

  it("a month with an accept and a decline crosses nothing", () => {
    const mixed = script(["decline", "accept"], withPrestige(FIXED_LOSS_3));
    expect(prestigeOf(mixed, ATTACKER_NATION)).toBe(20);
    expect(prestigeEvents(mixed)).toHaveLength(0);
  });

  it("charges again on each further decline only under the declared repeat rule", () => {
    const once = script(["decline", "decline"], withPrestige(FIXED_LOSS_3));
    const seeded = (r: MonthResult): CampaignSnapshot => ({
      ...twoAreaSnapshot(),
      nations: r.finalSnapshot.nations,
      wars: { ...twoAreaSnapshot().wars, declineCounters: r.finalSnapshot.wars.declineCounters! },
    });
    const nextOnce = script(["decline"], withPrestige(FIXED_LOSS_3), ATTACKER_NATION, seeded(once));
    expect(prestigeOf(nextOnce, ATTACKER_NATION)).toBe(17);

    const each = withPrestige({ ...FIXED_LOSS_3, repeat: "EACH_FURTHER_DECLINE" });
    const eachTwo = script(["decline", "decline"], each);
    const nextEach = script(["decline"], each, ATTACKER_NATION, seeded(eachTwo));
    expect(prestigeOf(nextEach, ATTACKER_NATION)).toBe(14);
    expect(prestigeEvents(nextEach)).toHaveLength(1);
  });

  it("keeps prestige inside the S-2 bounds", () => {
    const rules = withPrestige({
      rule: { kind: "FIXED_LOSS", amount: 500 },
      repeat: "ONCE_AT_THRESHOLD",
    });
    const two = script(["decline", "decline"], rules);
    expect(prestigeOf(two, ATTACKER_NATION)).toBe(0);
    expect(prestigeEvents(two)[0]?.body).toMatchObject({ before: 20, after: 0, delta: -20 });
  });

  it("only the player's declines move prestige: the other nation is untouched", () => {
    const two = script(["decline", "decline"], withPrestige(FIXED_LOSS_3));
    expect(prestigeOf(two, DEFENDER_NATION)).toBe(20);
    const asDefender = script(["decline", "decline"], withPrestige(FIXED_LOSS_3), DEFENDER_NATION);
    expect(prestigeOf(asDefender, DEFENDER_NATION)).toBe(17);
    expect(prestigeOf(asDefender, ATTACKER_NATION)).toBe(20);
  });

  it("is dormant without the prestige sub-rule: counter and event only, prestige untouched", () => {
    const two = script(["decline", "decline"], FIXTURE_BATTLE_OFFER_RULES);
    expect(two.finalSnapshot.wars.declineCounters?.[0]?.count).toBe(2);
    expect(two.eventLedger.all.some((e) => e.body.kind === "DeclineThresholdReached")).toBe(true);
    expect(prestigeEvents(two)).toHaveLength(0);
    expect(prestigeOf(two, ATTACKER_NATION)).toBe(20);
  });

  it("suspend-resume equals one run with every response, and two passes are byte-identical", () => {
    const rules = withPrestige(FIXED_LOSS_3);
    const resumed = script(["decline", "decline"], rules);
    const request1 = offerOf(run(twoAreaSnapshot(), [], rules));
    const request2 = offerOf(run(twoAreaSnapshot(), [answer(request1, "decline")], rules));
    const single = run(
      twoAreaSnapshot(),
      [answer(request1, "decline"), answer(request2, "decline")],
      rules,
    );
    expect(hashSnapshot(single.finalSnapshot)).toBe(hashSnapshot(resumed.finalSnapshot));
    expect(single.eventLedger.all).toEqual(resumed.eventLedger.all);
    const again = script(["decline", "decline"], rules);
    expect(hashSnapshot(again.finalSnapshot)).toBe(hashSnapshot(resumed.finalSnapshot));
    expect(again.eventLedger.hash()).toBe(resumed.eventLedger.hash());
  });
});
