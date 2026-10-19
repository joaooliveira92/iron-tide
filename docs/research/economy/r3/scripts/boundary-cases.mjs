// Boundary and malformed-input probes. Each case mutates ONE in-memory nation of the
// compiled snapshot (never a tracked file) and executes one or two production months.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileProductionCampaign, MonthExecutor, DiagnosticCollector, SafeInt, SEED, DATA, buildPlayerProjection, engineRevenue, constructionCap } from "./lib.mjs";

const { state } = compileProductionCampaign();
const NATION = "uk";
const MAXSAFE = Number.MAX_SAFE_INTEGER;
const csv = (rows) => { const cols = [...new Set(rows.flatMap(Object.keys))]; const e = (v) => (v === undefined || v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v)); return [cols.join(","), ...rows.map((r) => cols.map((c) => e(r[c])).join(","))].join("\n") + "\n"; };

function mutate(patch, { raw = false } = {}) {
  const nations = new Map(state.snapshot.nations);
  const n = nations.get(NATION);
  const next = { ...n };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = raw ? v : (typeof v === "number" ? SafeInt(v) : v);
  }
  nations.set(NATION, next);
  return { ...state.snapshot, nations };
}
function runCase(id, group, patch, opts = {}) {
  const out = { case: id, group, patch: JSON.stringify(patch, (k, v) => (v === undefined ? "<deleted>" : v)), thrown: "", diagnostics: "", revenue_credit: "", close_treasury: "", open_treasury: "", cap: "", projection: "" };
  let snap;
  try { snap = mutate(patch, opts); } catch (e) { out.thrown = "construct: " + String(e.message).slice(0, 120); return out; }
  const n0 = snap.nations.get(NATION);
  out.open_treasury = Number(n0.treasury);
  try {
    const p = buildPlayerProjection({ snapshot: snap, rawHash: "" }, NATION, { year: 1880, month: 1 });
    out.projection = `monthlyAppropriation=${p.economy.monthlyAppropriation};surplus=${p.projectedSurplusDeficit}`;
  } catch (e) { out.projection = "THROWS:" + String(e.message).slice(0, 100); }
  try {
    const c = new DiagnosticCollector();
    const r = new MonthExecutor().execute(snap, [], `${SEED}:month:0`, c);
    const n1 = r.finalSnapshot.nations.get(NATION);
    out.close_treasury = Number(n1.treasury);
    out.revenue_credit = r.financialLedger.all.filter((t) => t.nationId === NATION && t.categoryId === "NAVAL_APPROPRIATION").reduce((s, t) => s + Number(t.credit), 0);
    out.success = r.success;
    out.diagnostics = [...new Set(c.all.filter((d) => d.severity !== "info").map((d) => `${d.severity}:${d.code}`))].join("|");
    out.ledger_total_debit = r.financialLedger.all.filter((t) => t.nationId === NATION).map((t) => `${t.categoryId}:${Number(t.debit)}`).join(";");
  } catch (e) { out.thrown = String(e.constructor?.name) + ": " + String(e.message).slice(0, 160); }
  return out;
}

const rows = [];
const T = 100000;
// rate extremes at base 120000 (engine revenue = base*rate/10000/12)
for (const rate of [0, 1, 499, 500, 2000, 5000, 5001, 10000, 100000]) rows.push(runCase(`rate_${rate}`, "rate", { baseResources: 120000, navalAppropriationRateBp: rate, treasury: T }));
rows.push(runCase("rate_negative", "rate", { baseResources: 120000, navalAppropriationRateBp: -1, treasury: T }, { raw: true }));
rows.push(runCase("rate_fractional_raw", "rate", { baseResources: 120000, navalAppropriationRateBp: 2000.5, treasury: T }, { raw: true }));
// base rounding boundaries at rate 2000: first base paying 1 per month = 60; cap=1 at 1200
for (const base of [0, 1, 59, 60, 119, 120, 1199, 1200, 2399, 2400, 119999, 120000]) rows.push(runCase(`base_${base}`, "base", { baseResources: base, navalAppropriationRateBp: 2000, treasury: T }));
// integer limits
rows.push(runCase("base_maxsafe", "integer_limit", { baseResources: MAXSAFE, navalAppropriationRateBp: 2000, treasury: T }));
const edge = Math.floor(MAXSAFE / 2000);
rows.push(runCase("base_just_below_mul_overflow_rate2000", "integer_limit", { baseResources: edge, navalAppropriationRateBp: 2000, treasury: T }));
rows.push(runCase("base_just_above_mul_overflow_rate2000", "integer_limit", { baseResources: edge + 1, navalAppropriationRateBp: 2000, treasury: T }));
rows.push(runCase("treasury_maxsafe_plus_revenue", "integer_limit", { baseResources: 120000, navalAppropriationRateBp: 2000, treasury: MAXSAFE - 100 }));
rows.push(runCase("treasury_maxsafe", "integer_limit", { baseResources: 120000, navalAppropriationRateBp: 2000, treasury: MAXSAFE }));
rows.push(runCase("base_unsafe_integer_raw", "integer_limit", { baseResources: 2 ** 53 }, { raw: true }));
rows.push(runCase("base_nonint_raw", "integer_limit", { baseResources: 1000.5 }, { raw: true }));
// treasury / expense states
rows.push(runCase("treasury_zero", "treasury", { treasury: 0 }));
rows.push(runCase("treasury_just_below_expenses", "treasury", { treasury: 38 + 16 - 1 }));
rows.push(runCase("treasury_equals_expenses_plus_maint", "treasury", { treasury: 38 + 16 }));
rows.push(runCase("treasury_negative", "treasury", { treasury: -5 }, { raw: true }));
rows.push(runCase("expenses_zero_treasury_below_maintenance", "treasury", { treasury: 5, expenses: 0 }));
rows.push(runCase("expenses_zero", "treasury", { expenses: 0 }));
rows.push(runCase("expenses_huge", "treasury", { expenses: MAXSAFE }));
rows.push(runCase("expenses_negative_raw", "treasury", { expenses: -10 }, { raw: true }));
// missing fields
for (const f of ["income", "expenses", "baseResources", "navalAppropriationRateBp", "maintenanceCost", "treasury"]) rows.push(runCase(`missing_${f}`, "missing_field", { [f]: undefined }, { raw: true }));
rows.push(runCase("missing_research_budget", "missing_field", { research: { ...state.snapshot.nations.get(NATION).research, researchBudget: undefined } }, { raw: true }));
writeFileSync(resolve(DATA, "boundary-cases.csv"), csv(rows));

// Compiler-side missing fields: compile with the economy row absent is covered in report by code reading (fallback 500/100/50).
// Revenue/cap threshold table (pure functions, same formula as economyPhases.ts)
const thr = [];
for (const rate of [500, 1000, 2000, 3000, 5000]) {
  let b = 0; while (engineRevenue(b, rate) < 1) b++;
  let c = 0; while (constructionCap(c) < 1) c++;
  thr.push({ rateBp: rate, min_base_for_revenue_1: b, min_base_for_cap_1: c, revenue_at_cap1_base: engineRevenue(c, rate) });
}
writeFileSync(resolve(DATA, "thresholds.csv"), csv(thr));
console.log(rows.map((r) => `${r.case}: thrown=${r.thrown} rev=${r.revenue_credit} close=${r.close_treasury} diag=${r.diagnostics}`).join("\n"));
