import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  COASTAL_DEFENSE_RULESET_VERSION,
  DAMAGE_EVENT_TYPES,
  LAND_TARGET_DAMAGE_STATES,
  LAND_TARGET_TYPES,
  COASTAL_BATTERY_ERA_BANDS,
  COASTAL_DEFENSE_BATTERY_MODELS,
  type CoastalBatteryEraBand,
  type CoastalBatteryModel,
  type DamageEventType,
  type LandTargetDamageState,
  type LandTargetType,
} from "./constants.js";
import {
  COASTAL_DEFENSE_INVARIANT_FAILED,
  INVALID_COASTAL_BATTERY_DEFINITION,
  UNKNOWN_LAND_TARGET_TYPE,
} from "./reasonCodes.js";

function batteryInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(INVALID_COASTAL_BATTERY_DEFINITION, {
    code: INVALID_COASTAL_BATTERY_DEFINITION,
    field,
    reason,
  });
}

function typeInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(UNKNOWN_LAND_TARGET_TYPE, {
    code: UNKNOWN_LAND_TARGET_TYPE,
    field,
    reason,
  });
}

function generalInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(COASTAL_DEFENSE_INVARIANT_FAILED, {
    code: COASTAL_DEFENSE_INVARIANT_FAILED,
    field,
    reason,
  });
}

export interface CoastalBatteryDefinition {
  readonly model: CoastalBatteryModel;
  readonly caliberMm: SafeInt;
  readonly eraBand: CoastalBatteryEraBand;
  readonly hasAA: boolean;
}

export function createCoastalBatteryDefinition(params: {
  model: string;
  caliberMm: number;
  eraBand: string;
  hasAA: boolean;
}): CoastalBatteryDefinition {
  if (!(COASTAL_DEFENSE_BATTERY_MODELS as readonly string[]).includes(params.model)) {
    batteryInvariant(params.model, "model", `unknown battery model: ${params.model}`);
  }
  if (!(COASTAL_BATTERY_ERA_BANDS as readonly string[]).includes(params.eraBand)) {
    batteryInvariant(params.eraBand, "eraBand", `unknown era band: ${params.eraBand}`);
  }
  const cal = SafeInt(params.caliberMm);
  if (cal < SafeInt(75) || cal > SafeInt(460)) {
    batteryInvariant(
      params.caliberMm,
      "caliberMm",
      `caliber out of range [75, 460]: ${params.caliberMm}`,
    );
  }
  return {
    model: params.model as CoastalBatteryModel,
    caliberMm: cal,
    eraBand: params.eraBand as CoastalBatteryEraBand,
    hasAA: params.hasAA,
  };
}

export function validateLandTargetType(value: string): LandTargetType {
  if (!(LAND_TARGET_TYPES as readonly string[]).includes(value)) {
    typeInvariant(value, "landTargetType", `unknown land target type: ${value}`);
  }
  return value as LandTargetType;
}

export function validateDamageState(value: string): LandTargetDamageState {
  if (!(LAND_TARGET_DAMAGE_STATES as readonly string[]).includes(value)) {
    generalInvariant(value, "damageState", `unknown damage state: ${value}`);
  }
  return value as LandTargetDamageState;
}

export interface LandTarget {
  readonly type: LandTargetType;
  readonly damageState: LandTargetDamageState;
}

export function createLandTarget(type: string): LandTarget {
  return {
    type: validateLandTargetType(type),
    damageState: "INTACT",
  };
}

export function isTerminalDamageState(state: LandTargetDamageState): boolean {
  return state === "DESTROYED";
}

export interface DamageEvent {
  readonly eventType: DamageEventType;
}

export function createDamageEvent(eventType: string): DamageEvent {
  if (!(DAMAGE_EVENT_TYPES as readonly string[]).includes(eventType)) {
    generalInvariant(eventType, "eventType", `unknown damage event type: ${eventType}`);
  }
  return { eventType: eventType as DamageEventType };
}

export function batteryContentHash(def: CoastalBatteryDefinition): string {
  return createEnvelope("coastal_defense/battery", COASTAL_DEFENSE_RULESET_VERSION, {
    model: def.model,
    caliberMm: def.caliberMm.valueOf(),
    eraBand: def.eraBand,
    hasAA: def.hasAA,
  }).bodyHash;
}
