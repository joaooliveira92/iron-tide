import { BluewaveError } from "@bluewave/contracts";
import {
  ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS,
  ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS,
  type FireControlConnectionState,
  type FloodingIsolationState,
  type LauncherDamageState,
  type TorpedoMountType,
  type TorpedoPropulsionType,
} from "./constants.js";
import { INVALID_TORPEDO_LAUNCHER_STATE } from "./reasonCodes.js";
import {
  NO_RELOAD_IN_PROGRESS,
  type TorpedoLauncherState,
  type TorpedoReloadState,
  withTorpedoLauncherStateHash,
} from "./state.js";

export interface TorpedoLauncherDefinition {
  launcherFamilyId: string;
  mountType: TorpedoMountType;
  tubeCount: number;
  boreDiameterMm: number;
  handlingMassLimitKg: number;
  supportedPropulsionTypes: readonly TorpedoPropulsionType[];
  fireControlSupportedGuidance: readonly string[];
  underwaterLaunchCapability: boolean;
  requiredReloadTimeMs: number;
  aboveWaterMaxLaunchSpeedKnots: number | null;
}

function throwInvalid(def: unknown, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_TORPEDO_LAUNCHER_STATE, {
    code: INVALID_TORPEDO_LAUNCHER_STATE,
    field,
    reason,
    value,
    launcherDefinition: def,
  });
}

export function validateTorpedoLauncherDefinition(d: TorpedoLauncherDefinition): void {
  if (typeof d.launcherFamilyId !== "string" || d.launcherFamilyId.length === 0)
    throwInvalid(d, "launcherFamilyId", d.launcherFamilyId, "non-empty launcher family id");
  if (!Number.isInteger(d.tubeCount) || d.tubeCount < 1)
    throwInvalid(d, "tubeCount", d.tubeCount, "tubeCount must be an integer >= 1");
  if (!Number.isInteger(d.boreDiameterMm) || d.boreDiameterMm <= 0)
    throwInvalid(
      d,
      "boreDiameterMm",
      d.boreDiameterMm,
      "bore diameter must be a positive integer mm",
    );
  if (!Number.isInteger(d.handlingMassLimitKg) || d.handlingMassLimitKg <= 0)
    throwInvalid(
      d,
      "handlingMassLimitKg",
      d.handlingMassLimitKg,
      "handling mass limit must be a positive integer kg",
    );
  if (!Array.isArray(d.supportedPropulsionTypes) || d.supportedPropulsionTypes.length === 0)
    throwInvalid(
      d,
      "supportedPropulsionTypes",
      d.supportedPropulsionTypes,
      "at least one supported propulsion type is required",
    );
  if (!Array.isArray(d.fireControlSupportedGuidance) || d.fireControlSupportedGuidance.length === 0)
    throwInvalid(
      d,
      "fireControlSupportedGuidance",
      d.fireControlSupportedGuidance,
      "at least one supported guidance capability is required",
    );
  if (typeof d.underwaterLaunchCapability !== "boolean")
    throwInvalid(
      d,
      "underwaterLaunchCapability",
      d.underwaterLaunchCapability,
      "must be a boolean",
    );
  if (!Number.isInteger(d.requiredReloadTimeMs) || d.requiredReloadTimeMs <= 0)
    throwInvalid(
      d,
      "requiredReloadTimeMs",
      d.requiredReloadTimeMs,
      "required reload time must be a positive integer ms",
    );
  if (
    d.aboveWaterMaxLaunchSpeedKnots !== null &&
    (!Number.isInteger(d.aboveWaterMaxLaunchSpeedKnots) || d.aboveWaterMaxLaunchSpeedKnots <= 0)
  )
    throwInvalid(
      d,
      "aboveWaterMaxLaunchSpeedKnots",
      d.aboveWaterMaxLaunchSpeedKnots,
      "narrower §8 speed must be a positive integer knots or null",
    );
}

export function resolvedAboveWaterMaxLaunchSpeedKnots(d: TorpedoLauncherDefinition): number | null {
  if (d.aboveWaterMaxLaunchSpeedKnots !== null) return d.aboveWaterMaxLaunchSpeedKnots;
  if (d.mountType === "ABOVE_WATER_FIXED") return ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS;
  if (d.mountType === "ABOVE_WATER_TRAINABLE") return ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS;
  return null;
}

export function createTorpedoLauncherState(input: {
  launcherId: string;
  ownerPlatformId: string;
  launcherFamilyId: string;
  mountPosition: string;
  mountType: TorpedoMountType;
  tubeCount: number;
  loadedPerTube: readonly string[];
  reserveAmmunition: Record<string, number>;
  reloadState?: TorpedoReloadState;
  trainingLimitsMdeg: { min: number; max: number };
  underwaterLaunchCapability: boolean;
  fireControlConnectionState: FireControlConnectionState;
  damageState: LauncherDamageState;
  floodingIsolationState: FloodingIsolationState;
  activeFireSolution: string;
  rulesetVersion: string;
  formulaVersion: string;
}): TorpedoLauncherState {
  const s = input as TorpedoLauncherState;
  const requiredFields = [
    "launcherId",
    "ownerPlatformId",
    "launcherFamilyId",
    "mountPosition",
    "mountType",
    "tubeCount",
    "loadedPerTube",
    "reserveAmmunition",
    "trainingLimitsMdeg",
    "underwaterLaunchCapability",
    "fireControlConnectionState",
    "damageState",
    "floodingIsolationState",
    "activeFireSolution",
    "rulesetVersion",
    "formulaVersion",
  ] as const;
  for (const field of requiredFields) {
    if (input[field] === undefined)
      throwInvalid(input, field, undefined, "missing required launcher-state field");
  }
  if (!Array.isArray(input.loadedPerTube))
    throwInvalid(input, "loadedPerTube", input.loadedPerTube, "loadedPerTube must be an array");
  if (typeof input.reserveAmmunition !== "object" || input.reserveAmmunition === null)
    throwInvalid(
      input,
      "reserveAmmunition",
      input.reserveAmmunition,
      "reserveAmmunition must be a record",
    );
  const train = input.trainingLimitsMdeg;
  if (
    typeof train !== "object" ||
    train === null ||
    typeof train.min !== "number" ||
    typeof train.max !== "number"
  )
    throwInvalid(
      input,
      "trainingLimitsMdeg",
      train,
      "trainingLimitsMdeg must be { min, max } numbers",
    );
  const reloadState: TorpedoReloadState = input.reloadState ?? NO_RELOAD_IN_PROGRESS;
  return withTorpedoLauncherStateHash({
    ...s,
    reloadState,
  });
}
