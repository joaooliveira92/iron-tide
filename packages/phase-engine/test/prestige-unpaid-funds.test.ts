import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

// S-2 04 (#89): the unpaid-funds prestige source. The rule values come from the test-support fixture value set
// (fixture class, not a prestige value): UNPAID_FUNDS is a 300 bp proportional loss.

function makeNation(
  id: string,
  overrides: Partial<{
    treasury: SafeInt;
    income: SafeInt;
    expenses: SafeInt;
    baseResources: SafeInt;
    projects: ConstructionProject[];
    ships: number;
    prestige: SafeInt;
  }>,
): NationState {
  const ships = overrides.ships ?? 0;
  return {
    prestige: overrides.prestige ?? SafeInt(50),
    id,
    name: id,
    tag: id,
    treasury: overrides.treasury ?? SafeInt(1000),
    income: overrides.income ?? SafeInt(100),
    expenses: overrides.expenses ?? SafeInt(50),
    baseResources: overrides.baseResources ?? SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: `${id} Fleet`,
        locationAreaId: "a-1",
        ships: Array.from({ length: ships }, (_, i) => ({
          id: `${id}-ship-${i}`,
          name: `${id} Ship ${i}`,
          classId: "battleship",
          nationId: id,
          locationAreaId: "a-1",
          designVersionId: "",
          hitPoints: SafeInt(100),
          maxHitPoints: SafeInt(100),
          speed: SafeInt(10),
          firepower: SafeInt(10),
          armor: SafeInt(10),
          isUnderConstruction: false,
          constructionProgress: SafeInt(100),
          constructionTotalWork: SafeInt(100),
          readiness: "ACTIVE",
          crewQuality: SafeInt(100),
        })),
      },
    ],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: overrides.projects ?? [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function makeSnapshot(nations: Array<[string, NationState]>): CampaignSnapshot {
  const map = new Map(nations);
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "economy-acceptance",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map(([nationId]) => ({
      nationId,
      type: nationId === "GBR" ? ("playable" as const) : ("ai" as const),
    })),
    world: { areas: [], routes: [], ports: [] },
    nations: map,
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

/** Treasury 10 against expenses 50 and no income: the obligation phase pays 10 and is 40 short. */
const SHORT = { treasury: SafeInt(10), expenses: SafeInt(50), baseResources: SafeInt(0) } as const;
const FLUSH = {
  treasury: SafeInt(1000),
  expenses: SafeInt(50),
  baseResources: SafeInt(0),
} as const;

function run(snapshot: CampaignSnapshot, playerNationId?: string) {
  return new MonthExecutor().execute(
    snapshot,
    [],
    "s2-04-seed",
    new DiagnosticCollector(),
    undefined,
    playerNationId === undefined ? undefined : { playerNationId },
  );
}

const prestigeEvents = (result: ReturnType<typeof run>) =>
  result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged");

describe("S-2 04: unpaid-funds prestige loss in the obligation phase", () => {
  it("lowers the player's prestige by the proportional loss in the shortfall month and emits the event", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", SHORT)]]);
    const result = run(snapshot, "GBR");

    expect(result.success).toBe(true);
    // 300 bp of 50 is 1.5, rounded up against the player to 2.
    expect(result.finalSnapshot.nations.get("GBR")!.prestige).toBe(48);
    const events = prestigeEvents(result);
    expect(events).toHaveLength(1);
    expect(events[0]!.body).toEqual({
      kind: "PrestigeChanged",
      nationId: "GBR",
      reasonCode: "UNPAID_FUNDS",
      ruleKind: "PROPORTIONAL_LOSS",
      before: 50,
      after: 48,
      delta: -2,
      rulesetVersion: "0.1.0",
    });
  });

  it("changes nothing and emits no event in a month with no shortfall", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", FLUSH)]]);
    const result = run(snapshot, "GBR");
    expect(result.finalSnapshot.nations.get("GBR")!.prestige).toBe(50);
    expect(prestigeEvents(result)).toHaveLength(0);
  });

  it("emits no event for a zero-delta evaluation (prestige already at the lower bound)", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", { ...SHORT, prestige: SafeInt(0) })]]);
    const result = run(snapshot, "GBR");
    expect(result.finalSnapshot.nations.get("GBR")!.prestige).toBe(0);
    expect(prestigeEvents(result)).toHaveLength(0);
  });

  it("leaves an AI nation's prestige unchanged when only that nation is in shortfall", () => {
    const snapshot = makeSnapshot([
      ["GBR", makeNation("GBR", FLUSH)],
      ["FRA", makeNation("FRA", SHORT)],
    ]);
    const result = run(snapshot, "GBR");
    expect(result.finalSnapshot.nations.get("FRA")!.prestige).toBe(50);
    expect(result.finalSnapshot.nations.get("GBR")!.prestige).toBe(50);
    expect(prestigeEvents(result)).toHaveLength(0);
  });

  it("is dormant when no player nation is supplied", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", SHORT)]]);
    const result = run(snapshot);
    expect(result.finalSnapshot.nations.get("GBR")!.prestige).toBe(50);
    expect(prestigeEvents(result)).toHaveLength(0);
  });

  it("keeps treasury, obligation and maintenance outputs identical to a run without the source", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", { ...SHORT, ships: 1 })]]);
    const control = run(snapshot);
    const withSource = run(snapshot, "GBR");
    const strip = (r: ReturnType<typeof run>) =>
      [...r.finalSnapshot.nations].map(([id, n]) => [id, n.treasury, n.maintenanceCost]);
    expect(strip(withSource)).toEqual(strip(control));
    expect(sha256Hex(canonicalSerialize(withSource.financialLedger.all))).toBe(
      sha256Hex(canonicalSerialize(control.financialLedger.all)),
    );
    const nonPrestige = (r: ReturnType<typeof run>) =>
      r.eventLedger.all.filter((e) => e.body.kind !== "PrestigeChanged");
    expect(sha256Hex(canonicalSerialize(nonPrestige(withSource)))).toBe(
      sha256Hex(canonicalSerialize(nonPrestige(control))),
    );
    expect(withSource.finalSnapshot.nations.get("GBR")!.prestige).toBe(48);
  });

  it("is deterministic: the same scripted month twice is byte-identical", () => {
    const snapshot = makeSnapshot([["GBR", makeNation("GBR", SHORT)]]);
    const a = run(snapshot, "GBR");
    const b = run(snapshot, "GBR");
    expect(sha256Hex(canonicalSerialize(a.eventLedger.all))).toBe(
      sha256Hex(canonicalSerialize(b.eventLedger.all)),
    );
    expect(a.finalSnapshot.nations.get("GBR")!.prestige).toBe(
      b.finalSnapshot.nations.get("GBR")!.prestige,
    );
  });
});
