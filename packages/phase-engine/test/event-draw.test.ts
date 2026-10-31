import type { CampaignSnapshot, DiplomaticRelation, NationState } from "@bluewave/campaign";
import type { EventResolutionRules, GameEvent } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type EventEngineContent } from "../src/index.js";

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
  provenance,
};

const effects = { budgetBp: 0, unrest: 0 };

function event(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "border_incident",
    titleKey: "event.border_incident.title",
    bodyKey: "event.border_incident.body",
    gates: {},
    weightBp: 10_000,
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
    baseResources: SafeInt(0),
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

function snapshot(
  nations: readonly NationState[],
  relations: DiplomaticRelation[] = [],
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "event-draw",
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

function month(
  from: CampaignSnapshot,
  events: EventEngineContent | undefined,
  seed = "seed",
  playerNationId: string | null = "GBR",
) {
  const result = new MonthExecutor().execute(from, [], seed, new DiagnosticCollector(), undefined, {
    ...(events === undefined ? {} : { events }),
    ...(playerNationId === null ? {} : { playerNationId }),
  });
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt(Number(from.turnNumber) + 1),
  } as CampaignSnapshot;
  const decisions = result.randomLedger.all.filter((d) => d.streamId === "events");
  return { next, decisions, ledgerHash: result.randomLedger.hash() };
}

const historyOf = (s: CampaignSnapshot, id: string) => s.nations.get(id)!.eventHistory!;
const content = (...catalogue: GameEvent[]): EventEngineContent => ({ rules: RULES, catalogue });

describe("monthly event draw", () => {
  it("does nothing without event content", () => {
    const { next, decisions } = month(snapshot([nation("FRA"), nation("GBR")]), undefined);
    expect(decisions).toEqual([]);
    expect(historyOf(next, "FRA")).toEqual({ fired: [], flags: [] });
  });

  it("does nothing when the catalogue is empty", () => {
    const { decisions } = month(snapshot([nation("FRA"), nation("GBR")]), content());
    expect(decisions).toEqual([]);
  });

  it("gives the player a pending dilemma and resolves an AI nation with a recorded answer", () => {
    const { next, decisions } = month(snapshot([nation("FRA"), nation("GBR")]), content(event()));
    expect(historyOf(next, "GBR")).toEqual({
      fired: [],
      flags: [],
      pending: { eventId: "border_incident", drawnMonth: "1880-02" },
    });
    expect(historyOf(next, "FRA")).toEqual({
      fired: [
        { eventId: "border_incident", month: "1880-02", answerId: "mobilise", resolvedBy: "AI" },
      ],
      flags: [],
    });
    expect(decisions.map((d) => [d.entityKey, d.outcome, d.reasonCode])).toEqual([
      ["FRA/1880-02", "border_incident", "EVENT_DRAWN"],
      ["FRA/1880-02/answer", "mobilise", "AI_STANCE_WEIGHTED"],
      ["GBR/1880-02", "border_incident", "EVENT_DRAWN"],
    ]);
  });

  it("records stream, entity, phase, version, input hash, outcome and reason on every draw", () => {
    const { decisions } = month(snapshot([nation("FRA"), nation("GBR")]), content(event()));
    expect(decisions.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(decision).toMatchObject({
        streamId: "events",
        phase: "resolve_diplomacy",
        rulesetVersion: "0.1.0",
      });
      expect(decision.entityKey).toMatch(/^[A-Z]+\/1880-02(\/answer)?$/);
      expect(decision.inputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isInteger(decision.draw)).toBe(true);
      expect(decision.outcome).not.toBe("");
      expect(decision.reasonCode).not.toBe("");
    }
  });

  it("resolves every nation as AI when no player nation is set", () => {
    const { next } = month(
      snapshot([nation("FRA"), nation("GBR")]),
      content(event()),
      "seed",
      null,
    );
    expect(historyOf(next, "GBR").pending).toBeUndefined();
    expect(historyOf(next, "GBR").fired).toHaveLength(1);
  });

  it("weights the AI answer by government type", () => {
    const { next } = month(
      snapshot([nation("FRA"), nation("ITA", { governmentType: "liberal_democracy" })]),
      content(event()),
      "seed",
      null,
    );
    expect(historyOf(next, "FRA").fired[0]!.answerId).toBe("mobilise");
    expect(historyOf(next, "ITA").fired[0]!.answerId).toBe("protest");
  });

  it("blocks events whose gates fail and draws nothing for that nation", () => {
    const gated = event({ gates: { governmentTypes: ["fascist"] } });
    const { next, decisions } = month(snapshot([nation("FRA"), nation("GBR")]), content(gated));
    expect(decisions).toEqual([]);
    expect(historyOf(next, "GBR")).toEqual({ fired: [], flags: [] });
  });

  it("honours a tension gate against the highest-tension rival", () => {
    const gated = event({
      gates: { tension: { counterpart: "highest_tension_rival", min: 7, max: 10 } },
    });
    const relation = (tension: number): DiplomaticRelation => ({
      nationA: "FRA",
      nationB: "GBR",
      relation: "neutral",
      tension,
      nap: false,
      since: "1880-01",
    });
    const low = month(snapshot([nation("FRA"), nation("GBR")], [relation(5)]), content(gated));
    const high = month(snapshot([nation("FRA"), nation("GBR")], [relation(8)]), content(gated));
    expect(low.decisions).toEqual([]);
    expect(high.decisions.length).toBeGreaterThan(0);
  });

  it("skips a nation with no government type", () => {
    const bare: NationState = { ...nation("FRA") };
    delete (bare as { governmentType?: unknown }).governmentType;
    const { decisions } = month(snapshot([bare, nation("GBR")]), content(event()), "seed", null);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.filter((d) => d.entityKey.startsWith("FRA/"))).toEqual([]);
  });

  it("draws no second dilemma while one is pending", () => {
    const other = event({ id: "naval_scare" });
    const first = month(snapshot([nation("GBR")]), content(event(), other));
    expect(historyOf(first.next, "GBR").pending).toBeDefined();
    const second = month(first.next, content(event(), other));
    expect(second.decisions).toEqual([]);
    expect(historyOf(second.next, "GBR")).toEqual(historyOf(first.next, "GBR"));
  });

  it("applies the default answer after 3 elapsed months and not after 2", () => {
    const only = content(event());
    let current = month(snapshot([nation("GBR")]), only).next;
    expect(historyOf(current, "GBR").pending?.drawnMonth).toBe("1880-02");

    current = month(current, only).next;
    expect(historyOf(current, "GBR").pending).toBeDefined();
    current = month(current, only).next;
    expect(historyOf(current, "GBR").pending).toBeDefined();
    expect(historyOf(current, "GBR").fired).toEqual([]);

    current = month(current, only).next;
    expect(historyOf(current, "GBR")).toEqual({
      fired: [
        {
          eventId: "border_incident",
          month: "1880-05",
          answerId: "protest",
          resolvedBy: "DEFAULT",
        },
      ],
      flags: [],
    });
  });

  it("honours a cooldown for an AI nation and releases the event when it elapses", () => {
    const cooled = content(event({ cooldownMonths: 3 }));
    const fired: string[] = [];
    let current = snapshot([nation("FRA"), nation("GBR")]);
    for (let i = 0; i < 7; i += 1) {
      const step = month(current, cooled, "seed", null);
      if (step.decisions.some((d) => d.outcome === "border_incident")) {
        fired.push(`1880-0${i + 2}`);
      }
      current = step.next;
    }
    expect(fired).toEqual(["1880-02", "1880-05", "1880-08"]);
    expect(historyOf(current, "FRA").fired.map((r) => r.month)).toEqual(fired);
  });

  it("fires a once event a single time", () => {
    const once = content(event({ once: true, cooldownMonths: 0 }));
    let current = snapshot([nation("FRA"), nation("GBR")]);
    for (let i = 0; i < 4; i += 1) current = month(current, once, "seed", null).next;
    expect(historyOf(current, "FRA").fired).toHaveLength(1);
  });

  it("is deterministic: the same seed gives the same events and ledger", () => {
    const run = () => month(snapshot([nation("FRA"), nation("GBR")]), content(event()), "s1");
    const first = run();
    const second = run();
    expect(second.ledgerHash).toBe(first.ledgerHash);
    expect(second.next.nations.get("FRA")).toEqual(first.next.nations.get("FRA"));
  });

  it("does not depend on catalogue order", () => {
    const a = event({ id: "a_event", weightBp: 5_000 });
    const b = event({ id: "b_event", weightBp: 5_000 });
    const forward = month(snapshot([nation("FRA"), nation("GBR")]), content(a, b), "s2", null);
    const reversed = month(snapshot([nation("FRA"), nation("GBR")]), content(b, a), "s2", null);
    expect(reversed.ledgerHash).toBe(forward.ledgerHash);
  });
});
