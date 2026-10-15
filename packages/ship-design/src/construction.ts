import type { ComponentCategory } from "./component.js";
import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { CostBreakdown } from "./cost.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { toSafe } from "./units.js";

export type LineId = "slipway" | "armour_plate" | "heavy_gun" | "machinery" | "quay" | "trials";
export const LINE_IDS: readonly LineId[] = [
  "slipway",
  "armour_plate",
  "heavy_gun",
  "machinery",
  "quay",
  "trials",
];

export type PackageKind =
  | "HULL"
  | "ARMOUR"
  | "ORDNANCE"
  | "MACHINERY"
  | "LAUNCH"
  | "FIT_OUT"
  | "TRIALS"
  | "ACCEPTANCE";
/** Canonical order for allocating contended capacity (extends DESIGN-23 §19 ordering for new construction). */
export const PACKAGE_ORDER: readonly PackageKind[] = [
  "HULL",
  "MACHINERY",
  "ARMOUR",
  "ORDNANCE",
  "LAUNCH",
  "FIT_OUT",
  "TRIALS",
  "ACCEPTANCE",
];

export interface WorkPackage {
  readonly id: string;
  readonly kind: PackageKind;
  readonly line: LineId;
  readonly totalWork: number;
  readonly dependsOn: readonly string[];
}

export interface ConstructionBalance {
  readonly hullWorkPerTonneMicro: number;
  readonly armourWorkPerKgMicro: number;
  readonly machineryWorkPerKwMicro: number;
  /** Money (micro) that buys one work micro-unit for a component with no authored work. */
  readonly componentCostPerWorkMicro: number;
  readonly lineByCategory: Readonly<Record<ComponentCategory, LineId | "fit_out">>;
  readonly fitOutHullShareBp: number;
  readonly launchHullShareBp: number;
  readonly trialsShareBp: number;
  readonly acceptanceShareBp: number;
  readonly firstOfClassWorkBp: number;
  readonly maxMonths: number;
  /** Displacement in tonnes -> months from keel to commissioning at a neutral yard (ADR-0067 section 5). */
  readonly buildMonthsByDisplacementT: LookupTable;
  /** Provenance of each build-time point, parallel to `buildMonthsByDisplacementT.points` (same length and order). */
  readonly buildMonthsProvenance: readonly BuildTimeProvenance[];
  /**
   * Year the keel is laid -> multiplier on the displacement table, bp (ADR-0080). The displacement table is the 1894-1900
   * standard (10_000); earlier yards were slower, later ones faster. Clamped at both ends.
   */
  readonly buildTimeEraBp: LookupTable;
  /** Provenance of each era point, parallel to `buildTimeEraBp.points`. */
  readonly buildTimeEraProvenance: readonly BuildTimeProvenance[];
  /** Industry-efficiency multiplier on build time for an efficient shipbuilding industry, bp (10_000 = neutral). */
  readonly efficientIndustryBp: number;
  /** Accelerated construction time multiplier, bp (RTW3 manual p. 31: 10 % faster = 9_000). */
  readonly accelerationTimeBp: number;
  /**
   * Mothballed-maintenance cost per month, in currency micro-units, for a completed-but-stored hull. The RTW3 manual
   * gives only the HALF rule a halted hull pays (`preservationCostBp`), never a base, so this is a PLACEHOLDER
   * (BALANCE TARGET) awaiting a source: calibrate from play, never fit to one.
   */
  readonly mothballedMaintenancePerMonthMicro: number;
  /**
   * Fraction of the mothballed-maintenance cost a `HALTED` project pays each month, basis points (RTW3 manual
   * pp. 30-31: half = `5_000`). This is the manual's rule, not a placeholder.
   */
  readonly preservationCostBp: number;
  /**
   * The manual's "total tonnage under construction cannot exceed a multiple of dock size" (p33), as basis points of
   * the nation's `maximumNewConstructionMassKg` (`10_000` = 1x). The manual gives no number, so this is a PLACEHOLDER
   * BALANCE TARGET (SB3-R18); it feeds `maxConcurrentConstructionMassKg` in `constructionCapacity.ts`.
   */
  readonly shipyardCapacityMultipleBp: number;
  /**
   * The exempt share of an AMC or small-corvette new construction against the normal `NEW_CONSTRUCTION` pool, basis
   * points within `0..10_000` (SB3-R19; DESIGN-16 section 9). The manual excludes AMC and small corvettes from the
   * tonnage cap but gives no percentage, so this is a PLACEHOLDER BALANCE TARGET. The exempt share is backed by the
   * declared external source; the non-exempt share still competes for normal capacity.
   */
  readonly amcCapacityExemptionBp: number;
  /**
   * Displacement at or below which a corvette (KE) is a "small corvette" and so qualifies for the exemption
   * (SB3-R19). The manual and DESIGN-16 leave "small corvette" unstated, so this is a PLACEHOLDER BALANCE TARGET.
   */
  readonly smallCorvetteMaxDisplacementKg: number;
}

/**
 * How well a build-time table point is sourced. VERIFIED: the months value is read in a primary contemporary source for a
 * ship of about that displacement. SECONDARY: from a compilation, a derived value, or a primary duration whose displacement
 * is not itself verified. ESTIMATE: no source. The Drawing Board labels the build time provisional unless every point that
 * brackets the displacement is VERIFIED.
 */
export type BuildTimeSourceStatus = "VERIFIED" | "SECONDARY" | "ESTIMATE";

/**
 * The preservation cost a `HALTED` project pays each month, in currency micro-units: the mothballed-maintenance base
 * times the half rule, floored to a whole micro-unit (DESIGN-23 section 7; RTW3 manual pp. 30-31). Pure and
 * deterministic; the base is a versioned balance constant, never a number in the engine. Zero when no base is authored.
 */
export function preservationCostPerMonthMicro(balance: ConstructionBalance): number {
  const base = balance.mothballedMaintenancePerMonthMicro;
  const bp = balance.preservationCostBp;
  if (!Number.isFinite(base) || !Number.isFinite(bp) || base <= 0 || bp <= 0) return 0;
  return Math.floor((base * bp) / 10_000);
}

export interface BuildTimeProvenance {
  readonly status: BuildTimeSourceStatus;
  /** Citation: publication, page and ship the value is read from. */
  readonly source: string;
}

export interface BuildTimeOptions {
  /** Campaign month the keel is laid (`YYYY-MM`): selects the era multiplier. Without it the table is used as is. */
  readonly month?: string | undefined;
  /** Shipbuilding-industry time multiplier, bp: below 10_000 efficient, above undeveloped. Default neutral. */
  readonly industryBp?: number;
  readonly accelerated?: boolean;
}

/** The year of a `YYYY-MM` month; throws on anything else, so a bad month cannot silently pick an era. */
function yearOf(month: string): number {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new Error(`build time needs a YYYY-MM month, got '${month}'`);
  return Number(m[1]);
}

/** The era multiplier on build time for a keel-laying month, bp (10_000 = the 1894-1900 standard). Pure. */
export function buildTimeEraBp(month: string, b: ConstructionBalance): number {
  return evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: yearOf(month) },
    tables: { t: b.buildTimeEraBp },
  });
}

/**
 * Historical build time (keel to commissioning) in whole months for a displacement, from the content table, scaled by the
 * era multiplier for the month (when given), the industry multiplier and, if accelerated, the acceleration multiplier.
 * Pure; round-half-up on each bp step; at least 1.
 */
export function historicalBuildMonths(
  displacementKg: number,
  b: ConstructionBalance,
  o: BuildTimeOptions = {},
): number {
  const tonnes = Math.round(displacementKg / 1000);
  const base = evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: tonnes },
    tables: { t: b.buildMonthsByDisplacementT },
  });
  let m = BigInt(base);
  if (o.month !== undefined) m = mulBp(m, buildTimeEraBp(o.month, b));
  m = mulBp(m, o.industryBp ?? 10_000);
  if (o.accelerated) m = mulBp(m, b.accelerationTimeBp);
  return Math.max(1, Number(m));
}

export interface ConstructionPlan {
  readonly packages: readonly WorkPackage[];
  readonly totalWork: number;
}

function checkProvenance(
  name: string,
  points: LookupTable["points"],
  prov: readonly BuildTimeProvenance[],
): void {
  if (prov.length !== points.length) {
    throw new Error(`${name} has ${prov.length} entries for ${points.length} table points`);
  }
  if (points.length === 0) throw new Error(`empty build-time table for ${name}`);
  for (const p of prov) {
    if (p.status !== "VERIFIED" && p.status !== "SECONDARY" && p.status !== "ESTIMATE") {
      throw new Error(`unknown build-time source status '${String(p.status)}'`);
    }
    if (p.source.trim() === "") throw new Error("build-time provenance needs a source citation");
  }
}

/** Whether every point bracketing `x` is VERIFIED: the point itself on an exact hit, the end point outside the table. */
function bracketVerified(
  points: LookupTable["points"],
  prov: readonly BuildTimeProvenance[],
  x: number,
): boolean {
  const last = points.length - 1;
  const verified = (i: number) => prov[i]!.status === "VERIFIED";
  if (x <= points[0]![0]) return verified(0);
  if (x >= points[last]![0]) return verified(last);
  for (let i = 1; i <= last; i++) {
    if (x === points[i]![0]) return verified(i);
    if (x < points[i]![0]) return verified(i - 1) && verified(i);
  }
  return verified(last);
}

/**
 * True while any table point that brackets this displacement (the point itself on an exact hit, the first or last point
 * outside the table, otherwise the two surrounding points) is not VERIFIED, or, when a month is given, any era point that
 * brackets its year. Throws if a provenance list does not match its table.
 */
export function buildTimeIsProvisional(
  displacementKg: number,
  b: ConstructionBalance,
  month?: string,
): boolean {
  const pts = b.buildMonthsByDisplacementT.points;
  checkProvenance("buildMonthsProvenance", pts, b.buildMonthsProvenance);
  checkProvenance("buildTimeEraProvenance", b.buildTimeEraBp.points, b.buildTimeEraProvenance);
  if (!bracketVerified(pts, b.buildMonthsProvenance, Math.round(displacementKg / 1000)))
    return true;
  if (month === undefined) return false;
  return !bracketVerified(b.buildTimeEraBp.points, b.buildTimeEraProvenance, yearOf(month));
}

const BP = 10_000n;
const mulBp = (v: bigint, p: number) => (v * BigInt(p) + BP / 2n) / BP;

/** Splits a compiled design into work packages with dependencies (spec §15.2). Pure and deterministic. */
export function planConstruction(
  c: CompiledDesign,
  d: DesignDraft,
  cost: CostBreakdown,
  b: ConstructionBalance,
  firstOfClass: boolean,
): ConstructionPlan {
  const mult = (v: bigint) => (firstOfClass ? mulBp(v, 10_000 + b.firstOfClassWorkBp) : v);
  const hullWork = mult((BigInt(c.ledger.hull) * BigInt(b.hullWorkPerTonneMicro)) / 1000n);
  let armour = mult(BigInt(c.armour?.totalWeightKg ?? 0) * BigInt(b.armourWorkPerKgMicro));
  let machinery = mult(BigInt(d.machinery.installedKw) * BigInt(b.machineryWorkPerKwMicro));
  let ordnance = 0n;
  let fitOut = mulBp(hullWork, b.fitOutHullShareBp);
  for (const k of c.components) {
    const work = mult(
      k.buildWorkMicro !== null
        ? BigInt(k.buildWorkMicro)
        : BigInt(k.costMicro) / BigInt(b.componentCostPerWorkMicro),
    );
    const line = k.productionLine ?? b.lineByCategory[k.category];
    if (line === "heavy_gun") ordnance += work;
    else if (line === "armour_plate") armour += work;
    else if (line === "machinery") machinery += work;
    else fitOut += work;
  }
  const launch = mulBp(hullWork, b.launchHullShareBp);
  const sum = hullWork + armour + machinery + ordnance + launch + fitOut;
  const trials = mulBp(sum, b.trialsShareBp);
  const acceptance = mulBp(sum, b.acceptanceShareBp);
  void cost;
  const w = (v: bigint) => Math.max(1, toSafe("work", v));
  const pk = (
    id: string,
    kind: PackageKind,
    line: LineId,
    total: bigint,
    dependsOn: string[],
  ): WorkPackage => ({ id, kind, line, totalWork: w(total), dependsOn });
  const packages: WorkPackage[] = [
    pk("hull", "HULL", "slipway", hullWork, []),
    pk("machinery", "MACHINERY", "machinery", machinery, []),
    pk("armour", "ARMOUR", "armour_plate", armour, []),
    pk("ordnance", "ORDNANCE", "heavy_gun", ordnance, []),
    pk("launch", "LAUNCH", "slipway", launch, ["hull"]),
    pk("fit_out", "FIT_OUT", "quay", fitOut, ["launch", "machinery", "armour", "ordnance"]),
    pk("trials", "TRIALS", "trials", trials, ["fit_out"]),
    pk("acceptance", "ACCEPTANCE", "trials", acceptance, ["trials"]),
  ];
  return { packages, totalWork: packages.reduce((a, p) => a + p.totalWork, 0) };
}

export class ConstructionPlanError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "ConstructionPlanError";
  /** `_tag`-based narrowing without `instanceof`. */
  static is(value: unknown): value is ConstructionPlanError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "ConstructionPlanError"
    );
  }
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConstructionPlanError";
  }
}

export interface MonthState {
  readonly month: number;
  readonly applied: Readonly<Record<string, number>>;
  readonly completed: readonly string[];
}

export interface ConstructionSchedule {
  readonly months: readonly MonthState[];
  readonly durationMonths: number;
  /** Line that limited progress in the most months. */
  readonly bottleneck: LineId | null;
  readonly finalWork: Readonly<Record<string, number>>;
}

export interface ScheduleInput {
  /** Work micro-units each line can apply per month for this ship. */
  readonly capacity: Readonly<Record<LineId, number>>;
  /** Money available per month, or null for unconstrained. */
  readonly monthlyFundingMicro: number | null;
  readonly costPerWorkMicro: number;
}

/** Cyclic or dangling dependencies fail with DOCKYARD_WORK_PACKAGE_CYCLE (DESIGN-23 §19). */
export function checkPlan(plan: ConstructionPlan): void {
  const ids = new Set(plan.packages.map((p) => p.id));
  const state = new Map<string, 1 | 2>();
  const by = new Map(plan.packages.map((p) => [p.id, p]));
  const visit = (id: string): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1)
      throw new ConstructionPlanError("DOCKYARD_WORK_PACKAGE_CYCLE", `cycle at ${id}`);
    state.set(id, 1);
    for (const dep of by.get(id)!.dependsOn) {
      if (!ids.has(dep))
        throw new ConstructionPlanError(
          "DOCKYARD_WORK_PACKAGE_DEPENDENCY_MISSING",
          `${id} depends on ${dep}`,
        );
      visit(dep);
    }
    state.set(id, 2);
  };
  for (const p of plan.packages) visit(p.id);
}

/** Work done so far on each package of a plan, by package id. The resumable state of a construction project. */
export type PackageProgress = Readonly<Record<string, number>>;

/** A project that has not started: no work on any package. */
export function emptyProgress(plan: ConstructionPlan): PackageProgress {
  return Object.fromEntries(plan.packages.map((p) => [p.id, 0]));
}

/** Packages in the order contended capacity is allocated: canonical kind order, then id. */
function allocationOrder(plan: ConstructionPlan): WorkPackage[] {
  return [...plan.packages].sort(
    (x, y) =>
      PACKAGE_ORDER.indexOf(x.kind) - PACKAGE_ORDER.indexOf(y.kind) || (x.id < y.id ? -1 : 1),
  );
}

/**
 * Whether a package is complete: all its work is done and so are all its dependencies. The second condition matters for a
 * package with no work (a very small ship can round a package to zero units): it is complete only once what it depends on is,
 * never "from the start", or later packages could begin before the hull was built. Plans are acyclic (`checkPlan`).
 */
export function isPackageComplete(
  plan: ConstructionPlan,
  progress: PackageProgress,
  id: string,
): boolean {
  const p = plan.packages.find((x) => x.id === id);
  if (p === undefined) return false;
  return (
    (progress[id] ?? 0) >= p.totalWork &&
    p.dependsOn.every((d) => isPackageComplete(plan, progress, d))
  );
}
const isComplete = isPackageComplete;

/** Whether every package of the plan has all its work done. */
export function isConstructionComplete(plan: ConstructionPlan, progress: PackageProgress): boolean {
  return plan.packages.every((p) => isPackageComplete(plan, progress, p.id));
}

export interface MonthAdvance {
  /** Progress after the month. */
  readonly progress: PackageProgress;
  /** Work applied this month, by package id (only packages that took work). */
  readonly applied: Readonly<Record<string, number>>;
  /** Packages that finished this month. */
  readonly completed: readonly string[];
  /** The line of each package that capacity, not money, held back this month (a line repeats once per such package). */
  readonly limitedLines: readonly LineId[];
}

/**
 * One month of construction from a given state: a package starts only when its dependencies are complete; work applied
 * to it is limited by its line's capacity, the remaining work and the funds available (work units this month, or null for
 * unconstrained). Contended lines are allocated in PACKAGE_ORDER. Pure, deterministic; never negative, never above the
 * remaining work (invariant I6). `simulateConstruction` is this step repeated.
 *
 * `dependencyProgress` is the state a package's dependencies are judged against (default: `progress`). A caller that funds
 * the same month in several steps passes the progress at the start of the month, so a package that finishes in one step
 * does not let its dependents start in a later step of the same month, exactly as in one whole-month step.
 */
export function advanceConstructionMonth(
  plan: ConstructionPlan,
  progress: PackageProgress,
  capacity: Readonly<Record<LineId, number>>,
  fundsWork: number | null,
  dependencyProgress: PackageProgress = progress,
): MonthAdvance {
  const cap = new Map(LINE_IDS.map((l) => [l, capacity[l]]));
  let funds = fundsWork === null ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(fundsWork));
  const next: Record<string, number> = { ...progress };
  const applied: Record<string, number> = {};
  const completed: string[] = [];
  const limited: LineId[] = [];
  for (const p of allocationOrder(plan)) {
    const done = progress[p.id] ?? 0;
    if (done >= p.totalWork || !p.dependsOn.every((d) => isComplete(plan, dependencyProgress, d)))
      continue;
    const rem = p.totalWork - done;
    const lineCap = cap.get(p.line)!;
    const a = Math.max(0, Math.min(rem, lineCap, funds));
    if (a < rem && a === lineCap && lineCap < funds) limited.push(p.line);
    cap.set(p.line, lineCap - a);
    funds -= a;
    next[p.id] = done + a;
    applied[p.id] = a;
    if (done + a >= p.totalWork) completed.push(p.id);
  }
  return { progress: next, applied, completed, limitedLines: limited };
}

/**
 * Month-by-month progress from the start. A package starts only when its dependencies are complete; progress in a month is
 * limited by line capacity and, if set, funding (money buys work at `costPerWorkMicro`). Contended lines are allocated in
 * PACKAGE_ORDER. Progress is never negative and never exceeds remaining work (invariant I6).
 */
export function simulateConstruction(
  plan: ConstructionPlan,
  s: ScheduleInput,
  maxMonths: number,
): ConstructionSchedule {
  checkPlan(plan);
  let progress = emptyProgress(plan);
  const months: MonthState[] = [];
  const limited = new Map<LineId, number>();
  for (let m = 1; m <= maxMonths && !isConstructionComplete(plan, progress); m++) {
    const funds =
      s.monthlyFundingMicro === null
        ? null
        : Math.floor(s.monthlyFundingMicro / Math.max(1, s.costPerWorkMicro));
    const step = advanceConstructionMonth(plan, progress, s.capacity, funds);
    for (const l of step.limitedLines) limited.set(l, (limited.get(l) ?? 0) + 1);
    months.push({ month: m, applied: step.applied, completed: step.completed });
    progress = step.progress;
  }
  if (!isConstructionComplete(plan, progress)) {
    throw new ConstructionPlanError(
      "CONSTRUCTION_STALLED",
      `not finished within ${maxMonths} months (capacity or funding too low)`,
    );
  }
  let bottleneck: LineId | null = null;
  let best = 0;
  for (const l of LINE_IDS) {
    const n = limited.get(l) ?? 0;
    if (n > best) {
      best = n;
      bottleneck = l;
    }
  }
  return {
    months,
    durationMonths: months.length,
    bottleneck,
    finalWork: Object.fromEntries(plan.packages.map((p) => [p.id, progress[p.id] ?? 0])),
  };
}
