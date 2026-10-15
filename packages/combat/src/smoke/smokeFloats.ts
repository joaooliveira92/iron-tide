// DESIGN-42 §§17-19: smoke float deployment logic.

import { createEnvelope } from "@bluewave/deterministic";
import {
  SMOKE_FLOAT_INITIAL_DENSITY,
  SMOKE_FLOAT_MAX_DEPLOYMENT_SPEED_KT,
  SMOKE_DOCTRINE_ADOPTION_MONTHS,
  SMOKE_RULESET_VERSION,
} from "./constants.js";
import {
  SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE,
  SMOKE_FLOAT_CAPACITY_MISSING,
  SMOKE_FLOAT_INVENTORY_EMPTY,
  SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED,
} from "./reasonCodes.js";
import { createSmokeCloud, type SmokeCloud } from "./model.js";

export interface SmokeFloatState {
  readonly remainingFloats: number;
  readonly capacity: number;
  readonly deploymentInProgress: boolean;
  readonly equipmentMode: "NONE" | "FLOATS" | "GENERATOR";
}

export interface CanDeploySmokeFloatParams {
  shipClass: string;
  smokeFloatTechnologyDiscovered: boolean;
  doctrineAdoptedMonths: number;
  storageAndDeploymentInstalled: boolean;
  remainingFloats: number;
  currentSpeedKt: number;
  deploymentAlreadyThisSubstep: boolean;
  tacticalPositionLegal: boolean;
  equipmentMode: "NONE" | "FLOATS" | "GENERATOR";
}

export interface CanDeploySmokeFloatResult {
  eligible: boolean;
  reason?: string;
}

export function canDeploySmokeFloat(params: CanDeploySmokeFloatParams): CanDeploySmokeFloatResult {
  // Ship class must be CL
  if (params.shipClass !== "CL") {
    return { eligible: false, reason: "SHIP_CLASS_MISMATCH" };
  }

  // smoke_float_operations technology discovered
  if (!params.smokeFloatTechnologyDiscovered) {
    return { eligible: false, reason: SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE };
  }

  // Doctrine adopted (3 paid months)
  if (params.doctrineAdoptedMonths < SMOKE_DOCTRINE_ADOPTION_MONTHS) {
    return { eligible: false, reason: SMOKE_FLOAT_CAPACITY_MISSING };
  }

  // Smoke-float storage and deployment equipment installed
  if (!params.storageAndDeploymentInstalled) {
    return { eligible: false, reason: SMOKE_FLOAT_CAPACITY_MISSING };
  }

  // At least one float loaded
  if (params.remainingFloats < 1) {
    return { eligible: false, reason: SMOKE_FLOAT_INVENTORY_EMPTY };
  }

  // Speed ≤ 25 knots
  if (params.currentSpeedKt > SMOKE_FLOAT_MAX_DEPLOYMENT_SPEED_KT) {
    return { eligible: false, reason: SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED };
  }

  // No deployment already occurring this substep
  if (params.deploymentAlreadyThisSubstep) {
    return { eligible: false, reason: "DEPLOYMENT_ALREADY_IN_PROGRESS" };
  }

  // Legal tactical position
  if (!params.tacticalPositionLegal) {
    return { eligible: false, reason: "ILLEGAL_TACTICAL_POSITION" };
  }

  // Equipment mode is FLOATS (not GENERATOR)
  if (params.equipmentMode !== "FLOATS") {
    return { eligible: false, reason: "SMOKE_EQUIPMENT_MODE_CONFLICT" };
  }

  return { eligible: true };
}

export interface DeploySmokeFloatResult {
  cloud: SmokeCloud;
  remainingFloats: number;
}

export function deploySmokeFloat(
  shipPosition: [number, number],
  remainingFloats: number,
  sourceId: string,
  owner: string,
  currentMinute: number,
  currentSubstep: number,
): DeploySmokeFloatResult {
  // Place float at stern position: offset 50m aft on the Y axis
  const sternPosition: [number, number] = [shipPosition[0], shipPosition[1] - 50];

  const floatId = createEnvelope("smoke/float", SMOKE_RULESET_VERSION, {
    sourceId,
    minute: currentMinute,
    substep: currentSubstep,
  }).bodyHash;

  const cloud = createSmokeCloud({
    smokeCloudId: `float-${floatId}`,
    sourceType: "FLOAT",
    sourceId,
    owner,
    creationMinute: currentMinute,
    creationSubstep: currentSubstep,
    centroidPosition: sternPosition,
    densityBp: SMOKE_FLOAT_INITIAL_DENSITY,
    verticalExtentM: 50,
    driftVector: [0, 0],
    expansionRate: 0,
    densityDecayRate: 0,
    fuelComposition: "smoke_float",
    active: true,
  });

  return {
    cloud,
    remainingFloats: remainingFloats - 1,
  };
}
