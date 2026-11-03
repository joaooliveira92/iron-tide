import type { CampaignSnapshot, DiplomaticRelation, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

const RULES = {
  sectionVersion: 1 as const,
  maxRiseProbabilityBp: 10_000,
  navalRatio: { thresholdBp: 20_000, pressureBp: 10_000, tensionCeiling: 6 },
  damping: { alliedBp: 0, tradeAgreementBp: 0 },
  cooling: { alliedBp: 10_000, tradeAgreementBp: 10_000 },
  provenance: {
    sourceStatus: "BALANCE_TARGET" as const,
    confidence: "LOW" as const,
    kind: "balance_adjustment" as const,
    sources: [],
  },
};

function nation(id: string, income: number): NationState {
  return {
    id,
    name: id,
    tag: id,
    prestige: SafeInt(20),
    treasury: SafeInt(10_000),
    income: SafeInt(income),
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
  };
}

function relation(over: Partial<DiplomaticRelation>): DiplomaticRelation {
  return {
    nationA: "FRA",
    nationB: "GBR",
    relation: "neutral",
    tension: 5,
    nap: false,
    since: "1880-01",
    ...over,
  };
}

function snapshot(
  relations: DiplomaticRelation[],
  incomes: [number, number] = [100, 100],
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "tension-drift",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      ["FRA", nation("FRA", incomes[0])],
      ["GBR", nation("GBR", incomes[1])],
    ]),
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

function month(from: CampaignSnapshot, options: { tensionDrift?: typeof RULES } = {}) {
  const result = new MonthExecutor().execute(
    from,
    [],
    "seed",
    new DiagnosticCollector(),
    undefined,
    options,
  );
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt(Number(from.turnNumber) + 1),
  } as CampaignSnapshot;
  const driftDecisions = result.randomLedger.all.filter(
    (d) => d.streamId === "diplomacy/tension_drift",
  );
  return { next, driftDecisions };
}

const tensionOf = (s: CampaignSnapshot) => s.politics.relations[0]!.tension;

describe("monthly tension drift", () => {
  it("does nothing when the ruleset carries no tensionDrift section", () => {
    const { next, driftDecisions } = month(snapshot([relation({ frictionBp: 10_000 })]));
    expect(tensionOf(next)).toBe(5);
    expect(driftDecisions).toEqual([]);
  });

  it("raises tension one step on certain friction and records a reason-coded draw", () => {
    const { next, driftDecisions } = month(snapshot([relation({ frictionBp: 10_000 })]), {
      tensionDrift: RULES,
    });
    expect(tensionOf(next)).toBe(6);
    expect(driftDecisions).toHaveLength(1);
    expect(driftDecisions[0]).toMatchObject({
      streamId: "diplomacy/tension_drift",
      entityKey: "FRA|GBR",
      outcome: "RISE",
      reasonCode: "PAIR_FRICTION",
    });
    expect(driftDecisions[0]!.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stops rising at 10", () => {
    let current = snapshot([relation({ frictionBp: 10_000, tension: 9 })]);
    for (let i = 0; i < 3; i++) current = month(current, { tensionDrift: RULES }).next;
    expect(tensionOf(current)).toBe(10);
  });

  it("raises tension from a lopsided naval budget with no authored friction", () => {
    const { next, driftDecisions } = month(snapshot([relation({})], [900, 100]), {
      tensionDrift: RULES,
    });
    expect(tensionOf(next)).toBe(6);
    expect(driftDecisions[0]).toMatchObject({ reasonCode: "NAVAL_RATIO" });
  });

  it("stops applying naval imbalance pressure once a pair is at the ceiling", () => {
    const { next, driftDecisions } = month(snapshot([relation({ tension: 6 })], [900, 100]), {
      tensionDrift: RULES,
    });
    expect(tensionOf(next)).toBe(6);
    expect(driftDecisions).toEqual([]);
  });

  it("never touches a pair at war", () => {
    const { next, driftDecisions } = month(
      snapshot([relation({ relation: "at_war", tension: 10, frictionBp: 10_000 })]),
      { tensionDrift: RULES },
    );
    expect(tensionOf(next)).toBe(10);
    expect(driftDecisions).toEqual([]);
  });

  it("cools an allied pair one step and stops at 0", () => {
    let current = snapshot([relation({ relation: "allied", tension: 1 })]);
    const first = month(current, { tensionDrift: RULES });
    expect(tensionOf(first.next)).toBe(0);
    expect(first.driftDecisions[0]).toMatchObject({
      outcome: "COOL",
      reasonCode: "ALLIANCE_COOLING",
    });
    current = first.next;
    const second = month(current, { tensionDrift: RULES });
    expect(tensionOf(second.next)).toBe(0);
  });

  it("leaves an idle pair undrawn", () => {
    const { driftDecisions } = month(snapshot([relation({})]), { tensionDrift: RULES });
    expect(driftDecisions).toEqual([]);
  });

  it("is deterministic across identical runs", () => {
    const run = () =>
      month(snapshot([relation({ frictionBp: 4_000 })]), { tensionDrift: RULES }).next.politics;
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
