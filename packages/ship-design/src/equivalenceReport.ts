import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import type { CompiledDesign } from "./compileShared.js";
import type { CandidateDesign, EntryDetail, EquivalenceDesign } from "./equivalenceCandidate.js";
import { UNORDERED_METRIC_PATHS, sortMap } from "./equivalenceMetrics.js";
import type { MetricMap, MetricValue } from "./equivalenceMetrics.js";
import type { FitStatus } from "./partFitTypes.js";

export const EQUIVALENCE_REPORT_SCHEMA = "ship-part-migration-equivalence/1";

export type RowStatus = "equal" | "withinTolerance" | "orderingOnly" | "reclassified" | "changed";

export const RECLASSIFICATION_REASON = "DQ-ARMAMENT-001";

export interface Reclassification {
  readonly reason: string;
  readonly design: string;
  readonly placement: string;
  readonly oldValue: MetricValue;
  readonly newValue: MetricValue;
}

export interface MetricRow {
  readonly path: string;
  readonly baseline: MetricValue;
  readonly candidate: MetricValue;
  readonly delta: number | null;
  readonly tolerance: number;
  readonly status: RowStatus;
  readonly reclassification?: Reclassification;
}

export interface ToleranceManifest {
  readonly version: string;
  readonly integerTolerance: number;
  readonly byPathPrefix: Readonly<Record<string, number>>;
}

export const TOLERANCE_MANIFEST: ToleranceManifest = {
  version: "1",
  integerTolerance: 0,
  byPathPrefix: {},
};

export const D18_RECLASSIFIED_PLACEMENTS: readonly string[] = [
  "kaiser_1875:main_aft",
  "kaiser_1875:main_fwd",
  "mesudiye_1875:main_aft",
  "mesudiye_1875:main_fwd",
  "mesudiye_1875:sec",
  "redoutable_1878:main_aft",
  "redoutable_1878:main_fwd",
  "sachsen_1878:main_aft",
  "sachsen_1878:main_fwd",
];

export const D18_IDENTITY_FIELDS: Readonly<Record<string, string | null>> = {
  mountType: "BROADSIDE_BATTERY",
  mountId: null,
};

export interface Coverage {
  readonly designs: number;
  readonly placements: number;
  readonly gunPlacements: number;
  readonly tubePlacements: number;
  readonly fittingPlacements: number;
}

export const PINNED_COVERAGE: Coverage = {
  designs: 93,
  placements: 836,
  gunPlacements: 233,
  tubePlacements: 30,
  fittingPlacements: 573,
};

export interface DataQualityInventory {
  readonly centralBatteryPlacements: number;
  readonly launcherVariants: number;
  readonly waivedLauncherRecords: number;
  readonly torpedoEntriesAffected: number;
}

export const PINNED_DATA_QUALITY: DataQualityInventory = {
  centralBatteryPlacements: 9,
  launcherVariants: 17,
  waivedLauncherRecords: 5,
  torpedoEntriesAffected: 9,
};

export interface InheritedFinding {
  readonly code: "DQ-TORPEDO-001" | "DQ-ARMAMENT-001";
  readonly design: string;
  readonly entry: string;
  readonly detail: string;
  readonly status: "inherited";
}

export interface LauncherRecord {
  readonly id: string;
  readonly variant: boolean;
  readonly waived: boolean;
}

export interface DesignFitReport {
  readonly status: FitStatus | "NOT_TRANSLATED";
  readonly findingCodes: readonly string[];
  readonly dataIssueCodes: readonly string[];
  readonly waivers: readonly { readonly path: string; readonly code: string }[];
  readonly unresolved: readonly {
    readonly code: string;
    readonly path: string;
    readonly candidates: readonly string[];
  }[];
  readonly untranslated: readonly { readonly instanceId: string; readonly code: string }[];
}

export interface DesignReport {
  readonly designId: string;
  readonly fit: DesignFitReport;
  readonly compared: boolean;
  readonly rows: readonly MetricRow[];
  readonly entries: readonly EntryDetail[];
}

export interface EquivalenceReport {
  readonly schema: typeof EQUIVALENCE_REPORT_SCHEMA;
  readonly pipelines: {
    readonly baseline: { readonly id: string; readonly contentHash: string };
    readonly candidate: { readonly id: string; readonly contentHash: string };
  };
  readonly tolerance: ToleranceManifest;
  readonly coverage: {
    readonly pinned: Coverage;
    readonly baseline: Coverage;
    readonly candidate: Coverage;
  };
  readonly summary: {
    readonly rows: Readonly<Record<RowStatus, number>>;
    readonly designs: Readonly<Record<string, number>>;
  };
  readonly designs: readonly DesignReport[];
  readonly dataQuality: {
    readonly waivers: readonly {
      readonly design: string;
      readonly path: string;
      readonly code: string;
    }[];
    readonly unresolvedGunPlacements: readonly {
      readonly design: string;
      readonly placement: string;
      readonly code: string;
    }[];
    readonly unresolvedMagazineRelationships: readonly {
      readonly design: string;
      readonly code: string;
      readonly path: string;
      readonly candidates: readonly string[];
    }[];
    readonly inherited: readonly InheritedFinding[];
    readonly inventory: {
      readonly pinned: DataQualityInventory;
      readonly observed: DataQualityInventory;
    };
  };
}

const IDENTITY_PATH =
  /^(?:entries\[(?<a>[^\]]+)\]|(?:components\[(?<b>[^\]]+)\]\.armament|engine\.armament\[(?<c>[^\]]+)\]))\.(?<field>mountType|mountId)$/;

export function d18IdentityPath(path: string): { placement: string; field: string } | null {
  const m = IDENTITY_PATH.exec(path);
  const g = m?.groups;
  if (g === undefined) return null;
  const placement = g["a"] ?? g["b"] ?? g["c"];
  const field = g["field"];
  return placement === undefined || field === undefined ? null : { placement, field };
}

const toleranceFor = (path: string, m: ToleranceManifest): number => {
  let best = -1;
  let tol = m.integerTolerance;
  for (const [prefix, value] of Object.entries(m.byPathPrefix)) {
    if (path.startsWith(prefix) && prefix.length > best) {
      best = prefix.length;
      tol = value;
    }
  }
  return tol;
};

export interface CompareInput {
  readonly designId: string;
  readonly baseline: MetricMap;
  readonly candidate: MetricMap;
  readonly tolerance?: ToleranceManifest;
}

export function compareMetrics(input: CompareInput): MetricRow[] {
  const manifest = input.tolerance ?? TOLERANCE_MANIFEST;
  const paths = [
    ...new Set([...Object.keys(input.baseline), ...Object.keys(input.candidate)]),
  ].sort(compareCodePoints);
  const get = (map: MetricMap, path: string): MetricValue => map[path] ?? null;
  const multisetEqual = paths
    .filter((p) => p.startsWith("findings.multiset["))
    .every((p) => get(input.baseline, p) === get(input.candidate, p));
  return paths.map((path): MetricRow => {
    const baseline = get(input.baseline, path);
    const candidate = get(input.candidate, path);
    const tolerance = toleranceFor(path, manifest);
    const delta =
      typeof baseline === "number" && typeof candidate === "number" ? candidate - baseline : null;
    const row = (status: RowStatus, extra: Partial<MetricRow> = {}): MetricRow => ({
      path,
      baseline,
      candidate,
      delta,
      tolerance,
      status,
      ...extra,
    });
    if (baseline === candidate) return row("equal");
    if (delta !== null && Math.abs(delta) <= tolerance) return row("withinTolerance");
    if (UNORDERED_METRIC_PATHS.includes(path) && multisetEqual) return row("orderingOnly");
    const id = d18IdentityPath(path);
    if (
      id !== null &&
      typeof baseline === "string" &&
      typeof candidate === "string" &&
      D18_RECLASSIFIED_PLACEMENTS.includes(`${input.designId}:${id.placement}`) &&
      (D18_IDENTITY_FIELDS[id.field] ?? candidate) === candidate
    ) {
      return row("reclassified", {
        reclassification: {
          reason: RECLASSIFICATION_REASON,
          design: input.designId,
          placement: id.placement,
          oldValue: baseline,
          newValue: candidate,
        },
      });
    }
    return row("changed");
  });
}

const legacyUnitsOf = (design: EquivalenceDesign, instanceId: string, kind: string) => {
  const placement = design.draft.placements.find((p) => p.instanceId === instanceId);
  return kind === "gun"
    ? (placement?.params?.["barrels"] ?? 1)
    : (placement?.params?.["tubes"] ?? 1);
};

export function entryMetrics(
  design: EquivalenceDesign,
  baseline: CompiledDesign,
  entries: readonly EntryDetail[],
): { baseline: MetricMap; candidate: MetricMap } {
  const b: Record<string, MetricValue> = {};
  const c: Record<string, MetricValue> = {};
  for (const e of entries) {
    const p = `entries[${e.instanceId}]`;
    const summary = baseline.components.find((s) => s.instanceId === e.instanceId);
    b[`${p}.massKg`] = summary?.weightKg ?? null;
    c[`${p}.massKg`] = e.totals.massKg;
    b[`${p}.costMicro`] = summary?.costMicro ?? null;
    c[`${p}.costMicro`] = e.totals.costMicro;
    if (e.kind === "fitting") continue;
    b[`${p}.units`] = legacyUnitsOf(design, e.instanceId, e.kind);
    c[`${p}.units`] = e.containedUnits;
    if (e.kind === "gun") {
      b[`${p}.mountType`] = e.legacyMountType;
      c[`${p}.mountType`] = e.mountType;
      b[`${p}.mountId`] = e.legacyMountId;
      c[`${p}.mountId`] = e.mountId;
    }
  }
  return { baseline: sortMap(b), candidate: sortMap(c) };
}

export interface DesignComparison {
  readonly design: EquivalenceDesign;
  readonly baseline: { readonly compiled: CompiledDesign; readonly metrics: MetricMap };
  readonly candidate: CandidateDesign;
  readonly candidateMetrics: MetricMap | null;
  readonly baselineCoverage: Omit<Coverage, "designs">;
}

const emptyRows = (): Record<RowStatus, number> => ({
  equal: 0,
  withinTolerance: 0,
  orderingOnly: 0,
  reclassified: 0,
  changed: 0,
});

export function buildEquivalenceReport(input: {
  readonly comparisons: readonly DesignComparison[];
  readonly baselinePipeline: { readonly id: string; readonly contentHash: string };
  readonly candidatePipeline: { readonly id: string; readonly contentHash: string };
  readonly tolerance?: ToleranceManifest;
  readonly launchers?: readonly LauncherRecord[];
}): EquivalenceReport {
  const tolerance = input.tolerance ?? TOLERANCE_MANIFEST;
  const sorted = [...input.comparisons].sort((a, b) => compareCodePoints(a.design.id, b.design.id));
  const summaryRows = emptyRows();
  const summaryDesigns: Record<string, number> = {};
  const waivers: EquivalenceReport["dataQuality"]["waivers"][number][] = [];
  const unresolvedGuns: EquivalenceReport["dataQuality"]["unresolvedGunPlacements"][number][] = [];
  const magazines: EquivalenceReport["dataQuality"]["unresolvedMagazineRelationships"][number][] =
    [];
  const baselineCoverage = {
    designs: 0,
    placements: 0,
    gunPlacements: 0,
    tubePlacements: 0,
    fittingPlacements: 0,
  };
  const candidateCoverage = { ...baselineCoverage };

  const inherited: InheritedFinding[] = [];
  const waivedLauncher = new Map(
    (input.launchers ?? []).filter((l) => l.waived).map((l) => [l.id, l]),
  );
  const designs: DesignReport[] = sorted.map((cmp): DesignReport => {
    const id = cmp.design.id;
    const { candidate } = cmp;
    baselineCoverage.designs += 1;
    baselineCoverage.placements += cmp.baselineCoverage.placements;
    baselineCoverage.gunPlacements += cmp.baselineCoverage.gunPlacements;
    baselineCoverage.tubePlacements += cmp.baselineCoverage.tubePlacements;
    baselineCoverage.fittingPlacements += cmp.baselineCoverage.fittingPlacements;
    const kinds = (k: string) => candidate.entries.filter((e) => e.kind === k).length;
    if (candidate.fit !== null) candidateCoverage.designs += 1;
    candidateCoverage.placements += candidate.entries.length;
    candidateCoverage.gunPlacements += kinds("gun");
    candidateCoverage.tubePlacements += kinds("tube");
    candidateCoverage.fittingPlacements += kinds("fitting");

    const fit = candidate.fit;
    const fitReport: DesignFitReport = {
      status: fit?.status ?? "NOT_TRANSLATED",
      findingCodes: (fit?.findings ?? []).map((f) => f.code),
      dataIssueCodes: (fit?.dataIssues ?? []).map((f) => f.code),
      waivers: (fit?.waivers ?? []).map((w) => ({ path: w.path, code: w.code })),
      unresolved: (fit?.unresolved ?? []).map((u) => ({
        code: u.code,
        path: u.path,
        candidates: u.candidates,
      })),
      untranslated: candidate.untranslated.map((u) => ({
        instanceId: u.instanceId,
        code: u.code,
      })),
    };
    for (const w of fitReport.waivers) waivers.push({ design: id, ...w });
    for (const u of fitReport.unresolved) magazines.push({ design: id, ...u });
    for (const u of candidate.unresolvedGuns) {
      unresolvedGuns.push({ design: id, placement: u.instanceId, code: u.code });
    }
    for (const e of candidate.entries) {
      const waived = e.kind === "tube" ? e.parts.find((p) => waivedLauncher.has(p)) : undefined;
      if (waived !== undefined) {
        inherited.push({
          code: "DQ-TORPEDO-001",
          design: id,
          entry: e.instanceId,
          detail: `launcher ${waived} (${e.legacyComponentId})`,
          status: "inherited",
        });
      }
      if (e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY") {
        inherited.push({
          code: "DQ-ARMAMENT-001",
          design: id,
          entry: e.instanceId,
          detail: `legacy ${String(e.legacyMountType)} → ${String(e.mountType)}`,
          status: "inherited",
        });
      }
    }
    summaryDesigns[fitReport.status] = (summaryDesigns[fitReport.status] ?? 0) + 1;

    const compared = candidate.compiled !== null && cmp.candidateMetrics !== null;
    let rows: MetricRow[] = [];
    if (compared && cmp.candidateMetrics !== null) {
      const entry = entryMetrics(cmp.design, cmp.baseline.compiled, candidate.entries);
      rows = compareMetrics({
        designId: id,
        tolerance,
        baseline: sortMap({ ...cmp.baseline.metrics, ...entry.baseline }),
        candidate: sortMap({ ...cmp.candidateMetrics, ...entry.candidate }),
      });
      for (const r of rows) summaryRows[r.status] += 1;
    }
    return { designId: id, fit: fitReport, compared, rows, entries: candidate.entries };
  });

  return {
    schema: EQUIVALENCE_REPORT_SCHEMA,
    pipelines: { baseline: input.baselinePipeline, candidate: input.candidatePipeline },
    tolerance,
    coverage: { pinned: PINNED_COVERAGE, baseline: baselineCoverage, candidate: candidateCoverage },
    summary: { rows: summaryRows, designs: summaryDesigns },
    designs,
    dataQuality: {
      waivers,
      unresolvedGunPlacements: unresolvedGuns,
      unresolvedMagazineRelationships: magazines,
      inherited,
      inventory: {
        pinned: PINNED_DATA_QUALITY,
        observed: {
          centralBatteryPlacements: inherited.filter((f) => f.code === "DQ-ARMAMENT-001").length,
          launcherVariants: (input.launchers ?? []).filter((l) => l.variant).length,
          waivedLauncherRecords: waivedLauncher.size,
          torpedoEntriesAffected: inherited.filter((f) => f.code === "DQ-TORPEDO-001").length,
        },
      },
    },
  };
}

export interface GateFailure {
  readonly gate: "structural" | "semantic";
  readonly code: string;
  readonly design?: string;
  readonly path?: string;
  readonly message: string;
}

const COVERAGE_KEYS = [
  "designs",
  "placements",
  "gunPlacements",
  "tubePlacements",
  "fittingPlacements",
] as const;

export function structuralGate(report: EquivalenceReport): GateFailure[] {
  const failures: GateFailure[] = [];
  const { baseline, candidate, pinned } = report.coverage;
  for (const key of COVERAGE_KEYS) {
    if (baseline[key] !== candidate[key]) {
      failures.push({
        gate: "structural",
        code: "COVERAGE_MISMATCH",
        path: `coverage.${key}`,
        message: `baseline covers ${baseline[key]} ${key}, candidate ${candidate[key]}`,
      });
    }
    if (baseline[key] !== pinned[key]) {
      failures.push({
        gate: "structural",
        code: "COVERAGE_NOT_PINNED",
        path: `coverage.${key}`,
        message: `${key}: ${baseline[key]} compared, ${pinned[key]} pinned`,
      });
    }
  }
  const { pinned: dqPinned, observed: dqObserved } = report.dataQuality.inventory;
  for (const key of Object.keys(dqPinned) as (keyof DataQualityInventory)[]) {
    if (dqObserved[key] !== dqPinned[key]) {
      failures.push({
        gate: "structural",
        code: "DATA_QUALITY_NOT_PINNED",
        path: `dataQuality.inventory.${key}`,
        message: `${key}: ${dqObserved[key]} observed, ${dqPinned[key]} pinned`,
      });
    }
  }
  for (const d of report.designs) {
    if (!d.compared) {
      failures.push({
        gate: "structural",
        code: "DESIGN_NOT_COMPARED",
        design: d.designId,
        message: `fit ${d.fit.status}: derivation was withheld, so nothing was compared`,
      });
    }
  }
  return failures;
}

const valueEqual = (a: MetricValue, b: MetricValue): boolean => a === b;

export function semanticGate(report: EquivalenceReport): GateFailure[] {
  const failures: GateFailure[] = [];
  const fail = (code: string, design: string, path: string, message: string) =>
    failures.push({ gate: "semantic", code, design, path, message });
  for (const d of report.designs) {
    for (const row of d.rows) {
      const where = [d.designId, row.path] as const;
      switch (row.status) {
        case "changed":
          fail("CHANGED_ROW", ...where, `${String(row.baseline)} → ${String(row.candidate)}`);
          break;
        case "equal":
          if (!valueEqual(row.baseline, row.candidate)) {
            fail("STATUS_INCONSISTENT", ...where, "an 'equal' row has different values");
          }
          break;
        case "withinTolerance":
          if (row.delta === null || Math.abs(row.delta) > row.tolerance) {
            fail("STATUS_INCONSISTENT", ...where, "a 'withinTolerance' row exceeds its tolerance");
          }
          break;
        case "orderingOnly":
          if (!UNORDERED_METRIC_PATHS.includes(row.path)) {
            fail(
              "ORDERING_ONLY_UNDECLARED_PATH",
              ...where,
              "path is not a declared unordered path",
            );
          }
          break;
        case "reclassified": {
          const id = d18IdentityPath(row.path);
          const r = row.reclassification;
          if (typeof row.baseline === "number" || typeof row.candidate === "number") {
            fail("RECLASSIFIED_ON_NUMBER", ...where, "a number is never reclassified");
          } else if (
            id === null ||
            !D18_RECLASSIFIED_PLACEMENTS.includes(`${d.designId}:${id.placement}`)
          ) {
            fail("RECLASSIFIED_OFF_D18_PATH", ...where, "not an enumerated D18 identity path");
          } else if (
            r === undefined ||
            r.reason !== RECLASSIFICATION_REASON ||
            r.design !== d.designId ||
            r.placement !== id.placement ||
            r.oldValue !== row.baseline ||
            r.newValue !== row.candidate
          ) {
            fail(
              "RECLASSIFIED_INCOMPLETE",
              ...where,
              `needs old value, new value, design, placement and ${RECLASSIFICATION_REASON}`,
            );
          }
          break;
        }
      }
    }
    for (const e of d.entries) {
      if (e.kind === "tube" && e.mountCount !== e.legacyUnits) {
        fail(
          "TORPEDO_MOUNT_COUNT_MISMATCH",
          d.designId,
          `entries[${e.instanceId}]`,
          `mountCount ${e.mountCount} ≠ legacy tubes ${String(e.legacyUnits)}`,
        );
      }
      if (e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY") {
        const fixed = e.quantities.find(
          (q) => q.kind === "massKg" && q.basis === "PER_LOADOUT_ENTRY" && q.scope === "mount",
        );
        const where = `entries[${e.instanceId}]`;
        if (e.mountCount !== 1 || e.gunsPerMount !== e.legacyUnits) {
          fail(
            "D17_BARREL_EQUALITY",
            d.designId,
            where,
            `mountCount ${e.mountCount} × gunsPerMount ${String(e.gunsPerMount)} ≠ legacy barrels ${String(e.legacyUnits)}`,
          );
        }
        if (
          fixed === undefined ||
          e.legacyFixedInstallationKg === null ||
          fixed.contribution !== e.legacyFixedInstallationKg
        ) {
          fail(
            "D17_FIXED_INSTALLATION",
            d.designId,
            where,
            `translated PER_LOADOUT_ENTRY installation ${String(fixed?.contribution)} ≠ legacy ${String(e.legacyFixedInstallationKg)}`,
          );
        }
      }
      if (e.kind === "gun" && e.containedUnits !== e.legacyUnits) {
        fail(
          "GUN_BARREL_COUNT_MISMATCH",
          d.designId,
          `entries[${e.instanceId}]`,
          `contained units ${String(e.containedUnits)} ≠ legacy barrels ${String(e.legacyUnits)}`,
        );
      }
    }
  }
  return failures;
}

export interface GateResult {
  readonly ok: boolean;
  readonly structural: readonly GateFailure[];
  readonly semantic: readonly GateFailure[];
}

export function checkEquivalenceReport(report: EquivalenceReport): GateResult {
  const structural = structuralGate(report);
  const semantic = semanticGate(report);
  return { ok: structural.length === 0 && semantic.length === 0, structural, semantic };
}

export const serializeEquivalenceReport = (report: EquivalenceReport): string =>
  canonicalSerialize(report);
