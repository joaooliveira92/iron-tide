export type Severity = "BLOCKING" | "CRITICAL" | "WARNING" | "ADVISORY";

export const SEVERITY_ORDER: readonly Severity[] = ["BLOCKING", "CRITICAL", "WARNING", "ADVISORY"];

export interface Remedy {
  readonly id: string;
  readonly description: string;
  /** Optional machine-readable edit the UI can apply; opaque to this package. */
  readonly edit?: Readonly<Record<string, unknown>>;
}

/**
 * What a finding is about, as structured data the producer already holds (never parsed from its wording).
 * Machinery rooms have no id in the design, so they are named by their position in `machinery.rooms`.
 */
export type FindingTarget =
  | { readonly kind: "ship" }
  | { readonly kind: "zone"; readonly zoneId: string }
  | { readonly kind: "placement"; readonly instanceId: string }
  /** A battery by its `batterySummary` key (role and calibre). */
  | { readonly kind: "battery"; readonly key: string }
  | { readonly kind: "machinery-room"; readonly index: number };

/** The design settings a finding's failing value is set in; the UI maps each to its controls. */
export const SETTING_GROUPS = ["brief", "hull", "machinery", "armour", "arrangement"] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export interface FindingSubject {
  readonly targets: readonly FindingTarget[];
  /** Where the failing value is set; absent when no single group of settings fixes it. */
  readonly settings?: SettingGroup;
  /** Whether `evidence.threshold` is a minimum the value must reach or a maximum it must not exceed. */
  readonly bound?: "min" | "max";
  /** Unit of `evidence.value` and `evidence.threshold`, when they have one. */
  readonly unit?: string;
}

export interface Finding {
  /** The rule code; repeated when a rule fails for several entities (see `findingKey`). */
  readonly id: string;
  readonly severity: Severity;
  /** What failed. */
  readonly what: string;
  /** Why: the computed values that caused it. */
  readonly why: string;
  /** Probable gameplay consequence. */
  readonly consequence: string;
  readonly remedies: readonly Remedy[];
  readonly evidence: {
    readonly formulaId: string;
    readonly inputs: Readonly<Record<string, number>>;
    readonly threshold: number;
    readonly value: number;
  };
  /**
   * Machine-readable rule parameters (e.g. armament ids and values), when a rule carries structured data
   * that does not fit the numeric `evidence.inputs`. Part of the finding identity surface; absent for most rules.
   */
  readonly parameters?: Readonly<Record<string, string | number | boolean>>;
  /**
   * Structured subject (targets, settings, bound, unit). Presentation metadata: excluded from the compiled
   * design's hash (`withoutSubjects`), so adding or refining it never changes a design's identity.
   */
  readonly subject?: FindingSubject;
}

export const shipTarget: FindingTarget = { kind: "ship" };
export const placementTarget = (instanceId: string): FindingTarget => ({
  kind: "placement",
  instanceId,
});
export const zoneTarget = (zoneId: string): FindingTarget => ({ kind: "zone", zoneId });

/** The finding with these targets (keeping any settings, bound or unit already on its subject). */
export function about(f: Finding, ...targets: FindingTarget[]): Finding {
  return { ...f, subject: { ...f.subject, targets } };
}

function targetKey(t: FindingTarget): string {
  switch (t.kind) {
    case "ship":
      return "ship";
    case "zone":
      return `zone:${t.zoneId}`;
    case "placement":
      return `placement:${t.instanceId}`;
    case "battery":
      return `battery:${t.key}`;
    case "machinery-room":
      return `room:${t.index}`;
  }
}

/**
 * Stable identity of a finding across recompiles: the rule code and its sorted targets, never its wording or
 * values, so a finding whose numbers or severity change is still the same finding.
 */
export function findingKey(f: Finding): string {
  const targets = (f.subject?.targets ?? []).map(targetKey).sort();
  return `${f.id}|${targets.join(",")}`;
}

/** Deep copy of a compile result with every finding's `subject` removed: what the design hash covers. */
export function withoutSubjects<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutSubjects) as T;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const isFinding = "severity" in o && "evidence" in o;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o))
      if (!(isFinding && k === "subject")) out[k] = withoutSubjects(v);
    return out as T;
  }
  return value;
}

const MIN_REMEDIES: Record<Severity, number> = {
  BLOCKING: 3,
  CRITICAL: 2,
  WARNING: 2,
  ADVISORY: 0,
};

/** Returns problems with a finding's shape (spec §14.1). Empty = well-formed. */
export function checkFindingShape(f: Finding): string[] {
  const problems: string[] = [];
  if (f.what.trim() === "") problems.push("what is empty");
  if (f.why.trim() === "") problems.push("why is empty");
  if (f.consequence.trim() === "") problems.push("consequence is empty");
  if (f.remedies.length < MIN_REMEDIES[f.severity]) {
    problems.push(`${f.severity} requires >= ${MIN_REMEDIES[f.severity]} remedies`);
  }
  return problems;
}

/** Deterministic order: severity, then id, then evidence formula id. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
      (a.evidence.formulaId < b.evidence.formulaId
        ? -1
        : a.evidence.formulaId > b.evidence.formulaId
          ? 1
          : 0),
  );
}

export const hasBlocking = (findings: readonly Finding[]): boolean =>
  findings.some((f) => f.severity === "BLOCKING");
