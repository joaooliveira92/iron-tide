//packages/combat/src/submarines/missionEligibility.ts
// DESIGN-34 §6 mission eligibility (AC-4, INC-2) + §26.4 mission-priority field.
//
// §6 ships the seven canonical missions and requires mission eligibility to
// validate type, technology, range, base support, readiness, damage, reliability,
// fuel, policy, area, and war state. The campaign world is not wired in, so the
// eligibility-context inputs (war state, available technology, current
// base-proximity band, support-base availability) and the per-mission request
// thresholds (readiness floor, fuel floor) are modelled as an explicit parameter
// set — see `SubmarineMissionEligibilityContext` / `SubmarineMissionRequest`.
//
// Fail-closed predicate: any ineligible mission is REJECTED (never silently
// passed). The eligibility verdict carries the failing guard and a reason code:
//   - severity-§6 guards that INC-2 owns -> SUBMARINE_MISSION_INELIGIBLE
//     (type, technology, range, base support, readiness, damage, fuel, policy,
//     area, war state — the generic §6 miss);
//   - the reliability guard is §7's dedicated code -> SUBMARINE_RELIABILITY_INSUFFICIENT
//     (below the §7 offensive-deployment floor of 20; see reliability.ts).
// Fuel/technology/area/etc. do NOT fire their own later-owned codes
// (SUBMARINE_FUEL_INSUFFICIENT, COASTAL_SUBMARINE_RANGE_RESTRICTED, ...) in this
// slice — per ticket, INC-2 fires exactly mission-ineligible + reliability-
// insufficient. Deferred own-code ownership is recorded in the guard map at the
// end of this file; §20's mine-laying reliability >= 40 is INC-7 (NOT implemented
// here).
//
// §26.4 orders missions by MISSION PRIORITY. DESIGN-34 names the field but does
// not pin integers; the priority values are an AUTHORED record (documented in
// this file + the ticket) — ascending integer, lower resolves first (consistent
// with the rest of §26's ascending, by-id ordering), assigned by strategic role.
//
// Pure/deterministic: no I/O/clock/random.
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

// ---------------------------------------------------------------------------
// §6 + §26.4 mission definitions
// ---------------------------------------------------------------------------

export interface SubmarineMissionDefinition {
  missionId: SubmarineMission;
  // human topic label (presentation-only; never affects mechanics)
  topicLabel: string;
  // §26.4 canonical mission-priority field (AUTHORED ascending integer; lower
  // resolves first). Needed by INC-8's canonical ordering.
  missionPriority: SafeInt;
  contentVersion: string;
  contentHash: string; // deterministic SHA-256 over the non-hash surface
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

// ---- Shipped seven §6 mission definitions ----
// missionPriority is AUTHORED (recorded decision, §26.4 names the field but ships
// no integers): ascending integer, lower reserves first, assigned by strategic
// role. This ordering feeds INC-8's canonical ordering ("missions by mission
// priority").
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
    // Content-catalog lookup (mirrors submarineTypeDefinitionById /
    // submarinePolicyById): an unknown mission id is a state-invariant failure,
    // never a silent default. The §6 eligibility PREDICATE (not this lookup) is
    // where a non-canonical mission fires SUBMARINE_MISSION_INELIGIBLE.
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "unknown mission id — no shipped definition for this mission",
      value: missionId,
    });
  }
  return def;
}

// ---------------------------------------------------------------------------
// §6 eligibility predicate
// ---------------------------------------------------------------------------

// Per-mission request: which mission + the thresholds §6's fuel/readiness guards
// compare against. Thresholds are supplied by the caller (the campaign world
// defines mission-specific fuel/readiness floors; this slice models them as an
// explicit parameter so the predicate stays pure).
export interface SubmarineMissionRequest {
  missionId: SubmarineMission;
  requiredReadiness: SafeInt; // eligibility floor on asset readiness (0..100)
  requiredFuelBp: SafeInt; // eligibility floor on asset fuel (0..10_000)
}

// Eligibility-context: the world inputs §6 requires that are NOT part of the
// asset itself. The campaign world is not wired in, so these are modelled as an
// explicit parameter set.
export interface SubmarineMissionEligibilityContext {
  atWar: boolean; // war state: missions require the nation to be at war
  availableTechnologyIds: ReadonlySet<string>; // technology prerequisites available to the owner
  baseProximityBand: BaseProximityBand; // current §8 base-proximity band (for the §9 range guard)
  baseSupportAvailable: boolean; // an accessible support base for this asset (used iff REQUIRED)
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
  // Fail closed on an unknown/corrupt type id (never a silent default).
  return submarineTypeDefinitionById(asset.submarineTypeId);
}

// §6 fail-closed mission-eligibility predicate. Validates (in order): canonical
// mission, type membership, technology, range, base support, readiness, damage,
// reliability, fuel, policy, area, war state. Returns an accepted verdict or a
// structured rejection that fails closed (SUBMARINE_MISSION_INELIGIBLE, or
// SUBMARINE_RELIABILITY_INSUFFICIENT for the below-20 reliability guard).
export function isSubmarineMissionEligible(
  asset: SubmarineStrategicAsset,
  request: SubmarineMissionRequest,
  context: SubmarineMissionEligibilityContext,
): SubmarineMissionEligibilityVerdict {
  // 0. request presence — a missing request is ineligible (never a silent pass).
  if (!request) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "mission", null, "mission request missing");
  }
  const missionId = request.missionId;

  // 1. canonical mission — a non-§6 mission id is ineligible.
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

  // 2. type membership — the type must list this mission as eligible.
  if (!typeDef.missionEligibility.includes(missionId)) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "type",
      missionId,
      `${typeDef.submarineTypeId} is not mission-eligible for ${missionId}`,
    );
  }

  // 3. technology — every §4 technology prerequisite must be available.
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

  // 4. range — the §9 remote-efficiency at the current band must be non-zero
  //    (e.g. coastal at EXTREME_REMOTE is 0 -> mission-ineligible in that band).
  if (SUBMARINE_REMOTE_EFFICIENCY_BP[typeDef.submarineTypeId][context.baseProximityBand] === 0) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "range",
      missionId,
      `${typeDef.submarineTypeId} has zero §9 remote efficiency in ${context.baseProximityBand}`,
    );
  }

  // 5. base support — a REQUIRED support base must be available.
  if (typeDef.baseSupportRequirement === "REQUIRED" && !context.baseSupportAvailable) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "baseSupport",
      missionId,
      `${typeDef.submarineTypeId} requires a support base for ${missionId}`,
    );
  }

  // 6. readiness — the asset must meet the mission's readiness floor.
  if (asset.readiness < request.requiredReadiness) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "readiness",
      missionId,
      `readiness ${asset.readiness} below required ${request.requiredReadiness}`,
    );
  }

  // 7. damage — a SUNK/CAPTURED/SCUTTLED asset cannot execute any mission.
  if (asset.damageLossState.kind !== "OPERATIONAL") {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "damage",
      missionId,
      `asset is ${asset.damageLossState.kind} — cannot execute ${missionId}`,
    );
  }

  // 8. reliability — below the §7 offensive-deployment floor of 20 -> dedicated
  //    code (INC-2's §7 owning boundary).
  if (asset.reliability < SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR) {
    const permittedOps = SUBMARINE_RELIABILITY_LOW_OPERATIONS.join(", ");
    return reject(
      SUBMARINE_RELIABILITY_INSUFFICIENT,
      "reliability",
      missionId,
      `reliability ${asset.reliability} below ${SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR}; only ${permittedOps} permitted`,
    );
  }

  // 9. fuel — the asset must meet the mission's fuel floor.
  if (asset.fuelAndSupplyState.fuelBp < request.requiredFuelBp) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "fuel",
      missionId,
      `fuel ${asset.fuelAndSupplyState.fuelBp} below required ${request.requiredFuelBp}`,
    );
  }

  // 10. policy — the asset's mission policy must be a canonical §5 policy.
  if (!(SUBMARINE_POLICIES as readonly string[]).includes(asset.missionPolicyId)) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "policy",
      missionId,
      `mission policy ${asset.missionPolicyId} is not a canonical §5 policy`,
    );
  }

  // 11. area — the asset must be located in a valid current strategic area.
  if (!asset.currentStrategicAreaId || asset.currentStrategicAreaId.length === 0) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "area",
      missionId,
      "asset has no current strategic area for mission eligibility",
    );
  }

  // 12. war state — missions require the nation to be at war.
  if (!context.atWar) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "warState", missionId, "nation is not at war");
  }

  return { accepted: true, missionId, reasonCode: null, guard: null };
}

// ---------------------------------------------------------------------------
// Authored guard -> reason-code map (recorded decision; other-increment ownership)
// ---------------------------------------------------------------------------
// INC-2 fires exactly:
//   SUBMARINE_MISSION_INELIGIBLE  (guards: mission, type, technology, range,
//                                  baseSupport, readiness, damage, fuel, policy,
//                                  area, warState)
//   SUBMARINE_RELIABILITY_INSUFFICIENT (guard: reliability — below §7 floor 20)
// Deferred own-code ownership (NOT fired here):
//   SUBMARINE_FUEL_INSUFFICIENT       — later metal/mission slice owns its fire.
//   COASTAL_SUBMARINE_RANGE_RESTRICTED — INC-4 (§12) owns its fire.
//   §20 mine-laying reliability >= 40 — INC-7 (mine laying) owns it; the §7
//       floor of 20 used here does NOT implement §20's stricter mine-laying gate.
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
