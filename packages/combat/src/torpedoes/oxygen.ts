// DESIGN-40 §23 oxygen torpedoes (INC-6, AC-18). An OXYGEN model MUST declare
// the exact shipped effects — range 15_000 bp / speed 11_000 bp /
// wake-detection 7_500 bp / tube-hit severe-flooding 15_000 bp / chain-
// reaction base 3_000 bp. The shipped §23 effects are algorithm constants in
// constants.ts (read directly here); a torpedo part carries only its per-model
// wake modifier, and the compiled record's `oxygenWakeVisibilityModifierBp` is
// the sole per-model oxygen value combat reads (ticket 13b).
//
// §23 "Performance gains MUST NOT apply when the selected setting or launcher
// is incompatible": the resolver returns the effective performance multipliers
// of a selected salvo setting + launcher family against the model. The gains
// (range/speed/wake) apply ONLY when the setting is one of the model's speed
// settings AND the launcher family is compatible with the model;
// otherwise `applicable: false` with neutral 10_000 (no-gain) multipliers and
// the exact incompatibility reason.
//
// §21 tube-hit propulsion multiplier and §22 chain base ride the compiled
// record's tubeHitHazardPolicy / propulsionType; the propulsion-multiplier
// table below is the authoritative §21 keyed-by-propulsion surface
// (COMPRESSED_AIR + WET_HEATER ordinary 10_000, OXYGEN 15_000, ELECTRIC 7_500;
// an unknown/default propulsion type fails closed — DESIGN-40 "other: explicit
// model value required").
//
// Pure/deterministic: no ambient I/O/clock/random.
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

// The shipped §23 effect surface (exact constants; the §23 effects are algorithm constants,
// never per-model data — a torpedo part carries only its wake-visibility modifier).
export const SHIPPED_OXYGEN_EFFECTS = Object.freeze({
  rangeMultiplierBp: OXYGEN_RANGE_MULTIPLIER_BP, // 15_000
  speedMultiplierBp: OXYGEN_SPEED_MULTIPLIER_BP, // 11_000
  wakeDetectionMultiplierBp: OXYGEN_WAKE_DETECTION_MULTIPLIER_BP, // 7_500
  tubeHitSevereFloodingMultiplierBp: OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP, // 15_000
  chainReactionBaseBp: OXYGEN_CHAIN_REACTION_BASE_BP, // 3_000
});

export interface OxygenPerformanceOutcome {
  // Whether the selected setting + launcher are compatible with the model —
  // the ONLY state in which the §23 performance gains apply.
  applicable: boolean;
  // The effective performance multipliers (10_000 = no gain). When not
  // applicable every multiplier is the neutral 10_000 (gains MUST NOT apply).
  rangeMultiplierBp: number;
  speedMultiplierBp: number;
  wakeDetectionMultiplierBp: number;
  // The model's declared §23 surface (the exact shipped values an OXYGEN
  // model must carry) — for audit even when not applicable.
  declared: {
    rangeMultiplierBp: number;
    speedMultiplierBp: number;
    wakeDetectionMultiplierBp: number;
    tubeHitSevereFloodingMultiplierBp: number;
    chainReactionBaseBp: number;
  };
  incompatibility: string | null; // the exact reason when not applicable
}

// AC-18: "gains only when the selected setting/launcher is compatible".
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

// AUTHORITATIVE §21 propulsion multiplier surface keyed by propulsion type
// (ordinary compressed air + wet heater 10_000, oxygen 15_000, electric
// 7_500; every other propulsion type fails closed — §21 "other: explicit
// model value required"). The OXYGEN row reuses the §23 shipped severe-
// flooding multiplier so the two surfaces can never drift.
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
