import { SafeInt } from "@bluewave/contracts";
import type { Diagnostic, DiagnosticCode } from "@bluewave/diagnostics";

export const SHIP_READINESS_STATES = [
  "ACTIVE",
  "RESERVE",
  "MOTHBALLED",
  "WORKING_UP",
  "REPAIR",
] as const;

export type ShipReadinessState = (typeof SHIP_READINESS_STATES)[number];

export const SHIP_READINESS_CODES = {
  unknownState: "CAMPAIGN-SHIP-READINESS" as DiagnosticCode,
  crewQuality: "CAMPAIGN-SHIP-CREW-QUALITY" as DiagnosticCode,
  repairMonths: "CAMPAIGN-SHIP-REPAIR-MONTHS" as DiagnosticCode,
  excessKey: "CAMPAIGN-SHIP-EXCESS-KEY" as DiagnosticCode,
} as const;

export const CREW_QUALITY_MIN = 0;
export const CREW_QUALITY_MAX = 100;

export const REPAIR_MONTHS_MAX = SafeInt(120);

export const ACTIVE_CREW_CEILING = SafeInt(100);
export const LAID_UP_CREW_CEILING = SafeInt(0);
export const WORKING_UP_CREW_CEILING = SafeInt(100);
export const RESERVE_CREW_CEILING = SafeInt(70);
export const MOTHBALLED_CREW_CEILING = SafeInt(30);
export const REPAIR_CREW_CEILING = SafeInt(100);

export const CREW_QUALITY_RAMP_PER_MONTH = SafeInt(5);
export const WORKING_UP_DECENT_THRESHOLD = SafeInt(60);

const CREW_CEILING_BY_STATE: Record<ShipReadinessState, SafeInt> = {
  ACTIVE: ACTIVE_CREW_CEILING,
  WORKING_UP: WORKING_UP_CREW_CEILING,
  RESERVE: RESERVE_CREW_CEILING,
  MOTHBALLED: MOTHBALLED_CREW_CEILING,
  REPAIR: REPAIR_CREW_CEILING,
};

export function crewCeilingFor(readiness: ShipReadinessState): SafeInt {
  return CREW_CEILING_BY_STATE[readiness];
}

export function rampCrewQuality(current: SafeInt, readiness: ShipReadinessState): SafeInt {
  const ceiling = crewCeilingFor(readiness);
  if (current < ceiling) {
    const next = SafeInt.add(current, CREW_QUALITY_RAMP_PER_MONTH);
    return next > ceiling ? ceiling : next;
  }
  if (current > ceiling) {
    const next = SafeInt.sub(current, CREW_QUALITY_RAMP_PER_MONTH);
    return next < ceiling ? ceiling : next;
  }
  return current;
}

export function reduceCrewQuality(current: SafeInt, points: SafeInt): SafeInt {
  const next = SafeInt.sub(current, points);
  return next < CREW_QUALITY_MIN ? SafeInt(CREW_QUALITY_MIN) : next;
}

export function readinessAfterCrewRamp(
  readiness: ShipReadinessState,
  crewAfterRamp: SafeInt,
): ShipReadinessState {
  if (readiness === "WORKING_UP" && crewAfterRamp >= WORKING_UP_DECENT_THRESHOLD) return "ACTIVE";
  return readiness;
}

export function battleReadiness(crewQuality: SafeInt): number {
  return Number(crewQuality);
}

export function crewQualityBp(crewQuality: SafeInt): number {
  return Number(crewQuality) * 100;
}

export function isShipReadinessState(value: unknown): value is ShipReadinessState {
  return typeof value === "string" && (SHIP_READINESS_STATES as readonly string[]).includes(value);
}

export function deriveReadiness(isUnderConstruction: boolean): ShipReadinessState {
  return isUnderConstruction ? "WORKING_UP" : "ACTIVE";
}

export function deriveCrewQuality(readiness: ShipReadinessState): SafeInt {
  return readiness === "ACTIVE" ? ACTIVE_CREW_CEILING : LAID_UP_CREW_CEILING;
}

export class ShipReadinessFailure {
  readonly _tag = "ShipReadinessFailure";
  constructor(
    readonly code: DiagnosticCode,
    readonly shipId: string,
    readonly message: string,
    readonly remediation: string,
  ) {}

  toDiagnostic(): Diagnostic {
    return {
      code: this.code,
      severity: "error",
      stage: "campaign-compile",
      message: this.message,
      entityId: this.shipId,
      remediation: this.remediation,
    };
  }
}

export interface ShipReadinessSeed {
  readonly readiness: ShipReadinessState;
  readonly crewQuality: SafeInt;
  readonly repairMonthsRemaining?: SafeInt;
}

export function resolveShipReadinessSeed(
  record: Record<string, unknown>,
  shipId: string,
):
  | { readonly ok: true; readonly value: ShipReadinessSeed }
  | { readonly ok: false; readonly error: ShipReadinessFailure } {
  for (const key of Object.keys(record)) {
    if (!ALLOWED_SHIP_INPUT_KEYS.has(key)) {
      return {
        ok: false,
        error: new ShipReadinessFailure(
          SHIP_READINESS_CODES.excessKey,
          shipId,
          `Ship '${shipId}' has unknown key '${key}'`,
          `Remove '${key}' from the ship record`,
        ),
      };
    }
  }

  const rawReadiness = record["readiness"];
  let readiness: ShipReadinessState;
  if (rawReadiness === undefined) {
    readiness = deriveReadiness(record["isUnderConstruction"] === true);
  } else if (isShipReadinessState(rawReadiness)) {
    readiness = rawReadiness;
  } else {
    return {
      ok: false,
      error: new ShipReadinessFailure(
        SHIP_READINESS_CODES.unknownState,
        shipId,
        `Ship '${shipId}' has an unknown readiness state`,
        `Use one of ${SHIP_READINESS_STATES.join(", ")}`,
      ),
    };
  }

  const rawCrewQuality = record["crewQuality"];
  let crewQuality: SafeInt;
  if (rawCrewQuality === undefined) {
    crewQuality = deriveCrewQuality(readiness);
  } else if (
    typeof rawCrewQuality === "number" &&
    Number.isSafeInteger(rawCrewQuality) &&
    rawCrewQuality >= CREW_QUALITY_MIN &&
    rawCrewQuality <= CREW_QUALITY_MAX
  ) {
    crewQuality = SafeInt(rawCrewQuality);
  } else {
    return {
      ok: false,
      error: new ShipReadinessFailure(
        SHIP_READINESS_CODES.crewQuality,
        shipId,
        `Ship '${shipId}' crew quality must be an integer in ${String(CREW_QUALITY_MIN)}..${String(CREW_QUALITY_MAX)}`,
        `Set crewQuality to an integer in ${String(CREW_QUALITY_MIN)}..${String(CREW_QUALITY_MAX)}`,
      ),
    };
  }

  const rawRepairMonths = record["repairMonthsRemaining"];
  let repairMonthsRemaining: SafeInt | undefined;
  if (rawRepairMonths !== undefined) {
    if (
      typeof rawRepairMonths === "number" &&
      Number.isSafeInteger(rawRepairMonths) &&
      rawRepairMonths >= 0 &&
      rawRepairMonths <= Number(REPAIR_MONTHS_MAX)
    ) {
      repairMonthsRemaining = SafeInt(rawRepairMonths);
    } else {
      return {
        ok: false,
        error: new ShipReadinessFailure(
          SHIP_READINESS_CODES.repairMonths,
          shipId,
          `Ship '${shipId}' repairMonthsRemaining must be an integer in 0..${String(REPAIR_MONTHS_MAX)}`,
          `Set repairMonthsRemaining to an integer in 0..${String(REPAIR_MONTHS_MAX)}`,
        ),
      };
    }
  }

  return {
    ok: true,
    value: {
      readiness,
      crewQuality,
      ...(repairMonthsRemaining === undefined ? {} : { repairMonthsRemaining }),
    },
  };
}

const ALLOWED_SHIP_INPUT_KEYS = new Set([
  "id",
  "name",
  "classId",
  "designVersionId",
  "hitPoints",
  "maxHitPoints",
  "speed",
  "firepower",
  "armor",
  "isUnderConstruction",
  "constructionProgress",
  "constructionTotalWork",
  "inBattleId",
  "readiness",
  "crewQuality",
  "repairMonthsRemaining",
]);
