import {
  SMOKESCREEN_INITIAL_DENSITY,
  SMOKESCREEN_VERTICAL_EXTENT_M,
  SMOKESCREEN_GENERATION_DURATION_MINUTES,
  SMOKESCREEN_COOLDOWN_MINUTES,
} from "./constants.js";
import { SMOKESCREEN_GENERATION_INTERRUPTED } from "./reasonCodes.js";
import { createSmokeCloud } from "./model.js";
import type { SmokeCloud } from "./model.js";

export const SMOKESCREEN_ELIGIBLE_CLASSES = ["DD", "CL"] as const;
export type SmokescreenEligibleClass = (typeof SMOKESCREEN_ELIGIBLE_CLASSES)[number];

export const SMOKESCREEN_READINESS_STATES = [
  "ACTIVE",
  "MOBILIZING",
  "WORKING_UP",
  "IN_RESERVE",
] as const;
export type SmokescreenReadiness = (typeof SMOKESCREEN_READINESS_STATES)[number];

export type SmokescreenDamageState =
  | "OPERATIONAL"
  | "DEGRADED"
  | "SINKING"
  | "DEAD_IN_WATER"
  | "ABANDONED";

export type SmokescreenCommandAuthority = "GRANTED" | "DENIED";

export const SMOKESCREEN_PROHIBITED_MISSIONS = ["STEALTH_RECON", "COVERT_TRANSPORT"] as const;
export type SmokescreenProhibitedMission = (typeof SMOKESCREEN_PROHIBITED_MISSIONS)[number];

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

export interface SmokescreenEligibilityVerdict {
  eligible: boolean;
  reason?: string;
}

export interface SmokescreenState {
  generating: boolean;
  cooldownRemainingMinutes: number;
  chargesRemaining: number;
  generationStartMinute: number;
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

export interface SmokescreenCooldownResult {
  available: boolean;
  remainingMinutes: number;
}

export function checkSmokescreenCooldown(
  lastGenerationMinute: number,
  currentMinute: number,
): SmokescreenCooldownResult {
  if (lastGenerationMinute < 0) {
    return { available: true, remainingMinutes: 0 };
  }

  const elapsed = currentMinute - lastGenerationMinute;
  const remaining = Math.max(0, SMOKESCREEN_COOLDOWN_MINUTES - elapsed);
  return {
    available: remaining <= 0,
    remainingMinutes: remaining,
  };
}

export interface GenerateSmokescreenMinuteParams {
  shipState: SmokescreenEligibilityParams;
  smokescreenState: SmokescreenState;
  currentMinute: number;
  substep: number;

  cloudId: string;
  owner: string;

  centroidPosition: [number, number];
  driftVector: [number, number];
  expansionRate: number;
  densityDecayRate: number;
  fuelComposition: string;

  earlyEndCheck?: () => { endEarly: false } | { endEarly: true; reason: string };
}

export interface GenerateSmokescreenMinuteResult {
  cloud: SmokeCloud | null;
  newState: SmokescreenState;
  interrupted: boolean;
  interruptionReason?: string;
}

export function generateSmokescreenMinute(
  params: GenerateSmokescreenMinuteParams,
): GenerateSmokescreenMinuteResult {
  const { shipState, smokescreenState, currentMinute, substep } = params;

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

  const generationElapsed = currentMinute - smokescreenState.generationStartMinute;
  if (generationElapsed >= SMOKESCREEN_GENERATION_DURATION_MINUTES) {
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

export function smokescreenConcealmentBonusBp(cloud: SmokeCloud): number {
  if (!cloud.active || cloud.densityBp < 1) {
    return 0;
  }
  return Math.max(0, Math.min(10_000, cloud.densityBp));
}
