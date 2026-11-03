import type {
  EventResolutionRules,
  GameEvent,
  GovernmentType,
  NationTrait,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  aiStanceWeights,
  eligibleEvents,
  eventAnswerStreamId,
  eventDrawStreamId,
  eventIneligibleReason,
  isDilemmaOverdue,
  monthIndex,
  pickAiAnswer,
  recordEventAnswer,
  resolveEventCounterpart,
  selectEvent,
  withPendingDilemma,
  type EventEligibilityContext,
} from "../src/eventDraw.js";
import type { DiplomaticRelation, NationEventHistory } from "../src/state.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL",
} as GameEvent["provenance"];

const effects = { budgetBp: 0, unrest: 0 };

function event(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "border_incident",
    titleKey: "event.border_incident.title",
    bodyKey: "event.border_incident.body",
    gates: {},
    weightBp: 1_000,
    cooldownMonths: 24,
    once: false,
    defaultAnswerId: "protest",
    answers: [
      { id: "mobilise", stance: "hawk", labelKey: "a.hawk", effects },
      { id: "protest", stance: "dove", labelKey: "a.dove", effects },
    ],
    provenance,
    ...overrides,
  };
}

const RULES = {
  sectionVersion: 1,
  defaultAnswerAfterMonths: 3,
  aiStanceWeightsBp: {
    liberal_democracy: { hawkBp: 2_000, doveBp: 6_000, neutralBp: 2_000 },
    limited_democracy: { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 },
    autocratic: { hawkBp: 6_000, doveBp: 2_000, neutralBp: 2_000 },
    fascist: { hawkBp: 7_000, doveBp: 1_000, neutralBp: 2_000 },
    communist: { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 },
    eastern: { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 },
  },
  traitShifts: [{ trait: "cautious", stance: "hawk", deltaBp: -1_500 }],
  provenance,
} as EventResolutionRules;

const EMPTY: NationEventHistory = { fired: [], flags: [] };

function relation(
  nationA: string,
  nationB: string,
  tension: number,
  kind: DiplomaticRelation["relation"] = "neutral",
): DiplomaticRelation {
  return { nationA, nationB, relation: kind, tension, nap: false, since: "1880-01" };
}

function context(overrides: Partial<EventEligibilityContext> = {}): EventEligibilityContext {
  return {
    nation: { id: "uk", governmentType: "liberal_democracy", traits: [] },
    history: EMPTY,
    month: "1880-06",
    relations: [relation("france", "uk", 6)],
    ...overrides,
  };
}

describe("stream ids", () => {
  it("domain-separates the draw and the answer by nation and month", () => {
    expect(eventDrawStreamId("uk", "1880-06")).toBe("events/uk/1880-06");
    expect(eventAnswerStreamId("uk", "1880-06")).toBe("events/uk/1880-06/answer");
  });
});

describe("monthIndex", () => {
  it("counts months across a year boundary", () => {
    expect(monthIndex("1881-01") - monthIndex("1880-12")).toBe(1);
  });
});

describe("resolveEventCounterpart", () => {
  const relations = [
    relation("uk", "france", 6),
    relation("germany", "uk", 8),
    relation("uk", "italy", 8),
    relation("uk", "russia", 10, "at_war"),
  ];

  it("picks the highest-tension non-war partner, ties by lowest id", () => {
    expect(resolveEventCounterpart("uk", "highest_tension_rival", relations)).toEqual({
      nationId: "germany",
      tension: 8,
    });
  });

  it("picks the war partner for war_enemy", () => {
    expect(resolveEventCounterpart("uk", "war_enemy", relations)).toEqual({
      nationId: "russia",
      tension: 10,
    });
  });

  it("is absent when no relation matches", () => {
    expect(resolveEventCounterpart("uk", "war_enemy", relations.slice(0, 3))).toBeUndefined();
    expect(resolveEventCounterpart("spain", "highest_tension_rival", relations)).toBeUndefined();
  });

  it("does not depend on relation order", () => {
    expect(
      resolveEventCounterpart("uk", "highest_tension_rival", [...relations].reverse()),
    ).toEqual(resolveEventCounterpart("uk", "highest_tension_rival", relations));
  });
});

describe("eventIneligibleReason", () => {
  it("passes an event with no gates", () => {
    expect(eventIneligibleReason(event(), context())).toBeUndefined();
  });

  it("blocks a government type outside the gate, including an unset one", () => {
    const gated = event({ gates: { governmentTypes: ["autocratic"] } });
    expect(eventIneligibleReason(gated, context())).toBe("GOVERNMENT_TYPE");
    expect(eventIneligibleReason(gated, context({ nation: { id: "uk", traits: [] } }))).toBe(
      "GOVERNMENT_TYPE",
    );
    expect(
      eventIneligibleReason(
        gated,
        context({ nation: { id: "uk", governmentType: "autocratic", traits: [] } }),
      ),
    ).toBeUndefined();
  });

  it("blocks outside the era window and allows both edges", () => {
    const gated = event({ gates: { eraWindow: { fromMonth: "1880-06", toMonth: "1880-08" } } });
    expect(eventIneligibleReason(gated, context({ month: "1880-05" }))).toBe("ERA_WINDOW");
    expect(eventIneligibleReason(gated, context({ month: "1880-06" }))).toBeUndefined();
    expect(eventIneligibleReason(gated, context({ month: "1880-08" }))).toBeUndefined();
    expect(eventIneligibleReason(gated, context({ month: "1880-09" }))).toBe("ERA_WINDOW");
  });

  it("blocks a tension outside the range against the named counterpart", () => {
    const gated = event({
      gates: { tension: { counterpart: "highest_tension_rival", min: 7, max: 9 } },
    });
    expect(eventIneligibleReason(gated, context())).toBe("TENSION_RANGE");
    expect(
      eventIneligibleReason(gated, context({ relations: [relation("france", "uk", 7)] })),
    ).toBeUndefined();
    expect(eventIneligibleReason(gated, context({ relations: [] }))).toBe("TENSION_RANGE");
  });

  it("enforces required and excluded traits and flags", () => {
    const traitNation = (traits: NationTrait[]) =>
      context({ nation: { id: "uk", governmentType: "liberal_democracy", traits } });
    const required = event({ gates: { requiredTraits: ["cautious"] } });
    expect(eventIneligibleReason(required, context())).toBe("REQUIRED_TRAIT");
    expect(eventIneligibleReason(required, traitNation(["cautious"]))).toBeUndefined();
    const excluded = event({ gates: { excludedTraits: ["cautious"] } });
    expect(eventIneligibleReason(excluded, traitNation(["cautious"]))).toBe("EXCLUDED_TRAIT");

    const flagged = event({ gates: { requiredFlags: ["crisis"], excludedFlags: ["calm"] } });
    expect(eventIneligibleReason(flagged, context())).toBe("REQUIRED_FLAG");
    expect(
      eventIneligibleReason(flagged, context({ history: { fired: [], flags: ["crisis"] } })),
    ).toBeUndefined();
    expect(
      eventIneligibleReason(
        flagged,
        context({ history: { fired: [], flags: ["crisis", "calm"] } }),
      ),
    ).toBe("EXCLUDED_FLAG");
  });

  it("holds a once event after it has fired by any resolver", () => {
    const once = event({ once: true, cooldownMonths: 0 });
    const history: NationEventHistory = {
      fired: [
        { eventId: "border_incident", month: "1870-01", answerId: "protest", resolvedBy: "AI" },
      ],
      flags: [],
    };
    expect(eventIneligibleReason(once, context({ history }))).toBe("ONCE_FIRED");
  });

  it("holds an event for its cooldown and releases it exactly when it elapses", () => {
    const history: NationEventHistory = {
      fired: [
        {
          eventId: "border_incident",
          month: "1880-01",
          answerId: "protest",
          resolvedBy: "DEFAULT",
        },
      ],
      flags: [],
    };
    const cooled = event({ cooldownMonths: 6 });
    expect(eventIneligibleReason(cooled, context({ history, month: "1880-06" }))).toBe("COOLDOWN");
    expect(eventIneligibleReason(cooled, context({ history, month: "1880-07" }))).toBeUndefined();
    expect(
      eventIneligibleReason(event({ cooldownMonths: 0 }), context({ history, month: "1880-01" })),
    ).toBeUndefined();
  });

  it("measures the cooldown from the latest firing, not the first", () => {
    const history: NationEventHistory = {
      fired: [
        { eventId: "border_incident", month: "1880-10", answerId: "protest", resolvedBy: "AI" },
        { eventId: "border_incident", month: "1879-01", answerId: "protest", resolvedBy: "AI" },
      ],
      flags: [],
    };
    expect(
      eventIneligibleReason(event({ cooldownMonths: 12 }), context({ history, month: "1881-06" })),
    ).toBe("COOLDOWN");
  });

  it("ignores the firing of other events", () => {
    const history: NationEventHistory = {
      fired: [{ eventId: "other", month: "1880-05", answerId: "protest", resolvedBy: "AI" }],
      flags: [],
    };
    expect(eventIneligibleReason(event({ once: true }), context({ history }))).toBeUndefined();
  });
});

describe("eligibleEvents and selectEvent", () => {
  const a = event({ id: "a_event", weightBp: 3_000 });
  const b = event({ id: "b_event", weightBp: 2_000 });
  const c = event({ id: "c_event", weightBp: 1_000, gates: { governmentTypes: ["fascist"] } });

  it("filters by gates and orders by id regardless of catalogue order", () => {
    expect(eligibleEvents([c, b, a], context()).map((e) => e.id)).toEqual(["a_event", "b_event"]);
  });

  it("walks cumulative weight in id order", () => {
    const eligible = [a, b];
    expect(selectEvent(eligible, 0).event?.id).toBe("a_event");
    expect(selectEvent(eligible, 2_999).event?.id).toBe("a_event");
    expect(selectEvent(eligible, 3_000).event?.id).toBe("b_event");
    expect(selectEvent(eligible, 4_999).event?.id).toBe("b_event");
    expect(selectEvent(eligible, 5_000).event).toBeUndefined();
    expect(selectEvent(eligible, 9_999).event).toBeUndefined();
  });

  it("scales the draw so weights above the range stay reachable", () => {
    const heavy = [event({ id: "x", weightBp: 9_000 }), event({ id: "y", weightBp: 9_000 })];
    expect(selectEvent(heavy, 0).event?.id).toBe("x");
    expect(selectEvent(heavy, 9_999).event?.id).toBe("y");
  });

  it("picks nothing from an empty set", () => {
    expect(selectEvent([], 0)).toEqual({ totalWeightBp: 0 });
  });
});

describe("aiStanceWeights and pickAiAnswer", () => {
  const nation = (governmentType: GovernmentType, traits: NationTrait[] = []) => ({
    governmentType,
    traits,
  });

  it("weights hawk up for autocratic and fascist and dove up for liberal democracy", () => {
    const liberal = aiStanceWeights(nation("liberal_democracy"), RULES)!;
    const autocratic = aiStanceWeights(nation("autocratic"), RULES)!;
    const fascist = aiStanceWeights(nation("fascist"), RULES)!;
    expect(liberal.dove).toBeGreaterThan(liberal.hawk);
    expect(autocratic.hawk).toBeGreaterThan(autocratic.dove);
    expect(fascist.hawk).toBeGreaterThan(autocratic.hawk);
  });

  it("applies trait shifts and floors a stance at zero", () => {
    expect(aiStanceWeights(nation("autocratic", ["cautious"]), RULES)!.hawk).toBe(4_500);
    const crushing = {
      ...RULES,
      traitShifts: [{ trait: "cautious", stance: "hawk", deltaBp: -10_000 }],
    } as EventResolutionRules;
    expect(aiStanceWeights(nation("autocratic", ["cautious"]), crushing)!.hawk).toBe(0);
  });

  it("is absent for a nation with no government type", () => {
    expect(aiStanceWeights({ traits: [] }, RULES)).toBeUndefined();
  });

  it("shifts the chosen stance with government type for the same draw", () => {
    const hawkShare = (governmentType: GovernmentType): number => {
      let hawks = 0;
      for (let draw = 0; draw < 10_000; draw += 1) {
        if (pickAiAnswer(event(), nation(governmentType), RULES, draw).stance === "hawk")
          hawks += 1;
      }
      return hawks;
    };
    const liberal = hawkShare("liberal_democracy");
    const fascist = hawkShare("fascist");
    expect(fascist).toBeGreaterThan(liberal);
    expect(liberal).toBe(2_500);
    expect(fascist).toBe(8_750);
  });

  it("never picks a neutral stance the event does not offer", () => {
    for (let draw = 0; draw < 10_000; draw += 500) {
      expect(pickAiAnswer(event(), nation("autocratic"), RULES, draw).stance).not.toBe("neutral");
    }
  });

  it("splits a stance evenly across several answers of that stance", () => {
    const twin = event({
      answers: [
        { id: "mobilise", stance: "hawk", labelKey: "a", effects },
        { id: "sortie", stance: "hawk", labelKey: "b", effects },
        { id: "protest", stance: "dove", labelKey: "c", effects },
      ],
    });
    const ids = new Set<string>();
    for (let draw = 0; draw < 10_000; draw += 100) {
      ids.add(pickAiAnswer(twin, nation("autocratic"), RULES, draw).answerId);
    }
    expect([...ids].sort()).toEqual(["mobilise", "protest", "sortie"]);
  });

  it("falls back to the default answer when no stance has weight", () => {
    const choice = pickAiAnswer(event(), { traits: [] }, RULES, 0);
    expect(choice).toMatchObject({ answerId: "protest", reasonCode: "AI_NO_WEIGHT" });
  });

  it("is a pure function of its inputs", () => {
    const first = pickAiAnswer(event(), nation("fascist"), RULES, 4_321);
    const second = pickAiAnswer(event(), nation("fascist"), RULES, 4_321);
    expect(second).toEqual(first);
  });
});

describe("isDilemmaOverdue", () => {
  const pending = { eventId: "border_incident", drawnMonth: "1880-06" };

  it("is not overdue at month 2 and is overdue at month 3", () => {
    expect(isDilemmaOverdue(pending, "1880-06", RULES)).toBe(false);
    expect(isDilemmaOverdue(pending, "1880-08", RULES)).toBe(false);
    expect(isDilemmaOverdue(pending, "1880-09", RULES)).toBe(true);
    expect(isDilemmaOverdue(pending, "1880-12", RULES)).toBe(true);
  });
});

describe("pending and answer history", () => {
  it("records a pending dilemma without touching the fired list", () => {
    const next = withPendingDilemma(EMPTY, { eventId: "border_incident", drawnMonth: "1880-06" });
    expect(next.pending).toEqual({ eventId: "border_incident", drawnMonth: "1880-06" });
    expect(next.fired).toEqual([]);
    expect(EMPTY.pending).toBeUndefined();
  });

  it.each(["PLAYER", "AI", "DEFAULT"] as const)(
    "writes a %s answer and clears pending",
    (resolvedBy) => {
      const pending = withPendingDilemma(EMPTY, {
        eventId: "border_incident",
        drawnMonth: "1880-06",
      });
      const next = recordEventAnswer(pending, {
        eventId: "border_incident",
        month: "1880-07",
        answerId: "protest",
        resolvedBy,
      });
      expect(next.fired).toEqual([
        { eventId: "border_incident", month: "1880-07", answerId: "protest", resolvedBy },
      ]);
      expect("pending" in next).toBe(false);
      expect(pending.fired).toEqual([]);
    },
  );
});
