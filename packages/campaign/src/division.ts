import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { CAMPAIGN_DIVISION_FORMATIONS, CAMPAIGN_DIVISION_ROLES } from "@bluewave/content-schema";
import { sha256Hex, canonicalSerialize } from "@bluewave/deterministic";

// DESIGN-26 §28 reason codes.
export const DIVISION_SIZE_LIMIT_EXCEEDED = "DIVISION_SIZE_LIMIT_EXCEEDED" as const;
export const DIVISION_SHIP_TYPE_INCOMPATIBLE = "DIVISION_SHIP_TYPE_INCOMPATIBLE" as const;
export const CA_BC_DIVISION_MIX_INELIGIBLE = "CA_BC_DIVISION_MIX_INELIGIBLE" as const;
export const DIVISION_LOCATION_CONFLICT = "DIVISION_LOCATION_CONFLICT" as const;
export const DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE =
  "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE" as const;
export const DIVISION_FLAGSHIP_INVALID = "DIVISION_FLAGSHIP_INVALID" as const;
export const DIVISION_COMMANDER_INVALID = "DIVISION_COMMANDER_INVALID" as const;
export const DIVISION_ROLE_INELIGIBLE = "DIVISION_ROLE_INELIGIBLE" as const;
export const DIVISION_FORMATION_INELIGIBLE = "DIVISION_FORMATION_INELIGIBLE" as const;
export const DIVISION_STATE_INVARIANT_FAILED = "DIVISION_STATE_INVARIANT_FAILED" as const;

// DESIGN-26 §1 canonical division types.
export const DIVISION_TYPES = ["PERMANENT_DIVISION", "TACTICAL_DIVISION"] as const;
export type DivisionType = (typeof DIVISION_TYPES)[number];

// DESIGN-26 §13 canonical roles. The values live in the content schema (the
// authored-record boundary) and are re-exported here so there is one vocabulary.
export const DIVISION_ROLES = CAMPAIGN_DIVISION_ROLES;
export type DivisionRole = (typeof DIVISION_ROLES)[number];

// DESIGN-26 §17 canonical formations.
export const DIVISION_FORMATIONS = CAMPAIGN_DIVISION_FORMATIONS;
export type DivisionFormation = (typeof DIVISION_FORMATIONS)[number];

// DESIGN-26 §2 authoritative permanent division.
export const VACANT = "VACANT";
export type CommanderRef = string;

export interface PermanentDivision {
  divisionId: string;
  nationId: string;
  shipOrder: string[];
  flagshipShipId: string;
  commanderOfficerId: CommanderRef;
  divisionRole: DivisionRole;
  preferredFormation: DivisionFormation;
  experience: SafeInt; // 0..100
  cohesion: SafeInt; // 0..100
  locationAreaId: string;
  creationMonth: string;
  lastReorganizationMonth: string;
  provenanceRefs: string[];
  rulesetVersion: string;
  aggregateHash: string;
}

// DESIGN-26 §10 initial values.
export const INITIAL_DIVISION_EXPERIENCE = 20;
export const INITIAL_DIVISION_COHESION = 30;

// DESIGN-26 §3 size bounds.
export const DIVISION_MAX_SHIPS = 5;
export const DD_DIVISION_MAX_SHIPS = 6;

// DESIGN-26 §4 compatibility policy id.
export const DIVISION_TYPE_COMPATIBILITY_V1 = "division_type_compatibility_v1" as const;

// DESIGN-26 §25-26 constraints.
export const MAX_CA_IN_BC_DIVISION = 2;
export const CA_IN_BC_READINESS_GAP = 10;

// Canonical ship-type vocabulary for division compatibility. The authoritative
// classifier lives in @bluewave/combat (ship_type_classifier_v1); campaign uses
// this structural union so the package dependency stays one-directional.
export type CanonicalShipType =
  | "CV"
  | "CVL"
  | "AV"
  | "SS"
  | "MTB"
  | "TR"
  | "BB"
  | "BC"
  | "B"
  | "CA"
  | "CL"
  | "DD"
  | "KE"
  | "AMC";

// DESIGN-26 §4: division canonical type. The member ship types must already be
// individually compatible; this computes the aggregate label.
export function divisionCanonicalType(shipTypes: CanonicalShipType[]): CanonicalShipType {
  if (shipTypes.length === 0) return shipTypes[0] as CanonicalShipType;
  const distinct = [...new Set(shipTypes)];
  if (distinct.length === 1) return distinct[0]!;
  if (distinct.includes("BB") && distinct.includes("B")) return "BB";
  const hasBC = distinct.includes("BC");
  const hasCA = distinct.includes("CA");
  if (hasBC && hasCA && distinct.filter((t) => t !== "BC" && t !== "CA").length === 0) return "BC";
  return distinct[0]!;
}

// DESIGN-26 §4 compatibility: identical types, BB/B, or eligible BC+CA mix.
export function isDivisionTypeCompatible(
  current: CanonicalShipType[],
  incoming: CanonicalShipType,
): boolean {
  if (current.length === 0) return true;
  const distinct = [...new Set([...current, incoming])];
  if (distinct.length === 1) return true;
  if (distinct.includes("BB") && distinct.includes("B") && distinct.length === 2) return true;
  // CA in a BC division is permitted only under §5 rules (caller checks eligibility).
  if (distinct.includes("BC") && distinct.includes("CA") && distinct.length === 2) return true;
  return false;
}

export interface DivisionAssetView {
  shipId: string;
  shipType: CanonicalShipType;
  locationAreaId: string;
  isUnderConstruction: boolean;
}

// DESIGN-26 §29 invariant check. `assets` is the authoritative per-ship picture;
// returns nothing when valid, throws a DIVISION_STATE_INVARIANT_FAILED BluewaveError.
export function assertDivisionInvariants(
  division: PermanentDivision,
  assets: DivisionAssetView[],
  context?: Record<string, unknown>,
): void {
  const shipByType = new Map(assets.map((a) => [a.shipId, a.shipType]));
  const locationByShip = new Map(assets.map((a) => [a.shipId, a.locationAreaId]));

  if (division.shipOrder.length === 0) {
    throw new BluewaveError(DIVISION_STATE_INVARIANT_FAILED, {
      code: DIVISION_STATE_INVARIANT_FAILED,
      divisionId: division.divisionId,
      reason: "empty division",
      ...context,
    });
  }

  const allDd = assets.every((a) => a.shipType === "DD");
  const max = allDd ? DD_DIVISION_MAX_SHIPS : DIVISION_MAX_SHIPS;
  if (division.shipOrder.length < 1 || division.shipOrder.length > max) {
    throw new BluewaveError(DIVISION_SIZE_LIMIT_EXCEEDED, {
      code: DIVISION_SIZE_LIMIT_EXCEEDED,
      divisionId: division.divisionId,
      size: String(division.shipOrder.length),
      max: String(max),
      ...context,
    });
  }

  // flagship is the first in stored canonical order.
  if (division.flagshipShipId !== division.shipOrder[0]) {
    throw new BluewaveError(DIVISION_FLAGSHIP_INVALID, {
      code: DIVISION_FLAGSHIP_INVALID,
      divisionId: division.divisionId,
      flagshipShipId: division.flagshipShipId,
      expected: division.shipOrder[0],
      ...context,
    });
  }

  // co-location.
  const locations = new Set(division.shipOrder.map((id) => locationByShip.get(id)));
  if (locations.size > 1) {
    throw new BluewaveError(DIVISION_LOCATION_CONFLICT, {
      code: DIVISION_LOCATION_CONFLICT,
      divisionId: division.divisionId,
      locations: [...locations],
      ...context,
    });
  }

  // type compatibility.
  const shipTypes = division.shipOrder.map((id) => shipByType.get(id));
  const distinctTypes = [...new Set(shipTypes)];
  if (
    distinctTypes.length > 1 &&
    !(
      (distinctTypes.includes("BB") && distinctTypes.includes("B")) ||
      (distinctTypes.includes("BC") &&
        distinctTypes.includes("CA") &&
        distinctTypes.filter((t) => t !== "BC" && t !== "CA").length === 0)
    )
  ) {
    throw new BluewaveError(DIVISION_SHIP_TYPE_INCOMPATIBLE, {
      code: DIVISION_SHIP_TYPE_INCOMPATIBLE,
      divisionId: division.divisionId,
      types: [...distinctTypes],
      ...context,
    });
  }
}
export const DIVISION_PENALTIES = {
  addShip: { experience: -5, cohesion: -10 },
  removeNonFlagship: { experience: -3, cohesion: -5 },
  commanderChange: { experience: -5, cohesion: -10 },
  flagshipChange: { experience: -5, cohesion: -10 },
  commanderAndFlagshipChange: { experience: -8, cohesion: -15 },
  reorderWithoutFlagship: { experience: 0, cohesion: -3 },
  changeMinHalfMembership: { experience: -10, cohesion: -15 },
  changeCanonicalType: { experience: -10, cohesion: -20 },
} as const;

export type DivisionReorgReason =
  | "CREATED"
  | "ADD_SHIP"
  | "REMOVE_SHIP"
  | "DISSOLVE"
  | "CHANGE_FLAGSHIP"
  | "REORDER"
  | "CHANGE_ROLE"
  | "CHANGE_FORMATION";

export interface ApplyDivisionResult {
  division: PermanentDivision;
  reorgReason: DivisionReorgReason;
  penaltiesApplied: { experience: number; cohesion: number };
}

function clampScore(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/**
 * The canonical SHA-256 identity of a division's authoritative fields (DESIGN-26
 * §2). `provenanceRefs` and `aggregateHash` are excluded: the hash covers the
 * command-relevant value surface, not authored provenance. Exported so the
 * compile-time seeder (N-1 ticket 07) stamps the same identity the runtime
 * commands recompute.
 */
export function divisionAggregateHash(d: PermanentDivision): string {
  return sha256Hex(
    canonicalSerialize({
      divisionId: d.divisionId,
      nationId: d.nationId,
      shipOrder: d.shipOrder,
      flagshipShipId: d.flagshipShipId,
      commanderOfficerId: d.commanderOfficerId,
      divisionRole: d.divisionRole,
      preferredFormation: d.preferredFormation,
      experience: d.experience,
      cohesion: d.cohesion,
      locationAreaId: d.locationAreaId,
      creationMonth: d.creationMonth,
      lastReorganizationMonth: d.lastReorganizationMonth,
      rulesetVersion: d.rulesetVersion,
    }),
  );
}

// DESIGN-26 §7-12: pure, atomic membership command application. Returns the new
// division with §12 penalties applied and a fresh aggregate hash. Never mutates.
export function applyDivisionCommand(
  division: PermanentDivision,
  op:
    | { type: "remove_ship"; shipId: string }
    | { type: "add_ship"; shipId: string }
    | { type: "change_flagship"; newFlagshipShipId: string }
    | { type: "create"; shipId: string; creationMonth: string }
    | { type: "reorder"; shipOrder: string[] }
    | { type: "dissolve" },
  month: string,
): ApplyDivisionResult {
  let shipOrder = [...division.shipOrder];
  let flagship = division.flagshipShipId;
  let reorgReason: DivisionReorgReason;
  let penalties = { experience: 0, cohesion: 0 };

  switch (op.type) {
    case "create": {
      reorgReason = "CREATED";
      shipOrder = [op.shipId];
      flagship = op.shipId;
      break;
    }
    case "add_ship": {
      shipOrder = [...shipOrder, op.shipId];
      penalties = {
        experience: DIVISION_PENALTIES.addShip.experience,
        cohesion: DIVISION_PENALTIES.addShip.cohesion,
      };
      reorgReason = "ADD_SHIP";
      break;
    }
    case "remove_ship": {
      const idx = shipOrder.indexOf(op.shipId);
      if (idx === -1) reorgReason = "REMOVE_SHIP";
      else {
        shipOrder = shipOrder.filter((id) => id !== op.shipId);
        if (op.shipId === flagship) {
          flagship = shipOrder[0] ?? "NONE";
          penalties = {
            experience: DIVISION_PENALTIES.flagshipChange.experience,
            cohesion: DIVISION_PENALTIES.flagshipChange.cohesion,
          };
        } else {
          penalties = {
            experience: DIVISION_PENALTIES.removeNonFlagship.experience,
            cohesion: DIVISION_PENALTIES.removeNonFlagship.cohesion,
          };
        }
        reorgReason = "REMOVE_SHIP";
      }
      break;
    }
    case "change_flagship": {
      if (!shipOrder.includes(op.newFlagshipShipId)) reorgReason = "CHANGE_FLAGSHIP";
      else {
        flagship = op.newFlagshipShipId;
        // DESIGN-26 §12: flagship change penalty; re-canonicalize order so flagship first.
        shipOrder = [
          op.newFlagshipShipId,
          ...shipOrder.filter((id) => id !== op.newFlagshipShipId),
        ];
        penalties = {
          experience: DIVISION_PENALTIES.flagshipChange.experience,
          cohesion: DIVISION_PENALTIES.flagshipChange.cohesion,
        };
        reorgReason = "CHANGE_FLAGSHIP";
      }
      break;
    }
    case "reorder": {
      // DESIGN-26 §12: reordering ships without changing the flagship costs
      // cohesion only. The flagship (canonical first ship, §8) is unchanged.
      shipOrder = [...op.shipOrder];
      penalties = {
        experience: DIVISION_PENALTIES.reorderWithoutFlagship.experience,
        cohesion: DIVISION_PENALTIES.reorderWithoutFlagship.cohesion,
      };
      reorgReason = "REORDER";
      break;
    }
    case "dissolve": {
      reorgReason = "DISSOLVE";
      shipOrder = [];
      flagship = "NONE";
      break;
    }
    default: {
      reorgReason = "CREATED";
      break;
    }
  }

  const next: PermanentDivision = {
    ...division,
    shipOrder,
    flagshipShipId: flagship,
    lastReorganizationMonth: op.type === "dissolve" ? division.lastReorganizationMonth : month,
    experience: SafeInt(clampScore((division.experience as number) + penalties.experience)),
    cohesion: SafeInt(clampScore((division.cohesion as number) + penalties.cohesion)),
    aggregateHash: "",
  };
  next.aggregateHash = divisionAggregateHash(next);
  return { division: next, reorgReason, penaltiesApplied: penalties };
}

/**
 * Puts `commanderId` (an officer id, or `VACANT`) in command of a division (ADR-0065).
 * Filling a vacancy is free; replacing or relieving a sitting commander costs the
 * DESIGN-26 commander-change penalty. Pure; returns a new division with a fresh hash.
 */
export function applyCommanderChange(
  division: PermanentDivision,
  commanderId: CommanderRef,
  month: string,
): ApplyDivisionResult {
  const penalties =
    division.commanderOfficerId === VACANT || division.commanderOfficerId === commanderId
      ? { experience: 0, cohesion: 0 }
      : {
          experience: DIVISION_PENALTIES.commanderChange.experience,
          cohesion: DIVISION_PENALTIES.commanderChange.cohesion,
        };
  const next: PermanentDivision = {
    ...division,
    commanderOfficerId: commanderId,
    lastReorganizationMonth: month,
    experience: SafeInt(clampScore((division.experience as number) + penalties.experience)),
    cohesion: SafeInt(clampScore((division.cohesion as number) + penalties.cohesion)),
    aggregateHash: "",
  };
  next.aggregateHash = divisionAggregateHash(next);
  return { division: next, reorgReason: "CHANGE_FLAGSHIP", penaltiesApplied: penalties };
}
