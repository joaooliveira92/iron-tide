export const ARMAMENT_FINDING_SEVERITIES = ["BLOCKING", "WARNING", "ADVISORY"] as const;
export type ArmamentFindingSeverity = (typeof ARMAMENT_FINDING_SEVERITIES)[number];

export const ARMAMENT_SEVERITY_ORDER: readonly ArmamentFindingSeverity[] = [
  "BLOCKING",
  "WARNING",
  "ADVISORY",
];

export const ARMAMENT_FINDING_CODES = [
  "ARMAMENT_ID_INVALID",
  "ARMAMENT_ID_DUPLICATE",
  "ARMAMENT_MONTH_INVALID",
  "ARMAMENT_DATE_ORDER",
  "ARMAMENT_GUN_FAMILY_MISMATCH",
  "ARMAMENT_MOUNT_NOT_SUPPORTED",
  "ARMAMENT_AMMUNITION_INCOMPATIBLE",
  "ARMAMENT_BEFORE_INTRODUCTION",
  "ARMAMENT_AFTER_RETIREMENT",
  "ARMAMENT_TECHNOLOGY_MISSING",
  "ARMAMENT_ACCESS_UNAVAILABLE",
  "ARMAMENT_ACCESS_FOREIGN",
  "ARMAMENT_ACCESS_CONTRADICTION",
  "ARMAMENT_VALUE_OUT_OF_RANGE",
  "ARMAMENT_PROVENANCE_PLACEHOLDER",
  "ARMAMENT_PROVENANCE_MISSING",
  "ARMAMENT_REFERENCE_MISSING",
  "ARMAMENT_DUPLICATE_CONTRADICTORY",
  "ARMAMENT_NATION_UNKNOWN",
  "ARMAMENT_PROVENANCE_INCONSISTENT",
  "ARMAMENT_COMPAT_DRIFT",
] as const;
export type ArmamentFindingCode = (typeof ARMAMENT_FINDING_CODES)[number];

export const ARMAMENT_ENTITY_KINDS = [
  "armament",
  "gunFamily",
  "gunModel",
  "gunMount",
  "ammunition",
] as const;
export type ArmamentEntityKind = (typeof ARMAMENT_ENTITY_KINDS)[number];

export interface ArmamentEntityRef {
  readonly kind: ArmamentEntityKind;
  readonly id: string;
}

export type ArmamentParameterValue = string | number | boolean;

export interface ArmamentResolutionFinding {
  readonly severity: ArmamentFindingSeverity;
  readonly code: ArmamentFindingCode;
  readonly entity: ArmamentEntityRef;
  readonly field: string;
  readonly parameters: Readonly<Record<string, ArmamentParameterValue>>;
  readonly message: string;
}

const entityKey = (e: ArmamentEntityRef): string => `${e.kind}:${e.id}`;

const parameterKey = (p: Readonly<Record<string, ArmamentParameterValue>>): string =>
  Object.keys(p)
    .sort()
    .map((k) => `${k}=${String(p[k])}`)
    .join("|");

export function sortArmamentFindings(
  findings: readonly ArmamentResolutionFinding[],
): ArmamentResolutionFinding[] {
  return [...findings].sort(
    (a, b) =>
      ARMAMENT_SEVERITY_ORDER.indexOf(a.severity) - ARMAMENT_SEVERITY_ORDER.indexOf(b.severity) ||
      (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) ||
      (entityKey(a.entity) < entityKey(b.entity)
        ? -1
        : entityKey(a.entity) > entityKey(b.entity)
          ? 1
          : 0) ||
      (a.field < b.field ? -1 : a.field > b.field ? 1 : 0) ||
      (parameterKey(a.parameters) < parameterKey(b.parameters)
        ? -1
        : parameterKey(a.parameters) > parameterKey(b.parameters)
          ? 1
          : 0),
  );
}
