// Compile-time seeding of the 1880 initial divisions (N-1 ticket 07, DESIGN-26,
// ADR-0224). The authored `divisions` collection names a nation, an ordered ship
// list and a command; this module resolves those references against the nation's
// compiled fleets and officer roster and builds the authoritative
// `PermanentDivision` records. A malformed record is a `_tag`-discriminated
// `DivisionSeedFailure` diagnostic, never a silent default.
//
// `campaign` is renderer-reachable, so the failure stays a plain tagged class
// (`readonly _tag`), never `Data.TaggedError` (ADR-0128 §1, MIG-EXCL-1).
import { SafeInt } from "@bluewave/contracts";
import { compareCodePoints } from "@bluewave/deterministic";
import type { Diagnostic, DiagnosticCode, DiagnosticCollector } from "@bluewave/diagnostics";

import {
  DIVISION_FORMATIONS,
  DIVISION_ROLES,
  divisionAggregateHash,
  INITIAL_DIVISION_COHESION,
  INITIAL_DIVISION_EXPERIENCE,
  VACANT,
  type DivisionFormation,
  type DivisionRole,
  type PermanentDivision,
} from "./division.js";
import type { Officer } from "./officers.js";
import type { FleetState } from "./state.js";

/** Compile-boundary diagnostic codes for a malformed authored division record. */
export const DIVISION_SEED_CODES = {
  ship: "CAMPAIGN-DIVISION-SHIP" as DiagnosticCode,
  location: "CAMPAIGN-DIVISION-LOCATION" as DiagnosticCode,
  nation: "CAMPAIGN-DIVISION-NATION" as DiagnosticCode,
  officer: "CAMPAIGN-DIVISION-OFFICER" as DiagnosticCode,
  role: "CAMPAIGN-DIVISION-ROLE" as DiagnosticCode,
  formation: "CAMPAIGN-DIVISION-FORMATION" as DiagnosticCode,
} as const;

/**
 * A compile-boundary failure for a malformed authored division. A stable `_tag`
 * discriminates it for callers; `code` is the diagnostic code the collector
 * records.
 */
export class DivisionSeedFailure {
  readonly _tag = "DivisionSeedFailure";
  constructor(
    readonly code: DiagnosticCode,
    readonly divisionId: string,
    readonly message: string,
    readonly remediation: string,
  ) {}

  toDiagnostic(): Diagnostic {
    return {
      code: this.code,
      severity: "error",
      stage: "campaign-compile",
      message: this.message,
      entityId: this.divisionId,
      remediation: this.remediation,
    };
  }
}

export interface DivisionSeedContext {
  readonly nationId: string;
  readonly fleets: readonly FleetState[];
  readonly officers: readonly Officer[];
  /** The compiled snapshot's ruleset version, stamped onto each division. */
  readonly rulesetVersion: string;
  /** The campaign start month id (`YYYY-MM`) the divisions are created in. */
  readonly creationMonth: string;
}

/**
 * Resolves one nation's authored division records into authoritative
 * `PermanentDivision` records, recording a `DivisionSeedFailure` diagnostic for
 * each record that cannot be built. Returns the valid records in canonical id
 * order. A malformed record is skipped (never defaulted); the caller's
 * `collector.hasErrors` then fails the whole compile.
 */
export function buildSeededDivisions(
  records: readonly unknown[],
  context: DivisionSeedContext,
  collector: DiagnosticCollector,
): PermanentDivision[] {
  if (records.length === 0) return [];

  const shipLocation = new Map<string, { nationId: string; areaId: string }>();
  for (const fleet of context.fleets) {
    for (const ship of fleet.ships) {
      shipLocation.set(ship.id, { nationId: fleet.nationId, areaId: fleet.locationAreaId });
    }
  }
  const officerIds = new Set(context.officers.map((officer) => officer.id));
  const claimedShips = new Map<string, string>();
  const claimedOfficers = new Map<string, string>();

  const divisions: PermanentDivision[] = [];
  for (const record of records) {
    const result = resolveSeededDivision(
      record as Record<string, unknown>,
      context,
      shipLocation,
      officerIds,
    );
    if (!result.ok) {
      collector.add(result.error.toDiagnostic());
      continue;
    }
    const division = result.value;
    const duplicateShip = division.shipOrder.find((shipId) => claimedShips.has(shipId));
    if (duplicateShip !== undefined) {
      const owner = claimedShips.get(duplicateShip);
      collector.add(
        fail(
          DIVISION_SEED_CODES.ship,
          division.divisionId,
          `Division '${division.divisionId}' reuses ship '${duplicateShip}' already assigned to '${String(owner)}'`,
          "Assign each ship to at most one initial division",
        ).error.toDiagnostic(),
      );
      continue;
    }
    if (
      division.commanderOfficerId !== VACANT &&
      claimedOfficers.has(division.commanderOfficerId)
    ) {
      const owner = claimedOfficers.get(division.commanderOfficerId);
      collector.add(
        fail(
          DIVISION_SEED_CODES.officer,
          division.divisionId,
          `Division '${division.divisionId}' reuses commander '${division.commanderOfficerId}' already commanding '${String(owner)}'`,
          "Give each officer at most one initial division, or leave the command vacant",
        ).error.toDiagnostic(),
      );
      continue;
    }
    for (const shipId of division.shipOrder) claimedShips.set(shipId, division.divisionId);
    if (division.commanderOfficerId !== VACANT) {
      claimedOfficers.set(division.commanderOfficerId, division.divisionId);
    }
    divisions.push(division);
  }
  return divisions.sort((a, b) => compareCodePoints(a.divisionId, b.divisionId));
}

function fail(
  code: DiagnosticCode,
  divisionId: string,
  message: string,
  remediation: string,
): { readonly ok: false; readonly error: DivisionSeedFailure } {
  return { ok: false, error: new DivisionSeedFailure(code, divisionId, message, remediation) };
}

function resolveSeededDivision(
  record: Record<string, unknown>,
  context: DivisionSeedContext,
  shipLocation: ReadonlyMap<string, { nationId: string; areaId: string }>,
  officerIds: ReadonlySet<string>,
):
  | { readonly ok: true; readonly value: PermanentDivision }
  | { readonly ok: false; readonly error: DivisionSeedFailure } {
  const rawId = record["id"];
  if (typeof rawId !== "string" || rawId === "") {
    return fail(
      DIVISION_SEED_CODES.ship,
      "",
      "Division record has no non-empty id",
      "Give the division a unique non-empty id",
    );
  }
  const divisionId = rawId;

  const recordNationId = record["nationId"];
  if (recordNationId !== context.nationId) {
    return fail(
      DIVISION_SEED_CODES.nation,
      divisionId,
      `Division '${divisionId}' has nationId '${String(recordNationId)}' but was seeded for '${context.nationId}'`,
      "Match the division's nationId to the nation being compiled",
    );
  }

  const rawOrder = record["shipOrder"];
  if (!Array.isArray(rawOrder) || rawOrder.length === 0) {
    return fail(
      DIVISION_SEED_CODES.ship,
      divisionId,
      `Division '${divisionId}' has an empty shipOrder`,
      "Name at least one ship id from the nation's fleets",
    );
  }
  const nonString = rawOrder.find((value) => typeof value !== "string");
  if (nonString !== undefined) {
    return fail(
      DIVISION_SEED_CODES.ship,
      divisionId,
      `Division '${divisionId}' has a non-string shipOrder entry`,
      "Name only ship id strings",
    );
  }
  const shipOrder = rawOrder as string[];

  const role = record["divisionRole"];
  if (typeof role !== "string" || !(DIVISION_ROLES as readonly string[]).includes(role)) {
    return fail(
      DIVISION_SEED_CODES.role,
      divisionId,
      `Division '${divisionId}' has an unknown divisionRole`,
      `Use one of ${DIVISION_ROLES.join(", ")}`,
    );
  }
  const formation = record["preferredFormation"];
  if (
    typeof formation !== "string" ||
    !(DIVISION_FORMATIONS as readonly string[]).includes(formation)
  ) {
    return fail(
      DIVISION_SEED_CODES.formation,
      divisionId,
      `Division '${divisionId}' has an unknown preferredFormation`,
      `Use one of ${DIVISION_FORMATIONS.join(", ")}`,
    );
  }

  const areas = new Set<string>();
  for (const shipId of shipOrder) {
    const located = shipLocation.get(shipId);
    if (located === undefined) {
      return fail(
        DIVISION_SEED_CODES.ship,
        divisionId,
        `Division '${divisionId}' references unknown ship '${shipId}'`,
        "Name a ship id declared in the nation's fleets",
      );
    }
    if (located.nationId !== context.nationId) {
      return fail(
        DIVISION_SEED_CODES.nation,
        divisionId,
        `Division '${divisionId}' includes ship '${shipId}' of another nation`,
        "Name only ships of the division's nation",
      );
    }
    areas.add(located.areaId);
  }
  if (areas.size > 1) {
    return fail(
      DIVISION_SEED_CODES.location,
      divisionId,
      `Division '${divisionId}' ships are not co-located (${[...areas].join(", ")})`,
      "Name ships stationed in a single area",
    );
  }

  const rawCommander = record["commanderOfficerId"];
  if (rawCommander !== undefined && typeof rawCommander !== "string") {
    return fail(
      DIVISION_SEED_CODES.officer,
      divisionId,
      `Division '${divisionId}' has a non-string commanderOfficerId`,
      `Name an officer of the nation's roster, or ${VACANT}`,
    );
  }
  let commanderOfficerId: string = VACANT;
  if (rawCommander !== undefined && rawCommander !== VACANT) {
    if (!officerIds.has(rawCommander)) {
      return fail(
        DIVISION_SEED_CODES.officer,
        divisionId,
        `Division '${divisionId}' references unknown officer '${rawCommander}'`,
        `Name an officer of the nation's roster, or ${VACANT}`,
      );
    }
    commanderOfficerId = rawCommander;
  }

  const division: PermanentDivision = {
    divisionId,
    nationId: context.nationId,
    shipOrder: [...shipOrder],
    flagshipShipId: shipOrder[0]!,
    commanderOfficerId,
    divisionRole: role as DivisionRole,
    preferredFormation: formation as DivisionFormation,
    experience: SafeInt(INITIAL_DIVISION_EXPERIENCE),
    cohesion: SafeInt(INITIAL_DIVISION_COHESION),
    locationAreaId: [...areas][0]!,
    creationMonth: context.creationMonth,
    lastReorganizationMonth: context.creationMonth,
    provenanceRefs: [],
    rulesetVersion: context.rulesetVersion,
    aggregateHash: "",
  };
  return { ok: true, value: { ...division, aggregateHash: divisionAggregateHash(division) } };
}
