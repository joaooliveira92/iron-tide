import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { TEST_RESEARCH_CATALOGUE } from "./research-catalogue.helper.js";

// Economy spec #138 / #140: the ledger identity, the shortfall accounting and the clamp, checked over many valid states
// through the production month executor. Randomised cases use a fixed, printed seed (a failure names its seed and state);
// the boundary states (zeros, exact-fit and one-short funds, the supported ceiling) are enumerated rather than sampled.
const SEED = 0x140_0a11;
const RANDOM_CASES = 600;
const SHIP_MAINTENANCE = 10; // one "battleship" costs 10 a month in this ruleset; read back from the ledger, never assumed

/** splitmix32: tiny, deterministic and platform-independent (no Math.random). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad) >>> 0;
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97) >>> 0;
    return (t ^ (t >>> 15)) >>> 0;
  };
}

interface State {
  readonly treasury: number;
  readonly base: number;
  readonly rateBp: number;
  readonly expenses: number;
  readonly ships: number;
  readonly research: number;
  readonly withCatalogue: boolean;
  readonly projectWork: number; // total work of one active project; 0 = none
}

const describeState = (s: State): string => JSON.stringify(s);

function build(state: State): CampaignSnapshot {
  const ships = Array.from({ length: state.ships }, (_, i) => ({
    id: `n-ship-${i}`,
    name: `Ship ${i}`,
    classId: "battleship",
    nationId: "n",
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
    readiness: "ACTIVE" as const,
    crewQuality: SafeInt(100),
  }));
  const nation: NationState = {
    id: "n",
    name: "n",
    tag: "N",
    treasury: SafeInt(state.treasury),
    income: SafeInt(0),
    expenses: SafeInt(state.expenses),
    baseResources: SafeInt(state.base),
    navalAppropriationRateBp: SafeInt(state.rateBp),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: "fleet-n", nationId: "n", name: "Fleet", locationAreaId: "a-1", ships }],
    divisions: [],
    research: {
      nationId: "n",
      technologies: [],
      fieldPriorities: {
        MACHINERY: SafeInt(1),
        HULL_CONSTRUCTION: SafeInt(1),
        GUNNERY: SafeInt(1),
      },
      researchBudget: SafeInt(state.research),
      standingResearchBudget: SafeInt(state.research),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects:
      state.projectWork === 0
        ? []
        : [
            {
              id: "proj-1",
              type: "ship",
              projectType: "NEW_CONSTRUCTION",
              targetId: "ship-x",
              designVersionId: "",
              totalWork: SafeInt(state.projectWork),
              completedWork: SafeInt(0),
              paidWork: SafeInt(0),
              status: "ACTIVE",
              startedAt: "1880-01",
            },
          ],
    isPlayable: true,
    isAI: false,
  };
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "economy-ledger-property",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "n", type: "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      ...(state.withCatalogue ? { technologies: TEST_RESEARCH_CATALOGUE } : {}),
    },
    nations: new Map([["n", nation]]),
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

function run(state: State) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(build(state), [], "econ-ledger-property", collector);
  return { result, collector };
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Check every ledger and shortfall invariant of one executed month; returns nothing, throws via expect with the state. */
function checkMonth(state: State): void {
  const label = describeState(state);
  const { result, collector } = run(state);
  const entries = result.financialLedger.all;
  const closing = result.finalSnapshot.nations.get("n")!.treasury as number;
  const byCategory = (id: string) => entries.filter((e) => e.categoryId === id);

  // Independent oracle for revenue: the legacy chained floors, not the calculator under test.
  const revenueExpected = Math.floor(Math.floor((state.base * state.rateBp) / 10_000) / 12);
  const revenue = sum(byCategory("NAVAL_APPROPRIATION").map((e) => e.credit as number));
  expect(revenue, label).toBe(revenueExpected);

  const paid = (id: string) => sum(byCategory(id).map((e) => e.debit as number));
  const construction = paid("APPROPRIATION");
  const preservation = paid("CONSTRUCTION_PRESERVATION");
  const maintenance = paid("MAINTENANCE_EXPENDITURE");
  const obligation = paid("OBLIGATION");
  const research = paid("RESEARCH_EXPENDITURE");

  // The identity, on paid amounts, in whole treasury units.
  expect(closing, label).toBe(
    state.treasury + revenue - construction - preservation - maintenance - obligation - research,
  );
  expect(Number.isSafeInteger(closing), label).toBe(true);
  expect(closing >= 0, label).toBe(true); // the treasury never goes negative

  // The running balance each entry records is consistent with its own paid amount and never negative.
  for (const e of entries) {
    expect((e.newBalance as number) >= 0, `${label} ${e.categoryId}`).toBe(true);
    expect((e.previousBalance as number) >= 0, `${label} ${e.categoryId}`).toBe(true);
  }

  // Obligations are requested exactly as authored; maintenance as ships x unit cost when the fleet is non-empty.
  const requestedOf = (id: string) => sum(byCategory(id).map((e) => (e.requested ?? 0) as number));
  expect(requestedOf("OBLIGATION"), label).toBe(state.expenses);
  if (state.ships > 0)
    expect(requestedOf("MAINTENANCE_EXPENDITURE"), label).toBe(state.ships * SHIP_MAINTENANCE);

  // Each outflow: paid + shortfall = requested, paid never exceeds the funds the month had, shortfall is never negative.
  const available = state.treasury + revenue;
  const outflowIds = ["MAINTENANCE_EXPENDITURE", "OBLIGATION", "RESEARCH_EXPENDITURE"] as const;
  for (const id of outflowIds)
    for (const e of byCategory(id)) {
      expect((e.debit as number) + (e.shortfall ?? 0), `${label} ${id}`).toBe(
        e.requested ?? e.debit,
      );
      expect((e.debit as number) <= available, `${label} ${id}`).toBe(true);
    }
  expect(
    construction + preservation + maintenance + obligation + research <= available,
    label,
  ).toBe(true);

  // Construction draws only from funds beyond the obligation reserve, and never beyond the project's work.
  expect(construction <= Math.max(0, available - state.expenses), label).toBe(true);
  expect(construction <= state.projectWork, label).toBe(true);

  // An unpaid amount is reported exactly once: one OUTFLOW_SHORTFALL warning per outflow entry with a shortfall.
  const shortEntries = entries.filter(
    (e) => e.categoryId !== "APPROPRIATION" && ((e.shortfall ?? 0) as number) > 0,
  );
  const warnings = collector.warnings.filter((d) => d.code === "OUTFLOW_SHORTFALL");
  expect(warnings.length, label).toBe(shortEntries.length);

  // Any real shortfall means the treasury ran dry: a shortfall implies a closing treasury of zero.
  if (shortEntries.length > 0) expect(closing, label).toBe(0);

  expect(collector.hasErrors, label).toBe(false);

  // Deterministic: a second run yields the same ledger and the same diagnostics, in the same order.
  const again = run(state);
  expect(again.result.financialLedger.all, label).toEqual(entries);
  expect(
    again.collector.all.map((d) => [d.code, d.severity, d.message]),
    label,
  ).toEqual(collector.all.map((d) => [d.code, d.severity, d.message]));
}

describe(`economy ledger invariants (seed 0x${SEED.toString(16)}, ${RANDOM_CASES} random cases)`, () => {
  it("holds for random valid states", () => {
    const next = rng(SEED);
    const between = (lo: number, hi: number) => lo + (next() % (hi - lo + 1));
    for (let i = 0; i < RANDOM_CASES; i += 1) {
      checkMonth({
        treasury: between(0, 3) === 0 ? between(0, 30) : between(0, 2_000),
        base: between(0, 20_000),
        rateBp: between(500, 5000),
        expenses: between(0, 400),
        ships: between(0, 6),
        research: between(0, 3) === 0 ? 0 : between(0, 30),
        withCatalogue: between(0, 1) === 1,
        projectWork: between(0, 2) === 0 ? 0 : between(1, 3_000),
      });
    }
  });

  it("holds on the boundary states: zeros, exact fit, one short and one spare", () => {
    // revenue at base 6000 / 2000 bp is exactly 50.
    const common = { base: 6000, rateBp: 2000, withCatalogue: true } as const;
    for (const treasury of [0, 1, 49, 50, 51, 99, 100, 101])
      for (const expenses of [0, 1, 50, 51, 100])
        for (const ships of [0, 1, 3])
          for (const research of [0, 1, 6])
            for (const projectWork of [0, 1, 500])
              checkMonth({ ...common, treasury, expenses, ships, research, projectWork });
  });

  it("holds with no income at all (base zero) and with the maximum supported rate and base", () => {
    checkMonth({
      treasury: 0,
      base: 0,
      rateBp: 500,
      expenses: 0,
      ships: 0,
      research: 0,
      withCatalogue: false,
      projectWork: 0,
    });
    checkMonth({
      treasury: 0,
      base: 0,
      rateBp: 5000,
      expenses: 5,
      ships: 2,
      research: 3,
      withCatalogue: true,
      projectWork: 10,
    });
    // Revenue 20,000 x 5000 / 120000 = 833 and a very large treasury: integer maths, nothing rounds or overflows.
    checkMonth({
      treasury: 1_000_000_000,
      base: 20_000,
      rateBp: 5000,
      expenses: 400,
      ships: 6,
      research: 30,
      withCatalogue: true,
      projectWork: 3_000,
    });
  });
});
