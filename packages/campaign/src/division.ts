import { SafeInt } from "@bluewave/contracts";
import { CAMPAIGN_DIVISION_FORMATIONS, CAMPAIGN_DIVISION_ROLES } from "@bluewave/content-schema";
import { sha256Hex, canonicalSerialize } from "@bluewave/deterministic";
import { Data, Option, Result } from "effect";

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

export const DIVISION_TYPES = ["PERMANENT_DIVISION", "TACTICAL_DIVISION"] as const;
export type DivisionType = (typeof DIVISION_TYPES)[number];

export const DIVISION_ROLES = CAMPAIGN_DIVISION_ROLES;
export type DivisionRole = (typeof DIVISION_ROLES)[number];

export const DIVISION_FORMATIONS = CAMPAIGN_DIVISION_FORMATIONS;
export type DivisionFormation = (typeof DIVISION_FORMATIONS)[number];

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
  experience: SafeInt;
  cohesion: SafeInt;
  locationAreaId: string;
  creationMonth: string;
  lastReorganizationMonth: string;
  provenanceRefs: string[];
  rulesetVersion: string;
  aggregateHash: string;
}

export const INITIAL_DIVISION_EXPERIENCE = 20;
export const INITIAL_DIVISION_COHESION = 30;

export const DIVISION_MAX_SHIPS = 5;
export const DD_DIVISION_MAX_SHIPS = 6;

export const DIVISION_TYPE_COMPATIBILITY_V1 = "division_type_compatibility_v1" as const;

export const MAX_CA_IN_BC_DIVISION = 2;
export const CA_IN_BC_READINESS_GAP = 10;

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

export function divisionCanonicalType(
  shipTypes: readonly CanonicalShipType[],
): Option.Option<CanonicalShipType> {
  const distinct = [...new Set(shipTypes)];
  if (distinct.includes("BB") && distinct.includes("B")) return Option.some("BB");
  if (distinct.length === 2 && distinct.includes("BC") && distinct.includes("CA"))
    return Option.some("BC");
  return Option.fromIterable(distinct);
}

export function isDivisionTypeCompatible(
  current: CanonicalShipType[],
  incoming: CanonicalShipType,
): boolean {
  if (current.length === 0) return true;
  const distinct = [...new Set([...current, incoming])];
  if (distinct.length === 1) return true;
  if (distinct.includes("BB") && distinct.includes("B") && distinct.length === 2) return true;
  if (distinct.includes("BC") && distinct.includes("CA") && distinct.length === 2) return true;
  return false;
}

export interface DivisionAssetView {
  shipId: string;
  shipType: CanonicalShipType;
  locationAreaId: string;
  isUnderConstruction: boolean;
}

export class DivisionStateInvariantFailed extends Data.TaggedError(
  DIVISION_STATE_INVARIANT_FAILED,
)<{
  readonly divisionId: string;
  readonly reason: string;
  readonly context: Record<string, unknown>;
}> {
  override get message(): string {
    return DIVISION_STATE_INVARIANT_FAILED;
  }
}

export class DivisionSizeLimitExceeded extends Data.TaggedError(DIVISION_SIZE_LIMIT_EXCEEDED)<{
  readonly divisionId: string;
  readonly size: string;
  readonly max: string;
  readonly context: Record<string, unknown>;
}> {
  override get message(): string {
    return DIVISION_SIZE_LIMIT_EXCEEDED;
  }
}

export class DivisionFlagshipInvalid extends Data.TaggedError(DIVISION_FLAGSHIP_INVALID)<{
  readonly divisionId: string;
  readonly flagshipShipId: string;
  readonly expected: string | undefined;
  readonly context: Record<string, unknown>;
}> {
  override get message(): string {
    return DIVISION_FLAGSHIP_INVALID;
  }
}

export class DivisionLocationConflict extends Data.TaggedError(DIVISION_LOCATION_CONFLICT)<{
  readonly divisionId: string;
  readonly locations: ReadonlyArray<string | undefined>;
  readonly context: Record<string, unknown>;
}> {
  override get message(): string {
    return DIVISION_LOCATION_CONFLICT;
  }
}

export class DivisionShipTypeIncompatible extends Data.TaggedError(
  DIVISION_SHIP_TYPE_INCOMPATIBLE,
)<{
  readonly divisionId: string;
  readonly types: ReadonlyArray<CanonicalShipType | undefined>;
  readonly context: Record<string, unknown>;
}> {
  override get message(): string {
    return DIVISION_SHIP_TYPE_INCOMPATIBLE;
  }
}

export type DivisionInvariantError =
  | DivisionStateInvariantFailed
  | DivisionSizeLimitExceeded
  | DivisionFlagshipInvalid
  | DivisionLocationConflict
  | DivisionShipTypeIncompatible;

export function checkDivisionInvariants(
  division: PermanentDivision,
  assets: DivisionAssetView[],
  context: Record<string, unknown> = {},
): Result.Result<void, DivisionInvariantError> {
  const shipByType = new Map(assets.map((a) => [a.shipId, a.shipType]));
  const locationByShip = new Map(assets.map((a) => [a.shipId, a.locationAreaId]));

  if (division.shipOrder.length === 0) {
    return Result.fail(
      new DivisionStateInvariantFailed({
        divisionId: division.divisionId,
        reason: "empty division",
        context,
      }),
    );
  }

  const allDd = assets.every((a) => a.shipType === "DD");
  const max = allDd ? DD_DIVISION_MAX_SHIPS : DIVISION_MAX_SHIPS;
  if (division.shipOrder.length < 1 || division.shipOrder.length > max) {
    return Result.fail(
      new DivisionSizeLimitExceeded({
        divisionId: division.divisionId,
        size: String(division.shipOrder.length),
        max: String(max),
        context,
      }),
    );
  }

  if (division.flagshipShipId !== division.shipOrder[0]) {
    return Result.fail(
      new DivisionFlagshipInvalid({
        divisionId: division.divisionId,
        flagshipShipId: division.flagshipShipId,
        expected: division.shipOrder[0],
        context,
      }),
    );
  }

  const locations = new Set(division.shipOrder.map((id) => locationByShip.get(id)));
  if (locations.size > 1) {
    return Result.fail(
      new DivisionLocationConflict({
        divisionId: division.divisionId,
        locations: [...locations],
        context,
      }),
    );
  }

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
    return Result.fail(
      new DivisionShipTypeIncompatible({
        divisionId: division.divisionId,
        types: [...distinctTypes],
        context,
      }),
    );
  }
  return Result.succeed(undefined);
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
