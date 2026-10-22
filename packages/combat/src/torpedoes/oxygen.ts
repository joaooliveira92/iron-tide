import { BluewaveError } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { launcherFamilyMatchesTorpedo } from "./compatibility.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  OXYGEN_CHAIN_REACTION_BASE_BP,
  OXYGEN_RANGE_MULTIPLIER_BP,
  OXYGEN_SPEED_MULTIPLIER_BP,
  OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
  OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TORPEDO_PROPULSION_TYPES,
  type TorpedoPropulsionType,
} from "./constants.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export const SHIPPED_OXYGEN_EFFECTS = Object.freeze({
  rangeMultiplierBp: OXYGEN_RANGE_MULTIPLIER_BP,
  speedMultiplierBp: OXYGEN_SPEED_MULTIPLIER_BP,
  wakeDetectionMultiplierBp: OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
  tubeHitSevereFloodingMultiplierBp: OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
  chainReactionBaseBp: OXYGEN_CHAIN_REACTION_BASE_BP,
});

export interface OxygenPerformanceOutcome {
  applicable: boolean;
  rangeMultiplierBp: number;
  speedMultiplierBp: number;
  wakeDetectionMultiplierBp: number;
  declared: {
    rangeMultiplierBp: number;
    speedMultiplierBp: number;
    wakeDetectionMultiplierBp: number;
    tubeHitSevereFloodingMultiplierBp: number;
    chainReactionBaseBp: number;
  };
  incompatibility: string | null;
}

export function resolveOxygenPerformanceEffects(o: {
  model: CompiledTorpedo;
  selectedSettingId: string;
  launcherFamilyId: string;
}): OxygenPerformanceOutcome {
  if (typeof o.selectedSettingId !== "string" || o.selectedSettingId.length === 0)
    invariant("selectedSettingId", o.selectedSettingId, "selected setting id must be non-empty");
  if (typeof o.launcherFamilyId !== "string" || o.launcherFamilyId.length === 0)
    invariant("launcherFamilyId", o.launcherFamilyId, "launcher family id must be non-empty");

  const declaredSurface = {
    rangeMultiplierBp: OXYGEN_RANGE_MULTIPLIER_BP,
    speedMultiplierBp: OXYGEN_SPEED_MULTIPLIER_BP,
    wakeDetectionMultiplierBp: OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
    tubeHitSevereFloodingMultiplierBp: OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
    chainReactionBaseBp: OXYGEN_CHAIN_REACTION_BASE_BP,
  };

  if (o.model.propulsionType !== "OXYGEN") {
    return Object.freeze({
      applicable: false,
      rangeMultiplierBp: TORPEDO_BASIS_POINTS_PER_UNIT,
      speedMultiplierBp: TORPEDO_BASIS_POINTS_PER_UNIT,
      wakeDetectionMultiplierBp: TORPEDO_BASIS_POINTS_PER_UNIT,
      declared: Object.freeze(declaredSurface),
      incompatibility: "model is not an OXYGEN torpedo",
    });
  }

  const settingKnown = o.model.speedSettings.some((s) => s.settingId === o.selectedSettingId);
  const launcherKnown = launcherFamilyMatchesTorpedo(o.model, o.launcherFamilyId);
  const applicable = settingKnown && launcherKnown;
  const incompatibility = !settingKnown
    ? "selected setting is not one of the model's ordered settings"
    : !launcherKnown
      ? "launcher family is not compatible with the model"
      : null;

  return Object.freeze({
    applicable,
    rangeMultiplierBp: applicable ? OXYGEN_RANGE_MULTIPLIER_BP : TORPEDO_BASIS_POINTS_PER_UNIT,
    speedMultiplierBp: applicable ? OXYGEN_SPEED_MULTIPLIER_BP : TORPEDO_BASIS_POINTS_PER_UNIT,
    wakeDetectionMultiplierBp: applicable
      ? OXYGEN_WAKE_DETECTION_MULTIPLIER_BP
      : TORPEDO_BASIS_POINTS_PER_UNIT,
    declared: Object.freeze(declaredSurface),
    incompatibility,
  });
}

export function tubeHitPropulsionMultiplierBp(propulsionType: TorpedoPropulsionType): number {
  if (!(TORPEDO_PROPULSION_TYPES as readonly string[]).includes(propulsionType))
    invariant("propulsionType", propulsionType, "propulsion type must be canonical");
  switch (propulsionType) {
    case "COMPRESSED_AIR":
    case "WET_HEATER":
      return TORPEDO_BASIS_POINTS_PER_UNIT;
    case "OXYGEN":
      return OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP;
    case "ELECTRIC":
      return 7_500;
  }
}
