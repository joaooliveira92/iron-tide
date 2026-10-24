import type { ComponentCategory } from "./component.js";
import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { CostBreakdown } from "./cost.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { toSafe } from "./units.js";
import { designInvariant } from "./errors.js";

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
  readonly componentCostPerWorkMicro: number;
  readonly lineByCategory: Readonly<Record<ComponentCategory, LineId | "fit_out">>;
  readonly fitOutHullShareBp: number;
  readonly launchHullShareBp: number;
  readonly trialsShareBp: number;
  readonly acceptanceShareBp: number;
  readonly firstOfClassWorkBp: number;
  readonly maxMonths: number;
  readonly buildMonthsByDisplacementT: LookupTable;
  readonly buildMonthsProvenance: readonly BuildTimeProvenance[];
  readonly buildTimeEraBp: LookupTable;
  readonly buildTimeEraProvenance: readonly BuildTimeProvenance[];
  readonly efficientIndustryBp: number;
  readonly accelerationTimeBp: number;
  readonly mothballedMaintenancePerMonthMicro: number;
  readonly preservationCostBp: number;
  readonly shipyardCapacityMultipleBp: number;
  readonly amcCapacityExemptionBp: number;
  readonly smallCorvetteMaxDisplacementKg: number;
}

export type BuildTimeSourceStatus = "VERIFIED" | "SECONDARY" | "ESTIMATE";

export function preservationCostPerMonthMicro(balance: ConstructionBalance): number {
  const base = balance.mothballedMaintenancePerMonthMicro;
  const bp = balance.preservationCostBp;
  if (!Number.isFinite(base) || !Number.isFinite(bp) || base <= 0 || bp <= 0) return 0;
  return Math.floor((base * bp) / 10_000);
}

export interface BuildTimeProvenance {
  readonly status: BuildTimeSourceStatus;
  readonly source: string;
}

export interface BuildTimeOptions {
  readonly month?: string | undefined;
  readonly industryBp?: number;
  readonly accelerated?: boolean;
}

function yearOf(month: string): number {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw designInvariant(`build time needs a YYYY-MM month, got '${month}'`);
  return Number(m[1]);
}

export function buildTimeEraBp(month: string, b: ConstructionBalance): number {
  return evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: yearOf(month) },
    tables: { t: b.buildTimeEraBp },
  });
}

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
    throw designInvariant(`${name} has ${prov.length} entries for ${points.length} table points`);
  }
  if (points.length === 0) throw designInvariant(`empty build-time table for ${name}`);
  for (const p of prov) {
    if (p.status !== "VERIFIED" && p.status !== "SECONDARY" && p.status !== "ESTIMATE") {
      throw designInvariant(`unknown build-time source status '${String(p.status)}'`);
    }
    if (p.source.trim() === "")
      throw designInvariant("build-time provenance needs a source citation");
  }
}

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

export function planConstruction(
  c: CompiledDesign,
  d: DesignDraft,
  _cost: CostBreakdown,
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
  readonly _tag = "ConstructionPlanError";
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
  readonly bottleneck: LineId | null;
  readonly finalWork: Readonly<Record<string, number>>;
}

export interface ScheduleInput {
  readonly capacity: Readonly<Record<LineId, number>>;
  readonly monthlyFundingMicro: number | null;
  readonly costPerWorkMicro: number;
}

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

export type PackageProgress = Readonly<Record<string, number>>;

export function emptyProgress(plan: ConstructionPlan): PackageProgress {
  return Object.fromEntries(plan.packages.map((p) => [p.id, 0]));
}

function allocationOrder(plan: ConstructionPlan): WorkPackage[] {
  return [...plan.packages].sort(
    (x, y) =>
      PACKAGE_ORDER.indexOf(x.kind) - PACKAGE_ORDER.indexOf(y.kind) || (x.id < y.id ? -1 : 1),
  );
}

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

export function isConstructionComplete(plan: ConstructionPlan, progress: PackageProgress): boolean {
  return plan.packages.every((p) => isPackageComplete(plan, progress, p.id));
}

export interface MonthAdvance {
  readonly progress: PackageProgress;
  readonly applied: Readonly<Record<string, number>>;
  readonly completed: readonly string[];
  readonly limitedLines: readonly LineId[];
}

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
