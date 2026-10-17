// S-1 (ship readiness and maintenance): the per-ship readiness vocabulary and
// crew quality band. Values are derived at compile from existing content — an
// under-construction hull works up, every other ship is active at its ceiling —
// with optional authored overrides validated at the compile boundary. The crew
// ceilings are fixture-class until decision request 0007 (S-1 map D4/D7).
//
// `campaign` is renderer-reachable, so its compile-boundary failure stays a
// plain tagged class (`readonly _tag`), never `Data.TaggedError` (ADR-0128 §1,
// MIG-EXCL-1: importing the Effect `Data` runtime would bundle `effect`).
import { SafeInt } from "@bluewave/contracts";
import type { Diagnostic, DiagnosticCode } from "@bluewave/diagnostics";

/** The canonical readiness vocabulary (manual `AF`/`RF`/`MB`/`WU`, pp.48/51; `REPAIR` per S-1 D6). */
export const SHIP_READINESS_STATES = [
  "ACTIVE",
  "RESERVE",
  "MOTHBALLED",
  "WORKING_UP",
  "REPAIR",
] as const;

export type ShipReadinessState = (typeof SHIP_READINESS_STATES)[number];

/** Compile-boundary diagnostic codes for a malformed ship readiness/crew seed. */
export const SHIP_READINESS_CODES = {
  unknownState: "CAMPAIGN-SHIP-READINESS" as DiagnosticCode,
  crewQuality: "CAMPAIGN-SHIP-CREW-QUALITY" as DiagnosticCode,
  repairMonths: "CAMPAIGN-SHIP-REPAIR-MONTHS" as DiagnosticCode,
  excessKey: "CAMPAIGN-SHIP-EXCESS-KEY" as DiagnosticCode,
} as const;

export const CREW_QUALITY_MIN = 0;
export const CREW_QUALITY_MAX = 100;

/** The largest remaining-months counter a `REPAIR` ship may carry (balance_adjustment, ADR-0213). */
export const REPAIR_MONTHS_MAX = SafeInt(120);

// S-1 crew-quality ceilings and ramp (ADR-0223, decision request 0007-A). The
// manual gives no ramp schedule and no grades (p.51): it says active crews are
// "best trained", reservists take "time", mothballed crews "substantial time",
// and working-up ends at "decent crew quality". Every magnitude here is an
// admitted `balance_adjustment` (ADR-0213) unless noted, never a manual fact.
/** A fully worked-up active crew (balance_adjustment, ADR-0213). */
export const ACTIVE_CREW_CEILING = SafeInt(100);
/** A laid-up or newly launched hull starts with no worked-up crew. */
export const LAID_UP_CREW_CEILING = SafeInt(0);
/** Working-up ships ramp to the active standard before they join the fleet. */
export const WORKING_UP_CREW_CEILING = SafeInt(100);
/** Reserve crews never reach the active standard (balance_adjustment, ADR-0213). */
export const RESERVE_CREW_CEILING = SafeInt(70);
/** Mothballed crews are barely trained (balance_adjustment, ADR-0213). */
export const MOTHBALLED_CREW_CEILING = SafeInt(30);
/** Under repair a ship keeps its crew, so the ceiling is the active standard. */
export const REPAIR_CREW_CEILING = SafeInt(100);

/** Crew quality points a ship gains or loses toward its ceiling each month (balance_adjustment). */
export const CREW_QUALITY_RAMP_PER_MONTH = SafeInt(5);
/** The crew quality at which a working-up ship leaves working up (manual p.51 "decent"; balance_adjustment). */
export const WORKING_UP_DECENT_THRESHOLD = SafeInt(60);

const CREW_CEILING_BY_STATE: Record<ShipReadinessState, SafeInt> = {
  ACTIVE: ACTIVE_CREW_CEILING,
  WORKING_UP: WORKING_UP_CREW_CEILING,
  RESERVE: RESERVE_CREW_CEILING,
  MOTHBALLED: MOTHBALLED_CREW_CEILING,
  REPAIR: REPAIR_CREW_CEILING,
};

/** The crew-quality ceiling a readiness state ramps toward. */
export function crewCeilingFor(readiness: ShipReadinessState): SafeInt {
  return CREW_CEILING_BY_STATE[readiness];
}

/**
 * Move a ship's crew quality one month toward its readiness state's ceiling by
 * `CREW_QUALITY_RAMP_PER_MONTH`, clamped to the ceiling and to `0..100`. Pure and
 * integer-only: the ramp consumes no randomness (S-1 D4).
 */
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

/**
 * The readiness state after a month's ramp: a working-up ship that has reached the
 * "decent" crew threshold becomes active. Working up is entry-only (manual p.51,
 * "but not back"), so this never returns a ship to working up.
 */
export function readinessAfterCrewRamp(
  readiness: ShipReadinessState,
  crewAfterRamp: SafeInt,
): ShipReadinessState {
  if (readiness === "WORKING_UP" && crewAfterRamp >= WORKING_UP_DECENT_THRESHOLD) return "ACTIVE";
  return readiness;
}

export function isShipReadinessState(value: unknown): value is ShipReadinessState {
  return typeof value === "string" && (SHIP_READINESS_STATES as readonly string[]).includes(value);
}

/** The readiness a ship takes when none is authored: laid down hulls work up, all else are active. */
export function deriveReadiness(isUnderConstruction: boolean): ShipReadinessState {
  return isUnderConstruction ? "WORKING_UP" : "ACTIVE";
}

/** The crew quality a ship seeds at for its readiness state when none is authored. */
export function deriveCrewQuality(readiness: ShipReadinessState): SafeInt {
  return readiness === "ACTIVE" ? ACTIVE_CREW_CEILING : LAID_UP_CREW_CEILING;
}

/**
 * A compile-boundary failure for a malformed ship readiness/crew seed. A stable
 * `_tag` discriminates it for callers; `code` is the diagnostic code the
 * collector records.
 */
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

/**
 * Resolve a ship's readiness and crew quality from a compiled fleet-ship record.
 * Absent fields are derived; present fields are validated. A malformed value or
 * an unknown key is a `_tag`-discriminated `ShipReadinessFailure`
 * (`SHIP_READINESS_CODES`), never a silent default.
 */
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

/** Keys a compiled fleet-ship record may carry, in addition to the optional readiness/crew seed. */
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
