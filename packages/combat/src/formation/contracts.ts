import { BluewaveError } from "@bluewave/contracts";
import type { DivisionFormation } from "../tactical/division.js";

export const FORMATION_KEEPING_VERSION = "formation_keeping_v1" as const;

export interface FormationKeepingRuleset {
  columnIntervalUm: number;
  abreastIntervalUm: number;
  searchLineIntervalUm: number;
  divisionGapUm: number;
  stationToleranceUm: number;
  trackCapacity: number;
  catchUpMarginBp: number;
  catchUpFullErrorUm: number;
}

export type StationPoint = readonly [number, number];

export interface FormationTrack {
  divisionId: string;
  points: readonly StationPoint[];
}

export interface FormationContext {
  ruleset: FormationKeepingRuleset;
  turnTogether?: Readonly<Record<string, boolean>>;
  tracks?: Readonly<Record<string, FormationTrack>>;
}

export type StationKeepingMode = "FLAGSHIP" | "TRACK" | "STATION" | "TURN_TOGETHER";

export interface ShipStationRecord {
  assetId: string;
  divisionId: string;
  formation: DivisionFormation;
  mode: StationKeepingMode;
  offStation: boolean;
  stationErrorM: number;
  divisionSpeedBp: number;
}

export interface FormationShipView {
  assetId: string;
  position: StationPoint;
  heading: number;
  orderedHeading: number;
  orderedSpeedBp: number;
  attainableMaxBp: number;
}

export interface FormationDivisionView {
  divisionId: string;
  formation: DivisionFormation;
  flagshipId: string;
  memberIds: readonly string[];
  divisionIndex: number;
}

export interface ShipOrderOverride {
  orderedHeading: number;
  orderedSpeedBp: number;
}

export function validateFormationKeepingRuleset(ruleset: FormationKeepingRuleset): void {
  const positive: ReadonlyArray<readonly [string, number]> = [
    ["columnIntervalUm", ruleset.columnIntervalUm],
    ["abreastIntervalUm", ruleset.abreastIntervalUm],
    ["searchLineIntervalUm", ruleset.searchLineIntervalUm],
    ["divisionGapUm", ruleset.divisionGapUm],
    ["stationToleranceUm", ruleset.stationToleranceUm],
    ["trackCapacity", ruleset.trackCapacity],
    ["catchUpFullErrorUm", ruleset.catchUpFullErrorUm],
  ];
  for (const [field, value] of positive) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
        code: "TACTICAL_STATE_INVARIANT_FAILED",
        field,
        reason: "formation keeping values must be positive safe integers",
        value,
      });
    }
  }
  if (
    !Number.isSafeInteger(ruleset.catchUpMarginBp) ||
    ruleset.catchUpMarginBp < 0 ||
    ruleset.catchUpMarginBp > 10_000
  ) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "catchUpMarginBp",
      reason: "catch-up margin must be basis points in [0, 10000]",
      value: ruleset.catchUpMarginBp,
    });
  }
  if (ruleset.searchLineIntervalUm <= ruleset.abreastIntervalUm) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      field: "searchLineIntervalUm",
      reason: "a search line must be spread wider than line abreast",
      value: ruleset.searchLineIntervalUm,
    });
  }
}
