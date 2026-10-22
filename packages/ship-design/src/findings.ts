import { explanationIsEmpty, type ExplanationText } from "./explanation.js";

export type Severity = "BLOCKING" | "CRITICAL" | "WARNING" | "ADVISORY";

export const SEVERITY_ORDER: readonly Severity[] = ["BLOCKING", "CRITICAL", "WARNING", "ADVISORY"];

export interface Remedy {
  readonly id: string;
  readonly description: ExplanationText;
  readonly edit?: Readonly<Record<string, unknown>>;
}

export type FindingTarget =
  | { readonly kind: "ship" }
  | { readonly kind: "zone"; readonly zoneId: string }
  | { readonly kind: "placement"; readonly instanceId: string }
  | { readonly kind: "battery"; readonly key: string }
  | { readonly kind: "machinery-room"; readonly index: number };

export const SETTING_GROUPS = ["brief", "hull", "machinery", "armour", "arrangement"] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export interface FindingSubject {
  readonly targets: readonly FindingTarget[];
  readonly settings?: SettingGroup;
  readonly bound?: "min" | "max";
  readonly unit?: string;
}

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  readonly what: ExplanationText;
  readonly why: ExplanationText;
  readonly consequence: ExplanationText;
  readonly remedies: readonly Remedy[];
  readonly evidence: {
    readonly formulaId: string;
    readonly inputs: Readonly<Record<string, number>>;
    readonly threshold: number;
    readonly value: number;
  };
  readonly parameters?: Readonly<Record<string, string | number | boolean>>;
  readonly subject?: FindingSubject;
}

export const shipTarget: FindingTarget = { kind: "ship" };
export const placementTarget = (instanceId: string): FindingTarget => ({
  kind: "placement",
  instanceId,
});
export const zoneTarget = (zoneId: string): FindingTarget => ({ kind: "zone", zoneId });

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

export function findingKey(f: Finding): string {
  const targets = (f.subject?.targets ?? []).map(targetKey).sort();
  return `${f.id}|${targets.join(",")}`;
}

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

export function checkFindingShape(f: Finding): string[] {
  const problems: string[] = [];
  if (explanationIsEmpty(f.what)) problems.push("what is empty");
  if (explanationIsEmpty(f.why)) problems.push("why is empty");
  if (explanationIsEmpty(f.consequence)) problems.push("consequence is empty");
  if (f.remedies.length < MIN_REMEDIES[f.severity]) {
    problems.push(`${f.severity} requires >= ${MIN_REMEDIES[f.severity]} remedies`);
  }
  return problems;
}

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
