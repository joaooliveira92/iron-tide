// Reads data/run-*.json (produced by run-months.mjs) and writes the CSV/JSON datasets.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DATA, INTERPRETATIONS, readYaml, compileProductionCampaign, engineRevenue, constructionCap } from "./lib.mjs";

const csv = (rows) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};
const write = (name, rows) => writeFileSync(resolve(DATA, name), csv(rows));
const runs = {};
for (const id of Object.keys(INTERPRETATIONS)) runs[id] = JSON.parse(readFileSync(resolve(DATA, `run-${id}.json`)));
const group = (rows) => { const m = {}; for (const r of rows) (m[r.id] ??= []).push(r); return m; };

// ---- 0014 reproduction (I0) -------------------------------------------------
const dr0014 = { portugal: [110, 11], netherlands: [109, 12], qing: [108, 13], austria_hungary: [104, 17], germany: [103, 18], france: [102, 19], italy: [103, 18], japan: [102, 19], ottoman_empire: [102, 19], russia: [102, 19], spain: [102, 19], uk: [102, 19], brazil: [100, 21], usa: [97, 24] };
const base0 = group(runs.I0_current.rows);
write("first-negative-reproduction.csv", Object.entries(dr0014).map(([id, [cnt, first]]) => {
  const rs = base0[id]; const f = rs.find((r) => r.negObligation);
  const count = rs.filter((r) => r.negObligation).length;
  const zero = rs.find((r) => r.close_treasury === 0);
  return { nation: id, dr0014_first: first, measured_first: f?.month, dr0014_count: cnt, measured_count: count, match: f?.month === first && count === cnt, first_treasury_zero_month: zero?.month, T0: rs[0].treasury, expenses: rs[0].expenses, maintenance_m1: rs[0].debit_MAINTENANCE_EXPENDITURE, monthly_drain: rs[0].expenses + rs[0].debit_MAINTENANCE_EXPENDITURE };
}));

// ---- raw authored -> compiled start state -----------------------------------
const eco = Object.fromEntries(readYaml("economies.yaml").map((e) => [e.nationId, e]));
const res = Object.fromEntries(readYaml("research.yaml").map((e) => [e.nationId, e]));
const { state } = compileProductionCampaign();
write("raw-to-start-state.csv", [...state.snapshot.nations.values()].sort((a, b) => a.id.localeCompare(b.id)).map((n) => ({
  nation: n.id, isPlayable: n.isPlayable,
  raw_treasury: eco[n.id]?.treasury, raw_income: eco[n.id]?.income, raw_expenses: eco[n.id]?.expenses, raw_researchBudget: res[n.id]?.researchBudget,
  raw_techs: res[n.id]?.technologies?.length, raw_techs_completed: res[n.id]?.technologies?.filter((t) => t.completed).length,
  compiled_treasury: Number(n.treasury), compiled_income: Number(n.income), compiled_expenses: Number(n.expenses),
  compiled_baseResources: Number(n.baseResources), compiled_rateBp: Number(n.navalAppropriationRateBp), compiled_maintenanceCost: Number(n.maintenanceCost),
  compiled_researchBudget: Number(n.research.researchBudget), compiled_standingResearchBudget: n.research.standingResearchBudget ?? "",
  ships: n.fleets.reduce((s, f) => s + f.ships.length, 0), projects: n.constructionProjects.length,
  authored_income_over_treasury_pct: eco[n.id] ? +(100 * eco[n.id].income / eco[n.id].treasury).toFixed(2) : "",
  authored_expenses_over_income_pct: eco[n.id] ? +(100 * eco[n.id].expenses / eco[n.id].income).toFixed(2) : "",
  research_over_income_pct: eco[n.id] ? +(100 * res[n.id].researchBudget / eco[n.id].income).toFixed(2) : "",
  treasury_over_expenses_months: eco[n.id] ? +(eco[n.id].treasury / eco[n.id].expenses).toFixed(2) : "",
  projection_formula_monthly_appropriation: Math.floor(Number(n.income) * 2000 / 10000),
})));

// ---- GB / FR / PT 12 month transitions --------------------------------------
const KEEP = ["month", "year", "calMonth", "id", "treasury", "baseResources", "rateBp", "income", "expenses", "researchBudget", "standingResearchBudget", "ships", "projects",
  "revenueFormula", "credit_NAVAL_APPROPRIATION", "debit_RESEARCH_EXPENDITURE", "debit_MAINTENANCE_EXPENDITURE", "debit_OBLIGATION", "debit_APPROPRIATION", "debit_CONSTRUCTION_PRESERVATION", "constructionCap",
  "close_treasury", "delta", "proj_monthlyAppropriation", "proj_maintenance", "proj_constructionSpend", "proj_researchSpend", "proj_surplus", "proj_shipyardCapacity", "negObligation"];
const t12 = [];
for (const [iid, run] of Object.entries(runs)) {
  if (iid.endsWith("_standing")) continue; // identical treasury path: research is never paid (see report)
  const g = group(run.rows);
  for (const n of ["uk", "france", "portugal"]) for (const r of g[n].slice(0, 12)) {
    const exactRevNum = r.baseResources * r.rateBp; // revenue_exact = num/120000
    const o = { interpretation: iid };
    for (const k of KEEP) o[k] = r[k] ?? 0;
    o.revenue_exact_x120000 = exactRevNum; // monthly exact revenue = this / 120000
    o.revenue_rounding_loss_x120000 = exactRevNum - r.revenueFormula * 120000;
    o.projected_close = r.treasury + r.proj_surplus;
    o.projection_error = r.close_treasury - o.projected_close;
    o.engine_recon = r.treasury + (r.credit_NAVAL_APPROPRIATION ?? 0) - (r.debit_MAINTENANCE_EXPENDITURE ?? 0) - (r.debit_OBLIGATION ?? 0) - (r.debit_APPROPRIATION ?? 0) - (r.debit_RESEARCH_EXPENDITURE ?? 0) - (r.debit_CONSTRUCTION_PRESERVATION ?? 0);
    o.recon_matches_close = o.engine_recon === r.close_treasury || (o.engine_recon < 0 && r.close_treasury === 0);
    t12.push(o);
  }
}
write("gb-fr-pt-12-months.csv", t12);

// ---- classification ----------------------------------------------------------
const cls = [];
for (const [iid, run] of Object.entries(runs)) {
  const g = group(run.rows);
  for (const [id, rs] of Object.entries(g)) {
    const m1 = rs[0]; const f = rs.find((r) => r.negObligation); const fi = f ? rs.indexOf(f) : -1;
    const pre = fi >= 0 ? rs.slice(0, fi + 1) : rs;
    const sum = (k) => pre.reduce((s, r) => s + (r[k] ?? 0), 0);
    const Rv = m1.credit_NAVAL_APPROPRIATION ?? 0, E = m1.expenses, M = m1.debit_MAINTENANCE_EXPENDITURE ?? 0;
    const ap = sum("debit_APPROPRIATION") / pre.length;
    const last = rs[rs.length - 1];
    const R = m1.researchBudget;
    let primary, secondary = "";
    if (!f) { primary = "no_failure"; secondary = last.close_treasury >= m1.treasury ? "treasury_non_decreasing" : "treasury_declining_but_solvent_120m"; }
    else if (m1.baseResources === 0) { primary = "missing_compiler_mapping"; secondary = "no_inflow; opening_treasury_covers_only_" + (m1.treasury / (E + M)).toFixed(1) + "_months_of_expenses_plus_maintenance"; }
    else if (m1.baseResources > 0 && Rv === 0) { primary = "unit_mismatch_rounding_to_zero"; secondary = "exact_monthly_revenue_" + (m1.baseResources * m1.rateBp / 120000).toFixed(3) + "_floors_to_0"; }
    else if (Rv < E) { primary = "excessive_mandatory_expenses"; secondary = "revenue_below_fixed_expenses"; }
    else if (Rv < E + M) { primary = "excessive_mandatory_expenses"; secondary = "revenue_covers_fixed_but_not_fixed_plus_maintenance"; }
    else if (Rv - E - M - ap < 0) primary = "recurring_appropriation";
    else { primary = "unresolved"; secondary = "net_recurring_nonnegative_but_failed"; }
    const hyp_with_research = Rv - E - M - ap - R; // hypothetical if authored research were paid monthly
    cls.push({
      interpretation: iid, nation: id, T0: m1.treasury, base: m1.baseResources, rateBp: m1.rateBp,
      revenue_m1: Rv, expenses: E, maintenance_m1: M, appropriation_avg_to_failure: +ap.toFixed(2), research_authored: R, research_paid_total_120m: rs.reduce((s, r) => s + (r.debit_RESEARCH_EXPENDITURE ?? 0), 0),
      net_recurring_engine: Rv - E - M - ap, net_recurring_if_research_paid_monthly: hyp_with_research,
      construction_cap: m1.constructionCap, projects: m1.projects,
      first_negative_month: f?.month ?? null, negative_months_120: rs.filter((r) => r.negObligation).length, first_treasury_zero_month: rs.find((r) => r.close_treasury === 0)?.month ?? null,
      closing_treasury_m120: last.close_treasury, min_treasury: Math.min(...rs.map((r) => r.close_treasury)),
      sum_maintenance_to_failure: sum("debit_MAINTENANCE_EXPENDITURE"), sum_obligation_to_failure: sum("debit_OBLIGATION"), sum_revenue_to_failure: sum("credit_NAVAL_APPROPRIATION"), sum_appropriation_to_failure: sum("debit_APPROPRIATION"),
      cause_primary: primary, cause_detail: secondary,
      flag_rounding_zeroes_revenue: m1.baseResources > 0 && Rv === 0,
      exact_monthly_revenue: +(m1.baseResources * m1.rateBp / 120000).toFixed(4),
      flag_unit_mismatch_projection_vs_engine: m1.proj_monthlyAppropriation !== Rv,
      flag_invalid_projection_sign: Math.sign(m1.proj_surplus) !== Math.sign(m1.delta),
      flag_construction_constraint: m1.constructionCap === 0 && m1.projects > 0,
      flag_unsupported_authored_value: m1.researchBudget > m1.income || m1.expenses / m1.income > 0.6,
      flag_deliberate_deficit_marker_present: false,
    });
  }
}
write("nation-classification.csv", cls);

// ---- projection drift (I0, I1, I2, I3) over 12 and 120 months ---------------
const drift = [];
for (const iid of ["I0_current", "I1_base12income", "I2_income_is_appropriation", "I3_income_annual"]) {
  const g = group(runs[iid].rows);
  for (const [id, rs] of Object.entries(g)) {
    const e12 = rs.slice(0, 12).reduce((s, r) => s + (r.close_treasury - (r.treasury + r.proj_surplus)), 0);
    const e120 = rs.reduce((s, r) => s + (r.close_treasury - (r.treasury + r.proj_surplus)), 0);
    drift.push({ interpretation: iid, nation: id, proj_surplus_m1: rs[0].proj_surplus, realised_delta_m1: rs[0].delta, error_m1: rs[0].delta - rs[0].proj_surplus,
      cumulative_projection_error_12m: e12, cumulative_projection_error_120m: e120,
      projected_treasury_m13_by_chain: rs[0].treasury + 12 * rs[0].proj_surplus, realised_treasury_m13: rs[12].treasury,
      projection_omits_expenses_by: rs[0].expenses, projection_charges_unpaid_research: rs[0].proj_researchSpend });
  }
}
write("projection-drift.csv", drift);

// ---- rounding: chained floor vs single floor, annual loss -------------------
const rnd = [];
for (const [iid, run] of Object.entries(runs)) {
  if (iid.endsWith("_standing")) continue;
  const g = group(run.rows);
  for (const [id, rs] of Object.entries(g)) {
    const r = rs[0]; if (!r.baseResources) continue;
    const exactAnnualNum = r.baseResources * r.rateBp; // /10000 annual
    const monthlyCredited = r.revenueFormula;
    const singleFloor = Math.floor(exactAnnualNum / 120000);
    rnd.push({ interpretation: iid, nation: id, base: r.baseResources, rateBp: r.rateBp, annual_exact: exactAnnualNum / 10000, annual_floor_inner: Math.floor(exactAnnualNum / 10000), monthly_chained: monthlyCredited, monthly_single_floor: singleFloor, monthly_exact: +(exactAnnualNum / 120000).toFixed(4), annual_credited_12x: 12 * monthlyCredited, annual_loss_vs_exact: +(exactAnnualNum / 10000 - 12 * monthlyCredited).toFixed(4), cap: constructionCap(r.baseResources), base_for_cap1: 1200 });
  }
}
write("rounding-boundaries.csv", rnd);
// chained vs single floor divergence scan
let diverge = []; for (let b = 0; b <= 20000; b++) for (const rate of [500, 2000, 5000]) { const c = engineRevenue(b, rate), s = Math.floor((b * rate) / 120000); if (c !== s) diverge.push({ base: b, rateBp: rate, chained: c, single: s }); }
console.log("divergent (base 0..20000, rates 500/2000/5000):", diverge.length);

// ---- nation level summary JSON ---------------------------------------------
writeFileSync(resolve(DATA, "summary.json"), JSON.stringify({
  contentHash: runs.I0_current.contentHash, months: 120,
  firstNegative: Object.fromEntries(Object.entries(base0).map(([id, rs]) => [id, rs.find((r) => r.negObligation)?.month ?? null])),
}, null, 1));
console.log("done");

// ---- divergent groups / hidden coupling -------------------------------------
import { buildOpeningBriefingProjection } from "./lib.mjs";
const groups = [];
for (const [id, rs] of Object.entries(base0)) {
  const r = rs[0];
  const maint = rs.map((x) => x.debit_MAINTENANCE_EXPENDITURE ?? 0);
  const drain = r.expenses + (r.debit_MAINTENANCE_EXPENDITURE ?? 0);
  const forgiven = rs.reduce((s, x) => s + (x.clamped_OBLIGATION ?? 0) + (x.clamped_MAINTENANCE_EXPENDITURE ?? 0), 0);
  let briefing = "";
  try { const b = buildOpeningBriefingProjection(state, id, { year: 1880, month: 1 }); briefing = b ? `governmentAllocation=${b.treasury.governmentAllocation};projectedSurplus=${b.treasury.projectedSurplus};status=${b.treasury.status}` : "undefined"; } catch (e) { briefing = "THROWS " + String(e.message).slice(0, 80); }
  const i2 = group(runs.I2_income_is_appropriation.rows)[id][0];
  groups.push({ nation: id, isPlayable: state.snapshot.nations.get(id).isPlayable, T0: r.treasury, expenses: r.expenses, maintenance_m1: r.debit_MAINTENANCE_EXPENDITURE, maintenance_min_120m: Math.min(...maint), maintenance_max_120m: Math.max(...maint),
    drain_expenses_plus_maint: drain, runway_months_exact: +(r.treasury / drain).toFixed(2), maintenance_share_of_drain_pct: +(100 * (r.debit_MAINTENANCE_EXPENDITURE ?? 0) / drain).toFixed(1),
    income_authored: r.income, income_minus_drain_if_income_is_monthly: r.income - drain, income_over_drain: +(r.income / drain).toFixed(2),
    forgiven_debt_ledger_overstatement_120m: forgiven, opening_briefing: briefing,
    runway_group: r.treasury / drain < 11 ? "A_<11m" : r.treasury / drain < 14 ? "B_11-14m" : r.treasury / drain < 17.5 ? "C_14-17.5m" : "D_>=17.5m" });
}
write("nation-groups.csv", groups);

// ---- construction progress under each interpretation (remaining work from compiled start) ----
const remaining = {};
for (const n of state.snapshot.nations.values()) remaining[n.id] = n.constructionProjects.reduce((s, p) => s + Number(p.totalWork) - Number(p.completedWork), 0);
const cons = [];
for (const [iid, run] of Object.entries(runs)) {
  if (iid.endsWith("_standing")) continue;
  for (const [id, rs] of Object.entries(group(run.rows))) {
    if (remaining[id] === 0) continue;
    let cum = 0, done = null;
    for (const r of rs) { cum += r.debit_APPROPRIATION ?? 0; if (done === null && cum >= remaining[id]) done = r.month; }
    cons.push({ interpretation: iid, nation: id, remaining_work_at_start: remaining[id], cap_per_month: rs[0].constructionCap, cumulative_appropriation_120m: cum, month_all_projects_funded: done });
  }
}
write("construction-progress.csv", cons);
