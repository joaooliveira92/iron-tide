import type { CampaignSnapshot, DeclineCounterEntry } from "@bluewave/campaign";
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
  tallyDecline,
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

type Rules = typeof FIXTURE_BATTLE_OFFER_RULES;
type Counter = Rules["declineCounter"];
const WAR_1 = makeWar({ id: "war_1" });
const WAR_2 = makeWar({ id: "war_2", status: "ACTIVE" });
const ENDED = makeWar({ id: "war_ended", status: "ENDED" });

function counter(over: Partial<Counter> = {}): Counter {
  return { ...FIXTURE_BATTLE_OFFER_RULES.declineCounter, ...over };
}

interface Step {
  readonly rules?: Counter;
  readonly repeatEach?: boolean;
  readonly warId?: string;
  readonly nationId?: string;
  readonly month?: string;
}

function decline(entries: readonly DeclineCounterEntry[] | undefined, step: Step = {}) {
  return tallyDecline(entries, {
    rules: step.rules ?? counter(),
    repeatEachDecline: step.repeatEach ?? false,
    warId: step.warId ?? "war_1",
    nationId: step.nationId ?? ATTACKER_NATION,
    month: step.month ?? "1880-01",
    wars: [WAR_1, WAR_2, ENDED],
  });
}

describe("tallyDecline (R9)", () => {
  it("is absent until the first decline, then rises by exactly one per decline", () => {
    const first = decline(undefined);
    expect(first.count).toBe(1);
    expect(first.thresholdReached).toBe(false);
    expect(first.entries).toEqual([
      {
        key: `WAR|war_1|${ATTACKER_NATION}`,
        nationId: ATTACKER_NATION,
        lastWarId: "war_1",
        count: 1,
        decayAnchorMonth: "1880-01",
      },
    ]);
    const second = decline(first.entries, { month: "1880-02" });
    expect(second.count).toBe(2);
    expect(decline(second.entries, { month: "1880-03" }).count).toBe(3);
  });

  it("never mutates its input", () => {
    const first = decline(undefined).entries;
    const frozen = JSON.stringify(first);
    decline(first, {
      month: "1880-09",
      rules: counter({ reset: { kind: "DECAY", countRemoved: 1, perMonths: 1 } }),
    });
    expect(JSON.stringify(first)).toBe(frozen);
  });

  it("raises the threshold exactly when the count reaches it, and not again by default", () => {
    const one = decline(undefined);
    const two = decline(one.entries);
    const three = decline(two.entries);
    expect([one, two, three].map((r) => r.thresholdReached)).toEqual([false, true, false]);
  });

  it("raises it again on every further decline only under the declared repeat rule", () => {
    const two = decline(decline(undefined).entries, { repeatEach: true });
    const three = decline(two.entries, { repeatEach: true });
    const four = decline(three.entries, { repeatEach: true });
    expect([two, three, four].map((r) => r.thresholdReached)).toEqual([true, true, true]);
    expect(four.count).toBe(4);
  });

  it("WAR scope keeps one tally per war and nation", () => {
    const a = decline(undefined, { warId: "war_1" });
    const b = decline(a.entries, { warId: "war_2" });
    expect(b.count).toBe(1);
    expect(b.entries.map((e) => e.key)).toEqual([
      `WAR|war_1|${ATTACKER_NATION}`,
      `WAR|war_2|${ATTACKER_NATION}`,
    ]);
    expect(decline(b.entries, { warId: "war_1" }).count).toBe(2);
  });

  it("NATION scope pools a nation's declines across wars but not across nations", () => {
    const rules = counter({ scope: "NATION" });
    const a = decline(undefined, { rules, warId: "war_1" });
    const b = decline(a.entries, { rules, warId: "war_2" });
    expect(b.count).toBe(2);
    expect(b.thresholdReached).toBe(true);
    expect(decline(b.entries, { rules, nationId: DEFENDER_NATION }).count).toBe(1);
  });

  it("CAMPAIGN scope keeps one tally for the whole campaign", () => {
    const rules = counter({ scope: "CAMPAIGN" });
    const a = decline(undefined, { rules, warId: "war_1" });
    const b = decline(a.entries, { rules, warId: "war_2", nationId: DEFENDER_NATION });
    expect(b.count).toBe(2);
    expect(b.entries.map((e) => e.key)).toEqual(["CAMPAIGN"]);
  });

  it("a scope change never reuses a tally of another scope", () => {
    const warScoped = decline(undefined);
    const nationScoped = decline(warScoped.entries, { rules: counter({ scope: "NATION" }) });
    expect(nationScoped.count).toBe(1);
    expect(nationScoped.entries).toHaveLength(2);
  });

  it("ON_WAR_END clears a pooled tally once its last war has ended, and not before", () => {
    const rules = counter({ scope: "NATION", reset: { kind: "ON_WAR_END" } });
    const inEnded = decline(undefined, { rules, warId: "war_ended" });
    const inEndedToo = decline(inEnded.entries, { rules, warId: "war_1" });
    expect(inEndedToo.count).toBe(1);
    expect(inEndedToo.thresholdReached).toBe(false);
    const inActive = decline(decline(undefined, { rules, warId: "war_1" }).entries, {
      rules,
      warId: "war_2",
    });
    expect(inActive.count).toBe(2);
  });

  it("reset NONE never clears the tally", () => {
    const rules = counter({ scope: "NATION", reset: { kind: "NONE" } });
    const a = decline(undefined, { rules, warId: "war_ended" });
    expect(decline(a.entries, { rules, warId: "war_1", month: "1999-12" }).count).toBe(2);
  });

  describe("DECAY", () => {
    const rules = counter({
      threshold: 3,
      reset: { kind: "DECAY", countRemoved: 1, perMonths: 2 },
    });
    const seeded = (count: number, anchor: string): DeclineCounterEntry[] => [
      {
        key: `WAR|war_1|${ATTACKER_NATION}`,
        nationId: ATTACKER_NATION,
        lastWarId: "war_1",
        count,
        decayAnchorMonth: anchor,
      },
    ];

    it("removes the declared count for every whole period since the anchor, then adds the decline", () => {
      const sameMonth = decline(seeded(3, "1880-01"), { rules, month: "1880-01" });
      expect(sameMonth.count).toBe(4);
      const oneMonth = decline(seeded(3, "1880-01"), { rules, month: "1880-02" });
      expect(oneMonth.count).toBe(4);
      const onePeriod = decline(seeded(3, "1880-01"), { rules, month: "1880-03" });
      expect(onePeriod.count).toBe(3);
      expect(onePeriod.entries[0]?.decayAnchorMonth).toBe("1880-03");
      const partial = decline(seeded(3, "1880-01"), { rules, month: "1880-04" });
      expect(partial.count).toBe(3);
      expect(partial.entries[0]?.decayAnchorMonth).toBe("1880-03");
      const twoPeriods = decline(seeded(3, "1880-01"), { rules, month: "1880-05" });
      expect(twoPeriods.count).toBe(2);
    });

    it("crosses the year boundary and never goes below zero", () => {
      expect(decline(seeded(3, "1880-11"), { rules, month: "1881-03" }).count).toBe(2);
      const gone = decline(seeded(2, "1880-01"), { rules, month: "1890-01" });
      expect(gone.count).toBe(1);
      expect(gone.entries[0]?.decayAnchorMonth).toBe("1890-01");
    });

    it("raises the threshold again when a decayed tally climbs back to it", () => {
      const decayed = decline(seeded(3, "1880-01"), { rules, month: "1880-05" });
      expect(decayed.thresholdReached).toBe(false);
      const back = decline(decayed.entries, { rules, month: "1880-05" });
      expect(back.count).toBe(3);
      expect(back.thresholdReached).toBe(true);
    });
  });
});

const SEED = "decline-counter-seed";
const TURN = "turn-decline-counter";

function run(
  snapshot: CampaignSnapshot,
  inputs: readonly RecordedInput[] = [],
  rules: Rules = FIXTURE_BATTLE_OFFER_RULES,
): MonthResult {
  const channel: InterruptionChannel = { turnId: TURN, recordedInputs: inputs };
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    playerNationId: ATTACKER_NATION,
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

function script(snapshot: CampaignSnapshot, responses: readonly OfferResponse[]): MonthResult {
  const inputs: RecordedInput[] = [];
  let result = run(snapshot, inputs);
  for (const response of responses) {
    inputs.push(answer(offerOf(result), response));
    result = run(snapshot, inputs);
  }
  return result;
}

const thresholdEvents = (result: MonthResult) =>
  result.eventLedger.all.filter((e) => e.body.kind === "DeclineThresholdReached");

describe("the tally in a compiled month (R9)", () => {
  it("is absent before the first decline and while the player never declines", () => {
    const suspended = run(twoAreaSnapshot());
    expect(suspended.finalSnapshot.wars.declineCounters).toBeUndefined();
    const accepted = script(twoAreaSnapshot(), ["delegate", "delegate"]);
    expect(accepted.outcome).toBe("completed");
    expect("declineCounters" in accepted.finalSnapshot.wars).toBe(false);
    expect(thresholdEvents(accepted)).toHaveLength(0);
  });

  it("counts a decline, raises nothing below the threshold, then raises one fully-described event at it", () => {
    const one = script(twoAreaSnapshot(), ["decline"]);
    expect(one.outcome).toBe("suspended");
    expect(one.finalSnapshot.wars.declineCounters).toEqual([
      expect.objectContaining({ nationId: ATTACKER_NATION, lastWarId: "war_1", count: 1 }),
    ]);
    expect(thresholdEvents(one)).toHaveLength(0);

    const two = script(twoAreaSnapshot(), ["decline", "decline"]);
    expect(two.outcome).toBe("completed");
    expect(two.finalSnapshot.wars.declineCounters?.[0]?.count).toBe(2);
    const events = thresholdEvents(two);
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({
      kind: "DeclineThresholdReached",
      nationId: ATTACKER_NATION,
      battleId: two.finalSnapshot.wars.declinedBattles?.[1]?.battleId,
      count: 2,
      threshold: 2,
      scope: "WAR",
      rulesetVersion: two.finalSnapshot.rulesetVersion,
    });
  });

  it("a mix of decline and accept counts only the decline", () => {
    const mixed = script(twoAreaSnapshot(), ["decline", "accept"]);
    expect(mixed.finalSnapshot.wars.declineCounters?.[0]?.count).toBe(1);
    expect(thresholdEvents(mixed)).toHaveLength(0);
  });

  it("starts the next month from the saved tally, so a later decline reaches the threshold", () => {
    const first = script(twoAreaSnapshot(), ["decline", "accept"]);
    const seeded: CampaignSnapshot = {
      ...twoAreaSnapshot(),
      wars: {
        ...twoAreaSnapshot().wars,
        declineCounters: first.finalSnapshot.wars.declineCounters!,
      },
    };
    const next = script(seeded, ["decline"]);
    expect(next.finalSnapshot.wars.declineCounters?.[0]?.count).toBe(2);
    expect(thresholdEvents(next)).toHaveLength(1);
  });

  it("suspend-resume equals one run with every response, tally and event included", () => {
    const resumed = script(twoAreaSnapshot(), ["decline", "decline"]);
    const request1 = offerOf(run(twoAreaSnapshot()));
    const request2 = offerOf(run(twoAreaSnapshot(), [answer(request1, "decline")]));
    const single = run(twoAreaSnapshot(), [
      answer(request1, "decline"),
      answer(request2, "decline"),
    ]);
    expect(hashSnapshot(single.finalSnapshot)).toBe(hashSnapshot(resumed.finalSnapshot));
    expect(single.eventLedger.all).toEqual(resumed.eventLedger.all);
    expect(single.finalSnapshot.wars.declineCounters).toEqual(
      resumed.finalSnapshot.wars.declineCounters,
    );
  });

  it("two passes of the scripted run are byte-identical", () => {
    const a = script(twoAreaSnapshot(), ["decline", "decline"]);
    const b = script(twoAreaSnapshot(), ["decline", "decline"]);
    expect(hashSnapshot(a.finalSnapshot)).toBe(hashSnapshot(b.finalSnapshot));
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
  });

  it("a month with no battle offers section carries no tally and the unchanged hash", () => {
    const control = new MonthExecutor().execute(
      twoAreaSnapshot(),
      [],
      SEED,
      new DiagnosticCollector(),
    );
    expect("declineCounters" in control.finalSnapshot.wars).toBe(false);
    expect(thresholdEvents(control)).toHaveLength(0);
  });

  it("honours the NATION and CAMPAIGN scopes and a decaying tally in the month", () => {
    for (const scope of ["NATION", "CAMPAIGN"] as const) {
      const rules: Rules = {
        ...FIXTURE_BATTLE_OFFER_RULES,
        declineCounter: counter({ scope }),
      };
      const snapshot = twoAreaSnapshot();
      const inputs: RecordedInput[] = [];
      let result = run(snapshot, inputs, rules);
      for (let i = 0; i < 2; i += 1) {
        inputs.push(answer(offerOf(result), "decline"));
        result = run(snapshot, inputs, rules);
      }
      expect(result.finalSnapshot.wars.declineCounters).toHaveLength(1);
      expect(result.finalSnapshot.wars.declineCounters?.[0]?.key).toBe(
        scope === "NATION" ? `NATION|${ATTACKER_NATION}` : "CAMPAIGN",
      );
      expect(thresholdEvents(result)).toHaveLength(1);
    }
  });
});
