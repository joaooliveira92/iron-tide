import type { CampaignSnapshot, DiplomaticRelation, NationState } from "@bluewave/campaign";
import {
  budgetModifierTotalBp,
  economyOutlook,
  effectiveAppropriationRateBp,
} from "@bluewave/campaign";
import type {
  EventAnswer,
  EventResolutionRules,
  GameEvent,
  NationTrait,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { applyAnswerEffects, MonthExecutor, type EventEngineContent } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
};

const RULES: EventResolutionRules = {
  sectionVersion: 1,
  defaultAnswerAfterMonths: 3,
  aiStanceWeightsBp: {
    liberal_democracy: { hawkBp: 0, doveBp: 10_000, neutralBp: 0 },
    limited_democracy: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
    autocratic: { hawkBp: 10_000, doveBp: 0, neutralBp: 0 },
    fascist: { hawkBp: 10_000, doveBp: 0, neutralBp: 0 },
    communist: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
    eastern: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
  },
  traitShifts: [],
  answerEffects: {
    budgetDecayMonths: 12,
    budgetStackCapBp: 600,
    tensionJumpCap: 3,
    traitEffects: [
      {
        trait: "cautious",
        stance: "hawk",
        reasonCode: "CAUTIOUS_ADVENTURE",
        prestige: -2,
      },
    ],
  },
  provenance,
};

const hawk: EventAnswer = {
  id: "mobilise",
  stance: "hawk",
  labelKey: "a.hawk",
  effects: {
    budgetBp: 300,
    unrest: 2,
    prestige: { kind: "FIXED_GAIN", amount: 2, reasonCode: "BORDER_STAND" },
    tension: { counterpart: "highest_tension_rival", delta: 2 },
  },
};

const dove: EventAnswer = {
  id: "protest",
  stance: "dove",
  labelKey: "a.dove",
  effects: {
    budgetBp: -200,
    unrest: -1,
    prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "BORDER_YIELD" },
    tension: { counterpart: "highest_tension_rival", delta: -2 },
  },
};

function event(answers: EventAnswer[] = [hawk, dove]): GameEvent {
  return {
    id: "border_incident",
    titleKey: "event.border_incident.title",
    bodyKey: "event.border_incident.body",
    gates: {},
    weightBp: 10_000,
    cooldownMonths: 24,
    once: false,
    defaultAnswerId: "protest",
    answers,
    provenance,
  };
}

function nation(id: string, extra: Partial<NationState> = {}): NationState {
  return {
    id,
    name: id,
    tag: id,
    governmentType: "autocratic",
    traits: [],
    eventHistory: { fired: [], flags: [] },
    prestige: SafeInt(20),
    treasury: SafeInt(10_000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(120_000),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
    ...extra,
  };
}

function bystander(id: string): NationState {
  const bare: NationState = nation(id);
  delete (bare as { governmentType?: unknown }).governmentType;
  return bare;
}

function relation(tension: number, kind: DiplomaticRelation["relation"] = "neutral") {
  return {
    nationA: "DEU",
    nationB: "FRA",
    relation: kind,
    tension,
    nap: false,
    since: "1880-01",
  } satisfies DiplomaticRelation;
}

function snapshot(
  nations: readonly NationState[],
  relations: DiplomaticRelation[] = [],
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "answer-effects",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(nations.map((n) => [n.id, n])),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations, shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "5.0.0",
  };
}

function month(from: CampaignSnapshot, events: EventEngineContent) {
  const result = new MonthExecutor().execute(
    from,
    [],
    "seed",
    new DiagnosticCollector(),
    undefined,
    {
      events,
      playerNationId: "GBR",
    },
  );
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt(Number(from.turnNumber) + 1),
  } as CampaignSnapshot;
  return { next, result };
}

const content = (...answers: EventAnswer[]): EventEngineContent => ({
  rules: RULES,
  catalogue: [event(answers.length > 0 ? answers : [hawk, dove])],
});

const world = (extra: Partial<NationState> = {}, tension = 4) =>
  snapshot([bystander("DEU"), nation("FRA", extra), nation("GBR")], [relation(tension)]);

describe("answer effects on an AI answer", () => {
  it("records the budget modifier, prestige with its reason code, unrest and a capped tension jump", () => {
    const { next, result } = month(world(), content());
    const fra = next.nations.get("FRA")!;
    expect(fra.eventHistory!.fired[0]).toMatchObject({ answerId: "mobilise", resolvedBy: "AI" });
    expect(fra.budgetModifiers).toEqual([
      {
        eventId: "border_incident",
        answerId: "mobilise",
        firstMonth: "1880-03",
        initialBp: 300,
        decayMonths: 12,
        capBp: 600,
      },
    ]);
    expect(fra.unrest).toBe(2);
    expect(fra.prestige).toBe(22);
    expect(fra.prestigeLastChange).toMatchObject({ reasonCode: "BORDER_STAND", delta: 2 });
    expect(next.politics.relations[0]).toMatchObject({ tension: 6, relation: "neutral" });
    const prestige = result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged");
    expect(prestige.map((e) => (e.body as { reasonCode: string }).reasonCode)).toEqual([
      "BORDER_STAND",
    ]);
    expect(fra.eventHistory!.fired[0]!.effects).toMatchObject({
      budgetBp: 300,
      prestigeDelta: 2,
      unrestBefore: 0,
      unrestAfter: 2,
      tensionPartner: "DEU",
      tensionBefore: 4,
      tensionAfter: 6,
    });
  });

  it("never edits the stored base appropriation rate", () => {
    const { next } = month(world(), content());
    expect(next.nations.get("FRA")!.navalAppropriationRateBp).toBe(2_000);
  });

  it("pays the modifier through next month's revenue and decays it linearly", () => {
    const first = month(world(), content());
    const fra1 = first.next.nations.get("FRA")!;
    const second = month(first.next, content());
    const fra2 = second.next.nations.get("FRA")!;
    expect((fra2.treasury as number) - (fra1.treasury as number)).toBe(2_300);
    expect(effectiveAppropriationRateBp(fra1, "1880-03")).toBe(2_300);
    expect(effectiveAppropriationRateBp(fra1, "1880-04")).toBe(2_275);
    expect(effectiveAppropriationRateBp(fra1, "1881-03")).toBe(2_000);
    expect(budgetModifierTotalBp(fra1.budgetModifiers!, "1881-02")).toBe(25);
  });

  it("projects the same revenue in the economy outlook as the revenue phase pays", () => {
    const first = month(world(), content());
    const outlook = economyOutlook(first.next, "FRA")!;
    const paid = month(first.next, content());
    expect(outlook.revenue).toBe(2_300);
    expect(
      (paid.next.nations.get("FRA")!.treasury as number) -
        (first.next.nations.get("FRA")!.treasury as number),
    ).toBe(outlook.revenue);
  });

  it("lets a trait add a separate line after the declared effects", () => {
    const { next } = month(world({ traits: ["cautious"] as NationTrait[] }), content());
    const fra = next.nations.get("FRA")!;
    const lines = fra.eventHistory!.fired[0]!.effects!.lines;
    expect(
      lines.map((line) => [line.source, line.trait, line.reasonCode, line.prestigeDelta]),
    ).toEqual([
      ["DECLARED", undefined, undefined, 2],
      ["TRAIT", "cautious", "CAUTIOUS_ADVENTURE", -2],
    ]);
    expect(fra.prestige).toBe(20);
    expect(fra.prestigeLastChange).toMatchObject({ reasonCode: "CAUTIOUS_ADVENTURE", delta: -2 });
  });

  it("raises tension to the war threshold without declaring war", () => {
    const big: EventAnswer = {
      ...hawk,
      effects: { ...hawk.effects, tension: { counterpart: "highest_tension_rival", delta: 3 } },
    };
    const { next } = month(world({}, 9), content(big, dove));
    expect(next.politics.relations[0]).toMatchObject({ tension: 10, relation: "neutral" });
    expect(next.wars.wars).toEqual([]);
  });

  it("does nothing to tension when no counterpart exists", () => {
    const { next } = month(snapshot([nation("FRA"), nation("GBR")]), content());
    expect(next.politics.relations).toEqual([]);
    expect(
      next.nations.get("FRA")!.eventHistory!.fired[0]!.effects!.tensionPartner,
    ).toBeUndefined();
  });

  it("records unrest without consuming it", () => {
    const calm = month(world({ unrest: 0 }), content());
    const wild = month(world({ unrest: 10 }), content());
    expect(calm.next.nations.get("FRA")!.unrest).toBe(2);
    expect(wild.next.nations.get("FRA")!.unrest).toBe(10);
    const strip = (s: CampaignSnapshot) => {
      const { unrest: _unrest, eventHistory: _history, ...rest } = s.nations.get("FRA")!;
      return { rest, relations: s.politics.relations };
    };
    expect(strip(wild.next)).toEqual(strip(calm.next));
    expect(wild.result.randomLedger.hash()).toBe(calm.result.randomLedger.hash());
  });

  it("is identical across two runs", () => {
    const a = month(world(), content());
    const b = month(world(), content());
    expect(b.result.randomLedger.hash()).toBe(a.result.randomLedger.hash());
    expect(b.next.nations.get("FRA")).toEqual(a.next.nations.get("FRA"));
  });
});

describe("answer effects on a default answer", () => {
  it("applies the dove answer with its signed deltas when the dilemma lapses", () => {
    const pending = { eventId: "border_incident", drawnMonth: "1879-11" };
    const start = snapshot(
      [
        bystander("DEU"),
        bystander("FRA"),
        nation("GBR", {
          unrest: 5,
          eventHistory: { fired: [], flags: [], pending },
        }),
      ],
      [{ ...relation(5), nationA: "DEU", nationB: "GBR" }],
    );
    const { next } = month(start, content());
    const gbr = next.nations.get("GBR")!;
    expect(gbr.eventHistory!.fired[0]).toMatchObject({
      answerId: "protest",
      resolvedBy: "DEFAULT",
    });
    expect(gbr.unrest).toBe(4);
    expect(gbr.prestige).toBe(19);
    expect(gbr.prestigeLastChange).toMatchObject({ reasonCode: "BORDER_YIELD", delta: -1 });
    expect(gbr.budgetModifiers![0]!.initialBp).toBe(-200);
    expect(next.politics.relations.find((r) => r.nationB === "GBR")!.tension).toBe(3);
  });
});

describe("answer effect sign convention at runtime", () => {
  const input = (answerId: string) => ({
    nation: nation("FRA"),
    relations: [relation(5)],
    event: event(),
    answerId,
    rules: RULES.answerEffects,
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    month: "1880-02",
    rulesetVersion: "0.1.0",
    nextSeq: () => SafeInt(1),
  });

  it("a hawk answer raises budget, prestige, tension and unrest", () => {
    const out = applyAnswerEffects(input("mobilise"))!;
    expect(out.effects.budgetBp).toBeGreaterThan(0);
    expect(out.effects.prestigeDelta).toBeGreaterThan(0);
    expect(out.effects.unrestAfter).toBeGreaterThan(out.effects.unrestBefore);
    expect(out.effects.tensionAfter!).toBeGreaterThan(out.effects.tensionBefore!);
  });

  it("a dove answer lowers tension and unrest and gives up prestige and budget", () => {
    const out = applyAnswerEffects({
      ...input("protest"),
      nation: nation("FRA", { unrest: 5 }),
    })!;
    expect(out.effects.budgetBp).toBeLessThan(0);
    expect(out.effects.prestigeDelta).toBeLessThan(0);
    expect(out.effects.unrestAfter).toBeLessThan(out.effects.unrestBefore);
    expect(out.effects.tensionAfter!).toBeLessThan(out.effects.tensionBefore!);
  });

  it("returns nothing for an unknown answer", () => {
    expect(applyAnswerEffects(input("missing"))).toBeUndefined();
  });
});
