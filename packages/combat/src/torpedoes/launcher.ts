// DESIGN-40 §2/§4/§8 launcher surface. TorpedoLauncherDefinition is the static
// launcher-family content the compatibility predicates (§4) and reload (§3)
// consult; createTorpedoLauncherState is the construction boundary of the
// authoritative TorpedoLauncherState (state.ts). Structurally-invalid launcher
// state input fails at the construction boundary with INVALID_TORPEDO_LAUNCHER_STATE;
// value-level invariant violations fail through the guard with
// TORPEDO_STATE_INVARIANT_FAILED. Pure/deterministic: no ambient I/O/clock/random.
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

// DESIGN-40 §2 static launcher-family definition consulted by §3 reload and §4
// compatibility. §8: an above-water launcher family MAY declare a narrower
// maximum launch speed than the shipped 30 kn fixed / 35 kn trainable defaults
// (null -> shipped default; enforcement is INC-2's launch-legality surface).
export interface TorpedoLauncherDefinition {
  launcherFamilyId: string;
  mountType: TorpedoMountType;
  tubeCount: number; // integer >= 1
  boreDiameterMm: number; // integer mm the torpedo diameter must fit
  handlingMassLimitKg: number; // integer kg launcher + handling limit
  supportedPropulsionTypes: readonly TorpedoPropulsionType[]; // propulsion/safety support
  fireControlSupportedGuidance: readonly string[]; // guidance capability ids the fire control supports
  underwaterLaunchCapability: boolean;
  requiredReloadTimeMs: number; // integer ms per §3 reload
  aboveWaterMaxLaunchSpeedKnots: number | null; // narrower §8 value, or null for the shipped default
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

// Fail-closed validation of the static launcher definition surface.
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

// DESIGN-40 §8 resolution: the exact maximum launch speed (integer knots) for an
// above-water launcher — a declared narrower value wins, else the shipped
// fixed 30 kn / trainable 35 kn default (DESIGN-40 §8: "The shipped default
// is …" — DEFAULTS APPLY WHEN UNSPECIFIED; a null declared value on an
// above-water mount is NOT missing metadata). Returns null when §8 does not
// apply (underwater/submarine mounts are governed by §7 / model-specific
// limits) — that null reaching the §8 gate fails closed with
// TORPEDO_LAUNCH_SPEED_LIMIT_MISSING (never silently unlimited).
export function resolvedAboveWaterMaxLaunchSpeedKnots(d: TorpedoLauncherDefinition): number | null {
  if (d.aboveWaterMaxLaunchSpeedKnots !== null) return d.aboveWaterMaxLaunchSpeedKnots;
  if (d.mountType === "ABOVE_WATER_FIXED") return ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS;
  if (d.mountType === "ABOVE_WATER_TRAINABLE") return ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS;
  return null;
}

// DESIGN-40 §2 construction boundary. Every field must be present with a valid
// shape; a structurally-invalid input fails with INVALID_TORPEDO_LAUNCHER_STATE
// (never a silent default). The built state is fully validated and hash-computed
// (value-level violations surface as TORPEDO_STATE_INVARIANT_FAILED through
// withTorpedoLauncherStateHash). Reversible: a failure leaves the input untouched.
export function createTorpedoLauncherState(input: {
  launcherId: string;
  ownerPlatformId: string;
  launcherFamilyId: string;
  mountPosition: string;
  mountType: TorpedoMountType;
  tubeCount: number;
  // Torpedo model id per tube or the canonical EMPTY_TUBE marker; enforced at
  // runtime by assertFixedPointTorpedo.
  loadedPerTube: readonly string[];
  reserveAmmunition: Record<string, number>;
  reloadState?: TorpedoReloadState;
  trainingLimitsMdeg: { min: number; max: number };
  underwaterLaunchCapability: boolean;
  fireControlConnectionState: FireControlConnectionState;
  damageState: LauncherDamageState;
  floodingIsolationState: FloodingIsolationState;
  // Fire-solution id or the canonical NO_FIRE_SOLUTION marker; enforced at runtime.
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
