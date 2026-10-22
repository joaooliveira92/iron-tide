import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  SUBMARINE_MISSIONS,
  SUBMARINE_POLICIES,
  submarineMissionsPolicyId,
  type BaseProximityBand,
  type SubmarineMission,
} from "./constants.js";
import {
  submarineTypeDefinitionById,
  SUBMARINE_REMOTE_EFFICIENCY_BP,
  type SubmarineStrategicAsset,
  type SubmarineTypeDefinition,
} from "./model.js";
import {
  SUBMARINE_MISSION_INELIGIBLE,
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_STATE_INVARIANT_FAILED,
  type SubmarineReasonCode,
} from "./reasonCodes.js";
import {
  SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR,
  SUBMARINE_RELIABILITY_LOW_OPERATIONS,
} from "./reliability.js";

export interface SubmarineMissionDefinition {
  missionId: SubmarineMission;
  topicLabel: string;
  missionPriority: SafeInt;
  contentVersion: string;
  contentHash: string;
}

function missionInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
    code: SUBMARINE_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function assertSubmarineMissionDefinitionSurface(def: SubmarineMissionDefinition): void {
  if (!(SUBMARINE_MISSIONS as readonly string[]).includes(def.missionId))
    missionInvariant(def.missionId, "missionId", "must be a canonical §6 mission");
  if (!isNonEmptyString(def.topicLabel))
    missionInvariant(def.topicLabel, "topicLabel", "topic label must be non-empty");
  if (
    typeof def.missionPriority !== "number" ||
    !Number.isInteger(def.missionPriority) ||
    !Number.isSafeInteger(def.missionPriority) ||
    def.missionPriority < 1
  )
    missionInvariant(def.missionPriority, "missionPriority", "§26.4 priority > 0 integer required");
  if (def.contentVersion !== submarineMissionsPolicyId)
    missionInvariant(def.contentVersion, "contentVersion", "mission content version");
}

export function validateSubmarineMissionDefinition(def: SubmarineMissionDefinition): void {
  assertSubmarineMissionDefinitionSurface(def);
  if (!isNonEmptyString(def.contentHash))
    missionInvariant(def.contentHash, "contentHash", "content hash must be non-empty");
}

export function computeSubmarineMissionContentHash(
  def: Omit<SubmarineMissionDefinition, "contentHash">,
): string {
  const { contentHash: _ignored, ...surface } = def as SubmarineMissionDefinition;
  return createEnvelope("submarine-mission", submarineMissionsPolicyId, surface).bodyHash;
}

export function withSubmarineMissionContentHash(
  def: Omit<SubmarineMissionDefinition, "contentHash">,
): SubmarineMissionDefinition {
  assertSubmarineMissionDefinitionSurface(def as SubmarineMissionDefinition);
  return { ...def, contentHash: computeSubmarineMissionContentHash(def) };
}

export function verifySubmarineMissionContentHash(def: SubmarineMissionDefinition): boolean {
  return computeSubmarineMissionContentHash(def) === def.contentHash;
}

export const SHIPPED_SUBMARINE_MISSION_DEFINITIONS: readonly SubmarineMissionDefinition[] = [
  withSubmarineMissionContentHash({
    missionId: "MISSILE_PATROL",
    topicLabel: "Strategic missile patrol",
    missionPriority: SafeInt(1),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "FLEET_INTERDICTION",
    topicLabel: "Fleet interdiction",
    missionPriority: SafeInt(2),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "MERCHANT_RAIDING",
    topicLabel: "Merchant raiding",
    missionPriority: SafeInt(3),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "TACTICAL_BATTLE_SUPPORT",
    topicLabel: "Tactical battle support",
    missionPriority: SafeInt(4),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "RETURNING_SHIP_INTERCEPTION",
    topicLabel: "Returning ship interception",
    missionPriority: SafeInt(5),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "RECONNAISSANCE",
    topicLabel: "Reconnaissance",
    missionPriority: SafeInt(6),
    contentVersion: submarineMissionsPolicyId,
  }),
  withSubmarineMissionContentHash({
    missionId: "MINE_LAYING",
    topicLabel: "Submarine-laid mine laying",
    missionPriority: SafeInt(7),
    contentVersion: submarineMissionsPolicyId,
  }),
];

export function submarineMissionById(missionId: string): SubmarineMissionDefinition {
  const def = SHIPPED_SUBMARINE_MISSION_DEFINITIONS.find((m) => m.missionId === missionId);
  if (!def) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "unknown mission id — no shipped definition for this mission",
      value: missionId,
    });
  }
  return def;
}

export interface SubmarineMissionRequest {
  missionId: SubmarineMission;
  requiredReadiness: SafeInt;
  requiredFuelBp: SafeInt;
}

export interface SubmarineMissionEligibilityContext {
  atWar: boolean;
  availableTechnologyIds: ReadonlySet<string>;
  baseProximityBand: BaseProximityBand;
  baseSupportAvailable: boolean;
}

export type SubmarineMissionEligibilityVerdict =
  | { accepted: true; missionId: SubmarineMission; reasonCode: null; guard: null }
  | {
      accepted: false;
      missionId: SubmarineMission | null;
      reasonCode: SubmarineReasonCode;
      guard: string;
      message: string;
    };

function reject(
  reasonCode: SubmarineReasonCode,
  guard: string,
  missionId: SubmarineMission | null,
  message: string,
): SubmarineMissionEligibilityVerdict {
  return { accepted: false, missionId, reasonCode, guard, message };
}

function assertCanonicalTypeId(asset: SubmarineStrategicAsset): SubmarineTypeDefinition {
  return submarineTypeDefinitionById(asset.submarineTypeId);
}

export function isSubmarineMissionEligible(
  asset: SubmarineStrategicAsset,
  request: SubmarineMissionRequest,
  context: SubmarineMissionEligibilityContext,
): SubmarineMissionEligibilityVerdict {
  if (!request) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "mission", null, "mission request missing");
  }
  const missionId = request.missionId;

  if (!(SUBMARINE_MISSIONS as readonly string[]).includes(missionId)) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "mission", missionId, "unknown mission");
  }

  let typeDef: SubmarineTypeDefinition;
  try {
    typeDef = assertCanonicalTypeId(asset);
  } catch {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "type",
      missionId,
      `no canonical §4 type definition for ${asset.submarineTypeId}`,
    );
  }

  if (!typeDef.missionEligibility.includes(missionId)) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "type",
      missionId,
      `${typeDef.submarineTypeId} is not mission-eligible for ${missionId}`,
    );
  }

  for (const prereq of typeDef.technologyPrerequisiteIds) {
    if (prereq && !context.availableTechnologyIds.has(prereq)) {
      return reject(
        SUBMARINE_MISSION_INELIGIBLE,
        "technology",
        missionId,
        `missing technology prerequisite ${prereq} for ${typeDef.submarineTypeId}`,
      );
    }
  }

  if (SUBMARINE_REMOTE_EFFICIENCY_BP[typeDef.submarineTypeId][context.baseProximityBand] === 0) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "range",
      missionId,
      `${typeDef.submarineTypeId} has zero §9 remote efficiency in ${context.baseProximityBand}`,
    );
  }

  if (typeDef.baseSupportRequirement === "REQUIRED" && !context.baseSupportAvailable) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "baseSupport",
      missionId,
      `${typeDef.submarineTypeId} requires a support base for ${missionId}`,
    );
  }

  if (asset.readiness < request.requiredReadiness) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "readiness",
      missionId,
      `readiness ${asset.readiness} below required ${request.requiredReadiness}`,
    );
  }

  if (asset.damageLossState.kind !== "OPERATIONAL") {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "damage",
      missionId,
      `asset is ${asset.damageLossState.kind} — cannot execute ${missionId}`,
    );
  }

  if (asset.reliability < SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR) {
    const permittedOps = SUBMARINE_RELIABILITY_LOW_OPERATIONS.join(", ");
    return reject(
      SUBMARINE_RELIABILITY_INSUFFICIENT,
      "reliability",
      missionId,
      `reliability ${asset.reliability} below ${SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR}; only ${permittedOps} permitted`,
    );
  }

  if (asset.fuelAndSupplyState.fuelBp < request.requiredFuelBp) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "fuel",
      missionId,
      `fuel ${asset.fuelAndSupplyState.fuelBp} below required ${request.requiredFuelBp}`,
    );
  }

  if (!(SUBMARINE_POLICIES as readonly string[]).includes(asset.missionPolicyId)) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "policy",
      missionId,
      `mission policy ${asset.missionPolicyId} is not a canonical §5 policy`,
    );
  }

  if (!asset.currentStrategicAreaId || asset.currentStrategicAreaId.length === 0) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "area",
      missionId,
      "asset has no current strategic area for mission eligibility",
    );
  }

  if (!context.atWar) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "warState", missionId, "nation is not at war");
  }

  return { accepted: true, missionId, reasonCode: null, guard: null };
}

export const SUBMARINE_MISSION_ELIGIBILITY_GUARDS: ReadonlyArray<{
  guard: string;
  reasonCode: SubmarineReasonCode;
}> = [
  { guard: "mission", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "type", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "technology", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "range", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "baseSupport", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "readiness", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "damage", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "reliability", reasonCode: SUBMARINE_RELIABILITY_INSUFFICIENT },
  { guard: "fuel", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "policy", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "area", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
  { guard: "warState", reasonCode: SUBMARINE_MISSION_INELIGIBLE },
];
