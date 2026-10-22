import { createEnvelope } from "@bluewave/deterministic";
import {
  SMOKE_GENERATOR_COOLDOWN_MINUTES,
  SMOKE_GENERATOR_INITIAL_DENSITY,
  SMOKE_DOCTRINE_ADOPTION_MONTHS,
  SMOKE_RULESET_VERSION,
} from "./constants.js";
import {
  SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE,
  SMOKE_GENERATOR_CHARGES_EMPTY,
  SMOKESCREEN_COOLDOWN_ACTIVE,
} from "./reasonCodes.js";
import { createSmokeCloud, type SmokeCloud } from "./model.js";

export interface SmokeGeneratorState {
  readonly remainingCharges: number;
  readonly maxCharges: number;
  readonly cooldownUntilMinute: number;
  readonly installed: boolean;
  readonly equipmentMode: "NONE" | "FLOATS" | "GENERATOR";
}

export interface CanActivateSmokeGeneratorParams {
  generatorTechnologyDiscovered: boolean;
  generatorInstalledAndOperational: boolean;
  remainingCharges: number;
  cooldownActive: boolean;
  cooldownUntilMinute: number;
  currentMinute: number;
  doctrineAdoptedMonths: number;
}

export interface CanActivateSmokeGeneratorResult {
  eligible: boolean;
  reason?: string;
}

export function canActivateSmokeGenerator(
  params: CanActivateSmokeGeneratorParams,
): CanActivateSmokeGeneratorResult {
  if (!params.generatorTechnologyDiscovered) {
    return { eligible: false, reason: SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE };
  }

  if (!params.generatorInstalledAndOperational) {
    return { eligible: false, reason: "GENERATOR_NOT_INSTALLED" };
  }

  if (params.remainingCharges < 1) {
    return { eligible: false, reason: SMOKE_GENERATOR_CHARGES_EMPTY };
  }

  if (params.cooldownActive) {
    return { eligible: false, reason: SMOKESCREEN_COOLDOWN_ACTIVE };
  }

  if (params.doctrineAdoptedMonths < SMOKE_DOCTRINE_ADOPTION_MONTHS) {
    return { eligible: false, reason: SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE };
  }

  return { eligible: true };
}

export interface ActivateSmokeGeneratorResult {
  cloud: SmokeCloud;
  nextCharges: number;
  cooldownUntilMinute: number;
}

export function activateSmokeGenerator(
  shipPosition: [number, number],
  remainingCharges: number,
  currentMinute: number,
  currentSubstep: number,
  sourceId: string,
  owner: string,
): ActivateSmokeGeneratorResult {
  const genId = createEnvelope("smoke/generator", SMOKE_RULESET_VERSION, {
    sourceId,
    minute: currentMinute,
    substep: currentSubstep,
  }).bodyHash;

  const cloud = createSmokeCloud({
    smokeCloudId: `generator-${genId}`,
    sourceType: "GENERATOR",
    sourceId,
    owner,
    creationMinute: currentMinute,
    creationSubstep: currentSubstep,
    centroidPosition: shipPosition,
    densityBp: SMOKE_GENERATOR_INITIAL_DENSITY,
    verticalExtentM: 100,
    driftVector: [0, 0],
    expansionRate: 0,
    densityDecayRate: 0,
    fuelComposition: "smoke_generator",
    active: true,
  });

  return {
    cloud,
    nextCharges: remainingCharges - 1,
    cooldownUntilMinute: currentMinute + SMOKE_GENERATOR_COOLDOWN_MINUTES,
  };
}
