//packages/combat/src/smoke/model.ts
import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  SMOKE_RULESET_VERSION,
  SMOKE_FORMULA_VERSION,
  SMOKE_SOURCE_TYPES,
  type SmokeSourceType,
} from "./constants.js";
import { INVALID_SMOKE_CLOUD } from "./reasonCodes.js";

function smokeInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(INVALID_SMOKE_CLOUD, {
    code: INVALID_SMOKE_CLOUD,
    field,
    reason,
  });
}

export interface SmokeCloud {
  readonly smokeCloudId: string;
  readonly sourceType: SmokeSourceType;
  readonly sourceId: string;
  readonly owner: string;
  readonly creationMinute: number;
  readonly creationSubstep: number;
  readonly centroidPosition: [number, number];
  readonly densityBp: number;
  readonly verticalExtentM: number;
  readonly driftVector: [number, number];
  readonly expansionRate: number;
  readonly densityDecayRate: number;
  readonly fuelComposition: string;
  readonly active: boolean;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly cloudHash: string;
}

export function smokeCloudHash(params: {
  sourceType: SmokeSourceType;
  sourceId: string;
  owner: string;
  creationMinute: number;
  creationSubstep: number;
  centroidPosition: [number, number];
  densityBp: number;
  verticalExtentM: number;
  driftVector: [number, number];
  expansionRate: number;
  densityDecayRate: number;
  fuelComposition: string;
  active: boolean;
}): string {
  return createEnvelope("smoke/cloud", SMOKE_RULESET_VERSION, {
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    owner: params.owner,
    creationMinute: params.creationMinute,
    creationSubstep: params.creationSubstep,
    centroidPosition: params.centroidPosition,
    densityBp: params.densityBp,
    verticalExtentM: params.verticalExtentM,
    driftVector: params.driftVector,
    expansionRate: params.expansionRate,
    densityDecayRate: params.densityDecayRate,
    fuelComposition: params.fuelComposition,
    active: params.active,
  }).bodyHash;
}

export function createSmokeCloud(params: {
  smokeCloudId: string;
  sourceType: string;
  sourceId: string;
  owner: string;
  creationMinute: number;
  creationSubstep: number;
  centroidPosition: [number, number];
  densityBp: number;
  verticalExtentM: number;
  driftVector: [number, number];
  expansionRate: number;
  densityDecayRate: number;
  fuelComposition: string;
  active: boolean;
}): SmokeCloud {
  if (!(SMOKE_SOURCE_TYPES as readonly string[]).includes(params.sourceType)) {
    smokeInvariant(
      params.sourceType,
      "sourceType",
      `unknown smoke source type: ${params.sourceType}`,
    );
  }

  if (params.densityBp < 1 || params.densityBp > 10_000) {
    smokeInvariant(
      params.densityBp,
      "densityBp",
      `density out of range [1, 10000]: ${params.densityBp}`,
    );
  }

  const pos = params.centroidPosition;
  if (
    !Array.isArray(pos) ||
    pos.length !== 2 ||
    typeof pos[0] !== "number" ||
    typeof pos[1] !== "number"
  ) {
    smokeInvariant(pos, "centroidPosition", `centroid position must be a [number, number] tuple`);
  }

  if (params.verticalExtentM <= 0) {
    smokeInvariant(
      params.verticalExtentM,
      "verticalExtentM",
      `vertical extent must be positive: ${params.verticalExtentM}`,
    );
  }

  const cloudHash = smokeCloudHash({
    sourceType: params.sourceType as SmokeSourceType,
    sourceId: params.sourceId,
    owner: params.owner,
    creationMinute: params.creationMinute,
    creationSubstep: params.creationSubstep,
    centroidPosition: params.centroidPosition,
    densityBp: params.densityBp,
    verticalExtentM: params.verticalExtentM,
    driftVector: params.driftVector,
    expansionRate: params.expansionRate,
    densityDecayRate: params.densityDecayRate,
    fuelComposition: params.fuelComposition,
    active: params.active,
  });

  return {
    smokeCloudId: params.smokeCloudId,
    sourceType: params.sourceType as SmokeSourceType,
    sourceId: params.sourceId,
    owner: params.owner,
    creationMinute: params.creationMinute,
    creationSubstep: params.creationSubstep,
    centroidPosition: params.centroidPosition,
    densityBp: params.densityBp,
    verticalExtentM: params.verticalExtentM,
    driftVector: params.driftVector,
    expansionRate: params.expansionRate,
    densityDecayRate: params.densityDecayRate,
    fuelComposition: params.fuelComposition,
    active: params.active,
    rulesetVersion: SMOKE_RULESET_VERSION,
    formulaVersion: SMOKE_FORMULA_VERSION,
    cloudHash,
  };
}
