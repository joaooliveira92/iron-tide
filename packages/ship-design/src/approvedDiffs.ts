import type { EquivalenceReport, MetricRow } from "./equivalenceReport.js";
import { checkEquivalenceReport } from "./equivalenceReport.js";
import type { GateFailure } from "./equivalenceReport.js";
import type { MetricValue } from "./equivalenceMetrics.js";

export const APPROVED_DIFFS_SCHEMA = "ship-part-approved-diffs/1";

export const DIFFERENCE_CLASSES = [
  "AUTHORED_SLOT",
  "BASIS_CHANGE",
  "DATA_QUALITY_CORRECTION",
] as const;
export type DifferenceClass = (typeof DIFFERENCE_CLASSES)[number];

export interface ApprovedDiff {
  readonly decisionId: string;
  readonly designId: string;
  readonly placementId: string;
  readonly fieldPath: string;
  readonly oldValue: MetricValue;
  readonly newValue: MetricValue;
  readonly differenceClass: DifferenceClass;
  readonly reason: string;
  readonly approvalReference: string;
  readonly expectedDelta?: number;
  readonly expectedReplacement?: number;
}

export interface ApprovedDiffsFile {
  readonly schema: typeof APPROVED_DIFFS_SCHEMA;
  readonly entries: readonly ApprovedDiff[];
}

export type DecodeResult =
  | { readonly ok: true; readonly value: ApprovedDiffsFile }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_STRINGS = [
  "decisionId",
  "designId",
  "placementId",
  "fieldPath",
  "differenceClass",
  "reason",
  "approvalReference",
] as const;
const KNOWN_KEYS = new Set<string>([
  ...REQUIRED_STRINGS,
  "oldValue",
  "newValue",
  "expectedDelta",
  "expectedReplacement",
]);
const PATTERN_CHARS = /[*?{}()|+^$\\]/;
const BROAD_WORDS = /^\s*(all|every|any|whole|entire|design|placement)\b/i;
const BROAD_REASON = /\b(all|every|any)\b[^.]*\b(changes?|diffs?|differences?)\b/i;

export const readsAsBroadApproval = (text: string): boolean =>
  PATTERN_CHARS.test(text) || BROAD_REASON.test(text);

const isMetricValue = (v: unknown): v is MetricValue =>
  v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));

function decodeEntry(raw: unknown, at: string, errors: string[]): ApprovedDiff | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    errors.push(`${at}: an entry must be an object`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const before = errors.length;
  for (const key of Object.keys(o)) {
    if (!KNOWN_KEYS.has(key)) errors.push(`${at}: unknown field '${key}'`);
  }
  for (const key of REQUIRED_STRINGS) {
    const v = o[key];
    if (typeof v !== "string" || v.trim() === "") errors.push(`${at}: '${key}' is required`);
  }
  for (const key of ["oldValue", "newValue"] as const) {
    if (!(key in o) || !isMetricValue(o[key])) {
      errors.push(`${at}: '${key}' is required (a string, a finite number or null)`);
    }
  }
  for (const key of ["designId", "placementId", "fieldPath"] as const) {
    const v = o[key];
    if (typeof v !== "string") continue;
    if (PATTERN_CHARS.test(v)) errors.push(`${at}: '${key}' may not be a wildcard or pattern`);
    if (BROAD_WORDS.test(v)) errors.push(`${at}: '${key}' may not approve a broad set`);
  }
  for (const key of ["decisionId", "reason", "approvalReference"] as const) {
    const v = o[key];
    if (typeof v === "string" && readsAsBroadApproval(v)) {
      errors.push(`${at}: '${key}' reads as a broad approval`);
    }
  }
  if (
    typeof o["differenceClass"] === "string" &&
    !(DIFFERENCE_CLASSES as readonly string[]).includes(o["differenceClass"])
  ) {
    errors.push(`${at}: unknown differenceClass '${o["differenceClass"]}'`);
  }
  if (
    typeof o["fieldPath"] === "string" &&
    typeof o["designId"] === "string" &&
    (o["fieldPath"] === "" ||
      o["fieldPath"] === o["designId"] ||
      o["fieldPath"] === o["placementId"])
  ) {
    errors.push(`${at}: 'fieldPath' must name one metric, not a design or placement`);
  }
  const numeric = typeof o["oldValue"] === "number" || typeof o["newValue"] === "number";
  const delta = o["expectedDelta"];
  const replacement = o["expectedReplacement"];
  if (delta !== undefined && (typeof delta !== "number" || !Number.isFinite(delta))) {
    errors.push(`${at}: 'expectedDelta' must be a finite number`);
  }
  if (
    replacement !== undefined &&
    (typeof replacement !== "number" || !Number.isFinite(replacement))
  ) {
    errors.push(`${at}: 'expectedReplacement' must be a finite number`);
  }
  if (numeric) {
    if (typeof o["oldValue"] !== "number" || typeof o["newValue"] !== "number") {
      errors.push(`${at}: a numeric entry needs numeric oldValue and newValue`);
    } else {
      if (delta === undefined && replacement === undefined) {
        errors.push(`${at}: a numeric entry needs expectedDelta or expectedReplacement`);
      }
      if (typeof delta === "number" && delta !== o["newValue"] - o["oldValue"]) {
        errors.push(`${at}: expectedDelta ${delta} ≠ newValue − oldValue`);
      }
      if (typeof replacement === "number" && replacement !== o["newValue"]) {
        errors.push(`${at}: expectedReplacement ${replacement} ≠ newValue`);
      }
    }
  } else if (delta !== undefined || replacement !== undefined) {
    errors.push(`${at}: expectedDelta/expectedReplacement apply to numeric entries only`);
  }
  if (errors.length > before) return null;
  const str = (key: (typeof REQUIRED_STRINGS)[number]): string => String(o[key]);
  const metric = (key: "oldValue" | "newValue"): MetricValue => {
    const v = o[key];
    return isMetricValue(v) ? v : null;
  };
  return {
    decisionId: str("decisionId"),
    designId: str("designId"),
    placementId: str("placementId"),
    fieldPath: str("fieldPath"),
    oldValue: metric("oldValue"),
    newValue: metric("newValue"),
    differenceClass: DIFFERENCE_CLASSES.find((c) => c === o["differenceClass"]) ?? "BASIS_CHANGE",
    reason: str("reason"),
    approvalReference: str("approvalReference"),
    ...(typeof delta === "number" ? { expectedDelta: delta } : {}),
    ...(typeof replacement === "number" ? { expectedReplacement: replacement } : {}),
  };
}

export function decodeApprovedDiffs(raw: unknown): DecodeResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["approved diffs: the file must be an object"] };
  }
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (key !== "schema" && key !== "entries")
      errors.push(`approved diffs: unknown field '${key}'`);
  }
  if (o["schema"] !== APPROVED_DIFFS_SCHEMA) {
    errors.push(`approved diffs: schema must be '${APPROVED_DIFFS_SCHEMA}'`);
  }
  const list = o["entries"];
  const entries: ApprovedDiff[] = [];
  if (!Array.isArray(list)) {
    errors.push("approved diffs: 'entries' must be an array");
  } else {
    list.forEach((item: unknown, i) => {
      const entry = decodeEntry(item, `entries[${i}]`, errors);
      if (entry !== null) entries.push(entry);
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { schema: APPROVED_DIFFS_SCHEMA, entries } };
}

const placementMatches = (row: MetricRow, entry: ApprovedDiff): boolean =>
  row.path.includes(`[${entry.placementId}]`) || row.path.startsWith(`${entry.placementId}.`);

export function approves(entry: ApprovedDiff, designId: string, row: MetricRow): boolean {
  if (row.status !== "changed") return false;
  if (entry.designId !== designId || entry.fieldPath !== row.path) return false;
  if (entry.oldValue !== row.baseline || entry.newValue !== row.candidate) return false;
  if (!placementMatches(row, entry)) return false;
  if (typeof row.baseline === "number" && typeof row.candidate === "number") {
    const delta = row.candidate - row.baseline;
    if (entry.expectedDelta !== undefined && entry.expectedDelta !== delta) return false;
    if (entry.expectedReplacement !== undefined && entry.expectedReplacement !== row.candidate) {
      return false;
    }
    if (entry.expectedDelta === undefined && entry.expectedReplacement === undefined) return false;
  }
  return true;
}

export interface ApprovedGateResult {
  readonly ok: boolean;
  readonly failures: readonly GateFailure[];
  readonly applied: readonly ApprovedDiff[];
}

export function checkWithApprovedDiffs(
  report: EquivalenceReport,
  approved: ApprovedDiffsFile,
): ApprovedGateResult {
  const base = checkEquivalenceReport(report);
  const used = new Set<ApprovedDiff>();
  const failures: GateFailure[] = [...base.structural];
  for (const f of base.semantic) {
    if (f.code === "CHANGED_ROW" && f.design !== undefined && f.path !== undefined) {
      const design = report.designs.find((d) => d.designId === f.design);
      const row = design?.rows.find((r) => r.path === f.path && r.status === "changed");
      const match =
        row === undefined
          ? undefined
          : approved.entries.find((e) => approves(e, f.design ?? "", row));
      if (match !== undefined) {
        used.add(match);
        continue;
      }
    }
    failures.push(f);
  }
  for (const entry of approved.entries) {
    if (!used.has(entry)) {
      failures.push({
        gate: "semantic",
        code: "APPROVED_DIFF_STALE",
        design: entry.designId,
        path: entry.fieldPath,
        message: `${entry.decisionId} matches no changed row`,
      });
    }
  }
  return { ok: failures.length === 0, failures, applied: [...used] };
}
