// Shared read-only helpers for the R3 economy scenario scripts. Imports built
// workspace dist output; never writes to tracked production files.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..", "..", "..", "..");
export const DATA = resolve(HERE, "..", "data");
const imp = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

export const { compileProductionCampaign, PRODUCTION_PACK_DIR } = await imp(
  "packages/cross-process-test/dist/production-pack.js",
);
export const { MonthExecutor } = await imp("packages/phase-engine/dist/index.js");
export const { buildPlayerProjection, buildOpeningBriefingProjection } = await imp(
  "packages/campaign-engine/dist/index.js",
);
export const { SafeInt } = await imp("packages/contracts/dist/index.js");
export const { DiagnosticCollector } = await imp("packages/diagnostics/dist/index.js");
export const { canonicalSerialize, sha256Hex } = await imp("packages/deterministic/dist/index.js");

const { parseYamlSafe } = await imp("packages/content-schema/dist/index.js");
export const readYaml = (name) => {
  const c = new DiagnosticCollector();
  const r = parseYamlSafe(readFileSync(resolve(ROOT, "content/production/1880", name), "utf8"), name, c);
  if (!r.success) throw new Error(`yaml parse failed: ${name}`);
  return r.data;
};

export const SEED = "ten-year-progression-1880"; // same seed as the N-3 gate
export const CATEGORIES = [
  "NAVAL_APPROPRIATION",
  "APPROPRIATION",
  "CONSTRUCTION_PRESERVATION",
  "MAINTENANCE_EXPENDITURE",
  "OBLIGATION",
  "RESEARCH_EXPENDITURE",
];

export function calendarAt(snapshot0, offset) {
  const idx = Number(snapshot0.startYear) * 12 + Number(snapshot0.startMonth) - 1 + offset;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** floor(floor(base/12)/100): the engine's construction cap (economyPhases.ts:61-64). */
export const constructionCap = (base) => Math.floor(Math.floor(base / 12) / 100);
/** Engine revenue (economyPhases.ts:71-76): two chained floors. */
export const engineRevenue = (base, rateBp) =>
  Math.floor(Math.floor((base * rateBp) / 10000) / 12);

/** Interpretations: how authored `income` maps to engine `baseResources`. */
export const INTERPRETATIONS = {
  I0_current: { desc: "shipped compiler: baseResources=0, rate=2000, research one-shot", base: () => 0, standing: false },
  I1_base12income: { desc: "income = monthly gross; base = 12*income (revenue = 20% income, matches UI projection)", base: (inc) => 12 * inc, standing: false },
  I2_income_is_appropriation: { desc: "income = monthly naval appropriation credited in full; base = 60*income at rate 2000", base: (inc) => 60 * inc, standing: false },
  I3_income_annual: { desc: "income = annual naval appropriation; base = 5*income at rate 2000 (monthly = income/12)", base: (inc) => 5 * inc, standing: false },
  I1s_base12income_standing: { desc: "I1 plus standing research budget seeded from authored researchBudget", base: (inc) => 12 * inc, standing: true },
  I2s_income_is_appropriation_standing: { desc: "I2 plus standing research budget", base: (inc) => 60 * inc, standing: true },
  I3s_income_annual_standing: { desc: "I3 plus standing research budget", base: (inc) => 5 * inc, standing: true },
  I0s_current_standing: { desc: "I0 (no revenue) plus standing research budget", base: () => 0, standing: true },
};

export function applyInterpretation(snapshot, interp) {
  const nations = new Map(snapshot.nations);
  for (const [id, n] of nations) {
    const base = interp.base(Number(n.income));
    nations.set(id, {
      ...n,
      baseResources: SafeInt(base),
      research: interp.standing
        ? { ...n.research, standingResearchBudget: n.research.researchBudget }
        : n.research,
    });
  }
  return { ...snapshot, nations };
}

export function nationStateRow(n) {
  return {
    treasury: Number(n.treasury),
    income: Number(n.income),
    expenses: Number(n.expenses),
    baseResources: Number(n.baseResources ?? 0),
    rateBp: Number(n.navalAppropriationRateBp ?? 0),
    researchBudget: Number(n.research.researchBudget),
    standingResearchBudget: n.research.standingResearchBudget === undefined ? null : Number(n.research.standingResearchBudget),
    maintenanceCostField: Number(n.maintenanceCost),
    ships: n.fleets.reduce((s, f) => s + f.ships.length, 0),
    projects: n.constructionProjects.length,
    paidWork: n.constructionProjects.reduce((s, p) => s + Number(p.paidWork), 0),
  };
}

/** Run `months` command-free months; returns per-nation-month rows. */
export function runMonths(initial, months, { playableOnly = false } = {}) {
  const rows = [];
  let snapshot = initial;
  for (let i = 0; i < months; i++) {
    const cal = calendarAt(initial, i);
    const pre = new Map();
    for (const [id, n] of snapshot.nations) {
      if (playableOnly && !n.isPlayable) continue;
      const row = { id, ...nationStateRow(n) };
      const proj = buildPlayerProjection({ snapshot, rawHash: "" }, id, cal);
      row.proj_monthlyAppropriation = proj.economy.monthlyAppropriation;
      row.proj_surplus = proj.projectedSurplusDeficit;
      row.proj_maintenance = proj.economy.maintenanceCost;
      row.proj_constructionSpend = proj.economy.constructionSpend;
      row.proj_researchSpend = proj.economy.researchSpend;
      row.proj_shipyardCapacity = proj.economy.shipyardCapacity;
      pre.set(id, row);
    }
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snapshot, [], `${SEED}:month:${String(snapshot.turnNumber)}`, collector);
    const byNation = new Map();
    for (const tx of result.financialLedger.all) {
      const m = byNation.get(tx.nationId) ?? {};
      const key = tx.categoryId;
      const e = (m[key] ??= { debit: 0, credit: 0, count: 0, clampedShortfall: 0, firstPrev: Number(tx.previousBalance) });
      e.debit += Number(tx.debit); e.credit += Number(tx.credit); e.count += 1;
      if (key === "OBLIGATION" || key === "RESEARCH_EXPENDITURE" || key === "MAINTENANCE_EXPENDITURE") {
        const paid = Number(tx.previousBalance) - Number(tx.newBalance);
        e.clampedShortfall += Number(tx.debit) - paid;
      }
      byNation.set(tx.nationId, m);
    }
    const negs = new Map();
    for (const d of collector.errors) {
      const m = /Nation (\S+) would/.exec(d.message);
      if (m) negs.set(m[1], d.code);
    }
    for (const [id, row] of pre) {
      const after = result.finalSnapshot.nations.get(id);
      const led = byNation.get(id) ?? {};
      row.month = i + 1; row.year = cal.year; row.calMonth = cal.month;
      row.close_treasury = Number(after.treasury);
      row.delta = row.close_treasury - row.treasury;
      for (const c of new Set([...CATEGORIES, ...Object.keys(led)])) {
        row[`debit_${c}`] = led[c]?.debit ?? 0;
        row[`credit_${c}`] = led[c]?.credit ?? 0;
        row[`clamped_${c}`] = led[c]?.clampedShortfall ?? 0;
      }
      row.negObligation = negs.has(id);
      row.constructionCap = constructionCap(row.baseResources);
      row.revenueFormula = engineRevenue(row.baseResources, row.rateBp);
      row.actualFlowCheck = row.delta; // delta vs ledger reconciled in analyze
      rows.push(row);
    }
    snapshot = { ...result.finalSnapshot, turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE) };
  }
  return { rows, finalSnapshot: snapshot };
}
