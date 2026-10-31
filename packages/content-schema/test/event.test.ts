import { describe, expect, it } from "vite-plus/test";
import { EVENT_STANCES, EventSchema, type GameEvent } from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const effects = {
  budgetBp: 0,
  unrest: 0,
};

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
  note: "PROVISIONAL authoring fixture",
};

function validEvent(): GameEvent {
  return {
    id: "naval_scare",
    titleKey: "event.naval_scare.title",
    bodyKey: "event.naval_scare.body",
    gates: {
      governmentTypes: ["liberal_democracy"],
      eraWindow: { fromMonth: "1880-01", toMonth: "1899-12" },
      tension: { counterpart: "highest_tension_rival", min: 4, max: 10 },
      requiredTraits: [],
      excludedTraits: ["cautious"],
    },
    weightBp: 150,
    cooldownMonths: 24,
    once: false,
    defaultAnswerId: "hold",
    answers: [
      {
        id: "arm",
        stance: "hawk",
        labelKey: "event.naval_scare.arm",
        effects: {
          budgetBp: 200,
          prestige: { kind: "FIXED_GAIN", amount: 2, reasonCode: "EVENT_NAVAL_SCARE_ARM" },
          unrest: 1,
          tension: { counterpart: "highest_tension_rival", delta: 1 },
          setFlag: "naval_scare_armed",
        },
      },
      {
        id: "hold",
        stance: "dove",
        labelKey: "event.naval_scare.hold",
        effects: {
          budgetBp: -100,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "EVENT_NAVAL_SCARE_HOLD" },
          unrest: -1,
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
    ],
    provenance,
  };
}

function withAnswers(answers: GameEvent["answers"]): GameEvent {
  return { ...validEvent(), answers };
}

describe("EventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(decodeOk(EventSchema, validEvent())).toBe(true);
  });

  it("names the three answer stances", () => {
    expect([...EVENT_STANCES]).toEqual(["hawk", "dove", "neutral"]);
  });

  it("rejects an excess key at the event and the answer level", () => {
    expect(decodeOk(EventSchema, { ...validEvent(), extra: 1 })).toBe(false);
    const [hawk, dove] = validEvent().answers;
    expect(decodeOk(EventSchema, withAnswers([{ ...hawk!, extra: 1 }, dove!] as never))).toBe(
      false,
    );
  });

  it("rejects an event without a hawkish answer", () => {
    const [, dove] = validEvent().answers;
    const neutral = { id: "wait", stance: "neutral", labelKey: "k", effects } as const;
    expect(decodeIssue(EventSchema, withAnswers([dove!, neutral]))).toContain("hawk");
  });

  it("rejects an event without a dovish answer", () => {
    const [hawk] = validEvent().answers;
    const neutral = { id: "wait", stance: "neutral", labelKey: "k", effects } as const;
    expect(decodeIssue(EventSchema, withAnswers([hawk!, neutral]))).toContain("dove");
  });

  it("accepts an optional neutral answer", () => {
    const neutral = { id: "wait", stance: "neutral", labelKey: "k", effects } as const;
    expect(decodeOk(EventSchema, withAnswers([...validEvent().answers, neutral]))).toBe(true);
  });

  it("rejects duplicate answer ids", () => {
    const [hawk, dove] = validEvent().answers;
    expect(decodeOk(EventSchema, withAnswers([hawk!, { ...dove!, id: hawk!.id }]))).toBe(false);
  });

  it("rejects a default answer that is not one of the answers", () => {
    expect(decodeIssue(EventSchema, { ...validEvent(), defaultAnswerId: "missing" })).toContain(
      "defaultAnswerId",
    );
  });

  it.each([
    ["budget down", { budgetBp: -1 }],
    ["unrest down", { unrest: -1 }],
    ["tension down", { tension: { counterpart: "war_enemy", delta: -1 } }],
    ["a prestige loss", { prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "X" } }],
  ])("rejects a hawkish answer with %s", (_label, override) => {
    const [hawk, dove] = validEvent().answers;
    const answer = { ...hawk!, effects: { ...effects, ...override } };
    expect(decodeOk(EventSchema, withAnswers([answer as never, dove!]))).toBe(false);
  });

  it.each([
    ["budget up", { budgetBp: 1 }],
    ["unrest up", { unrest: 1 }],
    ["tension up", { tension: { counterpart: "war_enemy", delta: 1 } }],
    ["a prestige gain", { prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "X" } }],
  ])("rejects a dovish answer with %s", (_label, override) => {
    const [hawk, dove] = validEvent().answers;
    const answer = { ...dove!, effects: { ...effects, ...override } };
    expect(decodeOk(EventSchema, withAnswers([hawk!, answer as never]))).toBe(false);
  });

  it("does not constrain the sign of a neutral answer", () => {
    const neutral = {
      id: "wait",
      stance: "neutral",
      labelKey: "k",
      effects: { budgetBp: 50, unrest: -1 },
    } as const;
    expect(decodeOk(EventSchema, withAnswers([...validEvent().answers, neutral]))).toBe(true);
  });

  it.each([
    ["a non-integer budget", { budgetBp: 1.5 }],
    ["an out-of-range unrest delta", { unrest: 11 }],
    ["an out-of-range tension delta", { tension: { counterpart: "war_enemy", delta: 11 } }],
  ])("rejects %s", (_label, override) => {
    const [hawk, dove] = validEvent().answers;
    const answer = { ...hawk!, effects: { ...hawk!.effects, ...override } };
    expect(decodeOk(EventSchema, withAnswers([answer as never, dove!]))).toBe(false);
  });

  it("rejects a hard-coded nation as the tension counterpart", () => {
    const [hawk, dove] = validEvent().answers;
    const answer = {
      ...hawk!,
      effects: { ...hawk!.effects, tension: { counterpart: "germany", delta: 1 } },
    };
    expect(decodeOk(EventSchema, withAnswers([answer as never, dove!]))).toBe(false);
  });

  it("rejects an unknown trait or government type in the gates", () => {
    const gates = validEvent().gates;
    expect(
      decodeOk(EventSchema, { ...validEvent(), gates: { ...gates, excludedTraits: ["x"] } }),
    ).toBe(false);
    expect(
      decodeOk(EventSchema, {
        ...validEvent(),
        gates: { ...gates, governmentTypes: ["monarchy"] },
      }),
    ).toBe(false);
  });

  it("rejects an era window that ends before it starts", () => {
    const gates = {
      ...validEvent().gates,
      eraWindow: { fromMonth: "1890-01", toMonth: "1880-01" },
    };
    expect(decodeOk(EventSchema, { ...validEvent(), gates })).toBe(false);
  });

  it("rejects a tension range whose minimum exceeds its maximum", () => {
    const gates = {
      ...validEvent().gates,
      tension: { counterpart: "war_enemy", min: 8, max: 2 },
    };
    expect(decodeOk(EventSchema, { ...validEvent(), gates })).toBe(false);
  });

  it("rejects a zero or oversized weight and a negative cooldown", () => {
    expect(decodeOk(EventSchema, { ...validEvent(), weightBp: 0 })).toBe(false);
    expect(decodeOk(EventSchema, { ...validEvent(), weightBp: 10_001 })).toBe(false);
    expect(decodeOk(EventSchema, { ...validEvent(), cooldownMonths: -1 })).toBe(false);
  });
});
