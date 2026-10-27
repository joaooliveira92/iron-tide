import { BluewaveError } from "@bluewave/contracts";
import { ORDER_NOT_PERMITTED_AT_REALISM } from "./reasonCodes.js";

export const REALISM_MODES = ["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"] as const;

export type RealismMode = (typeof REALISM_MODES)[number];

export const BATTLE_ORDER_CAPABILITIES = [
  "DIVISION_ORDERS",
  "OTHER_DIVISION_CONTROL",
  "TARGET_ORDERS",
  "HOLD_FIRE",
  "MANUAL_TORPEDOES",
  "SMOKE_FLOATS",
  "FORCE_ORDERS",
] as const;

export type BattleOrderCapability = (typeof BATTLE_ORDER_CAPABILITIES)[number];

export const TARGET_ORDER_KINDS = ["DIVISION", "SHIP"] as const;

export type TargetOrderKind = (typeof TARGET_ORDER_KINDS)[number];

export const VICTORY_POINT_MULTIPLIER_BP: Readonly<Record<RealismMode, number>> = {
  ADMIRAL: 10_000,
  REAR_ADMIRAL: 9_000,
  CAPTAIN: 8_000,
};

export interface DivisionOrderPermissionContext {
  readonly isLeadDivision: boolean;
}

export interface OtherDivisionControlPermissionContext {
  readonly withinSightOfFlagship: boolean;
}

export interface RealismPermissions {
  readonly divisionOrders: boolean;
  readonly otherDivisionControl: boolean;
  readonly targetOrders: boolean;
  readonly holdFire: boolean;
  readonly manualTorpedoes: boolean;
  readonly smokeFloats: boolean;
  readonly forceOrders: boolean;
  readonly victoryPointMultiplierBp: number;
}

export function realismPermissions(
  mode: RealismMode,
  division: DivisionOrderPermissionContext,
  other: OtherDivisionControlPermissionContext = { withinSightOfFlagship: false },
  targetKind: TargetOrderKind = "DIVISION",
): RealismPermissions {
  return {
    divisionOrders: mode !== "ADMIRAL" || division.isLeadDivision,
    otherDivisionControl:
      mode === "CAPTAIN" || (mode === "REAR_ADMIRAL" && other.withinSightOfFlagship),
    targetOrders: mode === "CAPTAIN" || (mode === "REAR_ADMIRAL" && targetKind === "DIVISION"),
    holdFire: mode !== "ADMIRAL",
    manualTorpedoes: mode === "CAPTAIN",
    smokeFloats: mode === "CAPTAIN",
    forceOrders: true,
    victoryPointMultiplierBp: VICTORY_POINT_MULTIPLIER_BP[mode],
  };
}

export function divisionOrderPermitted(
  mode: RealismMode,
  context: DivisionOrderPermissionContext,
): boolean {
  return realismPermissions(mode, context).divisionOrders;
}

export function otherDivisionControlPermitted(
  mode: RealismMode,
  context: OtherDivisionControlPermissionContext,
): boolean {
  return realismPermissions(mode, { isLeadDivision: false }, context).otherDivisionControl;
}

export function targetOrderPermitted(mode: RealismMode, kind: TargetOrderKind): boolean {
  return realismPermissions(mode, { isLeadDivision: false }, undefined, kind).targetOrders;
}

export function holdFirePermitted(mode: RealismMode): boolean {
  return realismPermissions(mode, { isLeadDivision: false }).holdFire;
}

export function manualTorpedoesPermitted(mode: RealismMode): boolean {
  return realismPermissions(mode, { isLeadDivision: false }).manualTorpedoes;
}

export function forceOrderPermitted(mode: RealismMode): boolean {
  return realismPermissions(mode, { isLeadDivision: false }).forceOrders;
}

export function victoryPointMultiplierBp(mode: RealismMode): number {
  return VICTORY_POINT_MULTIPLIER_BP[mode];
}

const CAPABILITY_TO_PERMISSION: Readonly<Record<BattleOrderCapability, keyof RealismPermissions>> =
  {
    DIVISION_ORDERS: "divisionOrders",
    OTHER_DIVISION_CONTROL: "otherDivisionControl",
    TARGET_ORDERS: "targetOrders",
    HOLD_FIRE: "holdFire",
    MANUAL_TORPEDOES: "manualTorpedoes",
    SMOKE_FLOATS: "smokeFloats",
    FORCE_ORDERS: "forceOrders",
  };

export function orderPermitted(
  mode: RealismMode,
  capability: BattleOrderCapability,
  context: DivisionOrderPermissionContext = { isLeadDivision: false },
  other: OtherDivisionControlPermissionContext = { withinSightOfFlagship: false },
  targetKind: TargetOrderKind = "DIVISION",
): boolean {
  const permissions = realismPermissions(mode, context, other, targetKind);
  return permissions[CAPABILITY_TO_PERMISSION[capability]] === true;
}

export function assertOrderPermitted(
  mode: RealismMode,
  capability: BattleOrderCapability,
  context: DivisionOrderPermissionContext = { isLeadDivision: false },
  other: OtherDivisionControlPermissionContext = { withinSightOfFlagship: false },
  targetKind: TargetOrderKind = "DIVISION",
): void {
  if (orderPermitted(mode, capability, context, other, targetKind)) return;
  throw new BluewaveError(ORDER_NOT_PERMITTED_AT_REALISM, {
    code: ORDER_NOT_PERMITTED_AT_REALISM,
    mode,
    capability,
    isLeadDivision: context.isLeadDivision,
    withinSightOfFlagship: other.withinSightOfFlagship,
    targetKind,
  });
}
