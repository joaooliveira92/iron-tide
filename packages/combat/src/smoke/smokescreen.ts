//packages/combat/src/smoke/smokescreen.ts
// DESIGN-42 §§12-16: smokescreen eligibility, generation, cooldown, and
// tactical effects. Pure/deterministic: no ambient I/O/clock/random.

import {
  SMOKESCREEN_INITIAL_DENSITY,
  SMOKESCREEN_VERTICAL_EXTENT_M,
  SMOKESCREEN_GENERATION_DURATION_MINUTES,
  SMOKESCREEN_COOLDOWN_MINUTES,
} from "./constants.js";
import { SMOKESCREEN_GENERATION_INTERRUPTED } from "./reasonCodes.js";
import { createSmokeCloud } from "./model.js";
import type { SmokeCloud } from "./model.js";

// ---------------------------------------------------------------------------
// §12 ship-state input types for smokescreen eligibility
// ---------------------------------------------------------------------------

/** Canonical smokescreen-eligible ship classes per DESIGN-42 §12. */
export const SMOKESCREEN_ELIGIBLE_CLASSES = ["DD", "CL"] as const;
export type SmokescreenEligibleClass = (typeof SMOKESCREEN_ELIGIBLE_CLASSES)[number];

/** Readiness states relevant to smokescreen eligibility. */
export const SMOKESCREEN_READINESS_STATES = [
  "ACTIVE",
  "MOBILIZING",
  "WORKING_UP",
  "IN_RESERVE",
] as const;
export type SmokescreenReadiness = (typeof SMOKESCREEN_READINESS_STATES)[number];

/** Damage states relevant to smokescreen eligibility. */
export type SmokescreenDamageState =
  | "OPERATIONAL"
  | "DEGRADED"
  | "SINKING"
  | "DEAD_IN_WATER"
  | "ABANDONED";

/** Command authority decision. */
export type SmokescreenCommandAuthority = "GRANTED" | "DENIED";

/** Tactical mission flags that may prohibit smoke. */
export const SMOKESCREEN_PROHIBITED_MISSIONS = ["STEALTH_RECON", "COVERT_TRANSPORT"] as const;
export type SmokescreenProhibitedMission = (typeof SMOKESCREEN_PROHIBITED_MISSIONS)[number];

/**
 * §12 input surface: every predicate input as an explicit typed field.
 * Mirror pattern from minesweeping-eligibility.ts.
 */
export interface SmokescreenEligibilityParams {
  shipId: string;
  shipClass: string;
  smokeEquipmentInstalled: boolean;
  smokeEquipmentOperational: boolean;
  consumableAvailable: boolean;
  readiness: SmokescreenReadiness;
  damageState: SmokescreenDamageState;
  currentSpeedKnots: number;
  cooldownActive: boolean;
  commandAuthority: SmokescreenCommandAuthority;
  missionProhibitsSmoke: boolean;
}

// ---------------------------------------------------------------------------
// §12 predicate names and stable reason strings
// ---------------------------------------------------------------------------

export type SmokescreenEligibilityPredicate =
  | "shipClassEligible"
  | "equipmentInstalledAndOperational"
  | "consumableAvailable"
  | "readinessActive"
  | "damageStateOperationalOrDegraded"
  | "notSinkingOrDeadOrAbandoned"
  | "speedAtLeast5Knots"
  | "cooldownNotActive"
  | "commandAuthorityGranted"
  | "missionAllowsSmoke";

export const SMOKESCREEN_INELIGIBILITY_REASONS: Readonly<
  Record<SmokescreenEligibilityPredicate, string>
> = {
  shipClassEligible: "ship class is not DD or CL (§12)",
  equipmentInstalledAndOperational:
    "smoke-generation equipment is not installed or not operational (§12)",
  consumableAvailable: "smoke consumable or generator fuel is not available (§12)",
  readinessActive: "ship readiness is not ACTIVE (§12)",
  damageStateOperationalOrDegraded: "damage state is below OPERATIONAL/DEGRADED (§12)",
  notSinkingOrDeadOrAbandoned: "ship is sinking, dead in water, or abandoned (§12)",
  speedAtLeast5Knots: "ship speed is below 5 knots (§12)",
  cooldownNotActive: "smokescreen cooldown is active (§12)",
  commandAuthorityGranted: "command authority denied (§12)",
  missionAllowsSmoke: "tactical mission prohibits smoke (§12)",
};

// ---------------------------------------------------------------------------
// §12 eligibility verdict
// ---------------------------------------------------------------------------

export interface SmokescreenEligibilityVerdict {
  eligible: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// §13 smokescreen generation state
// ---------------------------------------------------------------------------

export interface SmokescreenState {
  /** Whether a smokescreen generation is currently in progress. */
  generating: boolean;
  /** Cooldown remaining in minutes for the next generation. */
  cooldownRemainingMinutes: number;
  /** Charges remaining (for generator-based smoke). */
  chargesRemaining: number;
  /** The game minute when the current generation started (-1 if not generating). */
  generationStartMinute: number;
  /** The minute at which cooldown started (-1 if not in cooldown). */
  cooldownStartMinute: number;
}

export function createInitialSmokescreenState(charges: number = 3): SmokescreenState {
  return {
    generating: false,
    cooldownRemainingMinutes: 0,
    chargesRemaining: charges,
    generationStartMinute: -1,
    cooldownStartMinute: -1,
  };
}

// ---------------------------------------------------------------------------
// §12 isShipEligibleForSmokescreen
// ---------------------------------------------------------------------------

/**
 * Check all 10 smokescreen eligibility predicates per DESIGN-42 §12.
 * Returns `{ eligible: boolean; reason?: string }`.
 * When ineligible, `reason` carries the stable reason code.
 */
export function isShipEligibleForSmokescreen(
  params: SmokescreenEligibilityParams,
): SmokescreenEligibilityVerdict {
  const predicates: [SmokescreenEligibilityPredicate, boolean][] = [
    [
      "shipClassEligible",
      (SMOKESCREEN_ELIGIBLE_CLASSES as readonly string[]).includes(params.shipClass),
    ],
    [
      "equipmentInstalledAndOperational",
      params.smokeEquipmentInstalled && params.smokeEquipmentOperational,
    ],
    ["consumableAvailable", params.consumableAvailable === true],
    ["readinessActive", params.readiness === "ACTIVE"],
    // Check sinking/dead/abandoned before operational/degraded so the more
    // specific reason is returned first for these states.
    [
      "notSinkingOrDeadOrAbandoned",
      params.damageState !== "SINKING" &&
        params.damageState !== "DEAD_IN_WATER" &&
        params.damageState !== "ABANDONED",
    ],
    [
      "damageStateOperationalOrDegraded",
      params.damageState === "OPERATIONAL" || params.damageState === "DEGRADED",
    ],
    ["speedAtLeast5Knots", params.currentSpeedKnots >= 5],
    ["cooldownNotActive", params.cooldownActive !== true],
    ["commandAuthorityGranted", params.commandAuthority === "GRANTED"],
    ["missionAllowsSmoke", params.missionProhibitsSmoke !== true],
  ];

  for (const [predicate, passes] of predicates) {
    if (!passes) {
      return { eligible: false, reason: SMOKESCREEN_INELIGIBILITY_REASONS[predicate] };
    }
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// §13 computeSmokescreenSegment
// ---------------------------------------------------------------------------

/**
 * Create a smoke cloud segment at the ship's current position with the
 * standard smokescreen parameters (§13).
 */
export function computeSmokescreenSegment(params: {
  smokeCloudId: string;
  sourceId: string;
  owner: string;
  creationMinute: number;
  creationSubstep: number;
  centroidPosition: [number, number];
  driftVector: [number, number];
  expansionRate: number;
  densityDecayRate: number;
  fuelComposition: string;
}): SmokeCloud {
  return createSmokeCloud({
    smokeCloudId: params.smokeCloudId,
    sourceType: "SMOKESCREEN" as const,
    sourceId: params.sourceId,
    owner: params.owner,
    creationMinute: params.creationMinute,
    creationSubstep: params.creationSubstep,
    centroidPosition: params.centroidPosition,
    densityBp: SMOKESCREEN_INITIAL_DENSITY,
    verticalExtentM: SMOKESCREEN_VERTICAL_EXTENT_M,
    driftVector: params.driftVector,
    expansionRate: params.expansionRate,
    densityDecayRate: params.densityDecayRate,
    fuelComposition: params.fuelComposition,
    active: true,
  });
}

// ---------------------------------------------------------------------------
// §14 checkSmokescreenCooldown
// ---------------------------------------------------------------------------

export interface SmokescreenCooldownResult {
  available: boolean;
  remainingMinutes: number;
}

/**
 * Check if the smokescreen cooldown has elapsed (20 minutes from first
 * emission per DESIGN-42 §14 / SMOKESCREEN_COOLDOWN_MINUTES).
 */
export function checkSmokescreenCooldown(
  lastGenerationMinute: number,
  currentMinute: number,
): SmokescreenCooldownResult {
  if (lastGenerationMinute < 0) {
    // No previous generation — cooldown is trivially available.
    return { available: true, remainingMinutes: 0 };
  }

  const elapsed = currentMinute - lastGenerationMinute;
  const remaining = Math.max(0, SMOKESCREEN_COOLDOWN_MINUTES - elapsed);
  return {
    available: remaining <= 0,
    remainingMinutes: remaining,
  };
}

// ---------------------------------------------------------------------------
// §13 generateSmokescreenMinute
// ---------------------------------------------------------------------------

export interface GenerateSmokescreenMinuteParams {
  shipState: SmokescreenEligibilityParams;
  smokescreenState: SmokescreenState;
  currentMinute: number;
  substep: number;

  /** Unique cloud id to assign if a cloud is created. */
  cloudId: string;
  owner: string;

  centroidPosition: [number, number];
  driftVector: [number, number];
  expansionRate: number;
  densityDecayRate: number;
  fuelComposition: string;

  /** A callback invoked each minute to check whether generation should end early.
   *  When truthy (with a reason) the generation is interrupted. */
  earlyEndCheck?: () => { endEarly: false } | { endEarly: true; reason: string };
}

export interface GenerateSmokescreenMinuteResult {
  cloud: SmokeCloud | null;
  newState: SmokescreenState;
  interrupted: boolean;
  interruptionReason?: string;
}

/**
 * Generate one minute of smokescreen output, returning a SmokeCloud if
 * eligible. Handles early end conditions per §13:
 *   - ship becomes ineligible
 *   - equipment disabled
 *   - consumable exhausted
 *   - command cancelled
 *   - ship sinks / leaves area
 */
export function generateSmokescreenMinute(
  params: GenerateSmokescreenMinuteParams,
): GenerateSmokescreenMinuteResult {
  const { shipState, smokescreenState, currentMinute, substep } = params;

  // --- Early end: check eligibility each minute ---
  const eligibilityCheck = isShipEligibleForSmokescreen(shipState);
  if (!eligibilityCheck.eligible) {
    return {
      cloud: null,
      newState: {
        ...smokescreenState,
        generating: false,
        cooldownStartMinute: currentMinute,
        cooldownRemainingMinutes: SMOKESCREEN_COOLDOWN_MINUTES,
      },
      interrupted: true,
      interruptionReason: SMOKESCREEN_GENERATION_INTERRUPTED,
    };
  }

  // --- Early end: caller-provided check ---
  if (params.earlyEndCheck) {
    const earlyEnd = params.earlyEndCheck();
    if (earlyEnd.endEarly) {
      return {
        cloud: null,
        newState: {
          ...smokescreenState,
          generating: false,
          cooldownStartMinute: currentMinute,
          cooldownRemainingMinutes: SMOKESCREEN_COOLDOWN_MINUTES,
        },
        interrupted: true,
        interruptionReason: earlyEnd.reason,
      };
    }
  }

  // --- Duration check ---
  const generationElapsed = currentMinute - smokescreenState.generationStartMinute;
  if (generationElapsed >= SMOKESCREEN_GENERATION_DURATION_MINUTES) {
    // Generation complete — enter cooldown.
    return {
      cloud: null,
      newState: {
        ...smokescreenState,
        generating: false,
        cooldownStartMinute: currentMinute,
        cooldownRemainingMinutes: SMOKESCREEN_COOLDOWN_MINUTES,
      },
      interrupted: false,
    };
  }

  // --- Create the smoke cloud segment ---
  const cloud = computeSmokescreenSegment({
    smokeCloudId: params.cloudId,
    sourceId: shipState.shipId,
    owner: params.owner,
    creationMinute: currentMinute,
    creationSubstep: substep,
    centroidPosition: params.centroidPosition,
    driftVector: params.driftVector,
    expansionRate: params.expansionRate,
    densityDecayRate: params.densityDecayRate,
    fuelComposition: params.fuelComposition,
  });

  // Update state: consuming a charge on the first minute only.
  const chargesUsed = smokescreenState.generationStartMinute === currentMinute ? 1 : 0;

  return {
    cloud,
    newState: {
      ...smokescreenState,
      generating: true,
      chargesRemaining: Math.max(0, smokescreenState.chargesRemaining - chargesUsed),
      cooldownRemainingMinutes: 0,
    },
    interrupted: false,
  };
}

// ---------------------------------------------------------------------------
// §16 smokescreen tactical effect helpers
// ---------------------------------------------------------------------------

/**
 * Returns the effective concealment bonus (in basis points) that a smokescreen
 * provides. Per DESIGN-42 §16 the bonus is proportional to cloud density.
 */
export function smokescreenConcealmentBonusBp(cloud: SmokeCloud): number {
  if (!cloud.active || cloud.densityBp < 1) {
    return 0;
  }
  // §16: concealment bonus = cloud density bp (clamped to [0, 10_000]).
  return Math.max(0, Math.min(10_000, cloud.densityBp));
}
