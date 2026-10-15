//packages/combat/src/submarines/model.ts
// DESIGN-34 §1 strategic asset, §4 type definitions, §5 policies + §1
// representation mapping. Mirrors packages/combat/src/mines/model.ts
// (BluewaveError + invariant helper + createEnvelope content/aggregate hash).
//
// Classification of this file's surfaces:
//   - DESIGN-34-EXACT (shipped integers): §1 type→representation mapping
//     (MISSILE→PERSISTENT_UNIT, others→TYPED_FLOTILLA_POOL), §5 policy weights
//     (sum to exactly 10_000), §9 remote-efficiency table, §10 long-range ASW
//     vulnerability table, §1 asset field set.
//   - AUTHORED NON-NORMATIVE (recorded, per ticket 06): range-class labels,
//     base-support requirement, tactical-projection ids, per-type mission
//     eligibility membership (the full eligibility predicate is INC-2 / AC-4),
//     readiness/supply/fuel basis-point state domains. None of these invents an
//     authoritative mechanical integer beyond DESIGN-34's shipped tables.
//
// Boundary reason codes:
//   - The strategic-asset (§1) boundary fails closed with
//     INVALID_SUBMARINE_REPRESENTATION (missing/mixed representation AND the §1
//     field-set / quantity==1-for-persistent rule — §1's own code).
//   - The type-definition and policy DEFINITION boundaries (content-like,
//     hash-verifiable) and the policy-change predicate fail closed with
//     SUBMARINE_STATE_INVARIANT_FAILED (§27/§28 invariant carrier), used
//     AMBIENTLY here and FORMALIZED into the shipped catalog by INC-8 — the
//     exact C-1 (TORPEDO_STATE_INVARIANT_FAILED) / C-2 (MINE_WARFARE_INVARIANT_FAILED)
//     precedent.
//
// Pure/deterministic: no I/O/clock/random. Identical inputs -> identical hashes.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  BASE_PROXIMITY_BANDS,
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  SUBMARINE_POLICIES,
  SUBMARINE_RULESET_VERSION,
  SUBMARINE_TYPES,
  submarinePoliciesPolicyId,
  submarineStrategicAssetPolicyId,
  submarineTypesPolicyId,
  type BaseProximityBand,
  type StrategicRepresentation,
  type SubmarineMission,
  type SubmarinePolicy,
  type SubmarineRangeClass,
  type SubmarineType,
} from "./constants.js";
import {
  INVALID_SUBMARINE_REPRESENTATION,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// ---------------------------------------------------------------------------
// shared validators
// ---------------------------------------------------------------------------

function representationInvariant(value: unknown, field: string, reason: string): never {
  throw new BluewaveError(INVALID_SUBMARINE_REPRESENTATION, {
    code: INVALID_SUBMARINE_REPRESENTATION,
    field,
    reason,
    value,
  });
}

function definitionInvariant(value: unknown, field: string, reason: string): never {
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

function isBp(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    Number.isSafeInteger(v) &&
    v >= 0 &&
    v <= SUBMARINE_BASIS_POINTS_PER_UNIT
  );
}

// ---------------------------------------------------------------------------
// §1 Strategic representation mapping + asset
// ---------------------------------------------------------------------------

// DESIGN-34 §1: MISSILE -> PERSISTENT_UNIT; coastal/medium/long/minelaying ->
// TYPED_FLOTILLA_POOL. Pure, deterministic, exhaustive over the five types.
export function strategicRepresentationForType(t: SubmarineType): StrategicRepresentation {
  return t === "MISSILE" ? "PERSISTENT_UNIT" : "TYPED_FLOTILLA_POOL";
}

// Fuel and supply state (DESIGN-34 §1 "fuel and supply state"), modelled as
// basis-point levels 0..10_000 (0 = empty). AUTHORED domain (DESIGN-34 does not
// pin an exact fuel/supply shape); recorded non-normative here, refined by the
// mission-eligibility increment (INC-2, AC-4).
export interface FuelAndSupplyState {
  fuelBp: SafeInt; // 0..10_000
  supplyBp: SafeInt; // 0..10_000
}

// Damage or loss state (DESIGN-34 §1 "damage or loss state"; §3 terminal states).
// AUTHORED closed shape: OPERATIONAL carries a damage basis-point level
// (0 = undamaged); SUNK/CAPTURED/SCUTTLED are §3 terminal states.
export type SubmarineDamageLossState =
  | { kind: "OPERATIONAL"; damageBp: SafeInt }
  | { kind: "SUNK" }
  | { kind: "CAPTURED" }
  | { kind: "SCUTTLED" };

// DESIGN-34 §1 strategic asset. The representation discriminant is a single
// required field validated against the closed two-value set: "exactly one"
// representation is STRUCTURALLY enforced (a single canonical value) AND
// fail-closed at the boundary — a missing or mixed/non-canonical value throws
// INVALID_SUBMARINE_REPRESENTATION. quantity MUST be exactly 1 for a persistent
// unit (per §1). Numeric state uses branded SafeInt (checked arithmetic, exact
// bounds per ENGINEERING-CONTRACT §Arithmetic).
export interface SubmarineStrategicAsset {
  assetId: string;
  ownerNationId: string;
  submarineTypeId: SubmarineType;
  representation: StrategicRepresentation;
  quantity: SafeInt; // exactly 1 for PERSISTENT_UNIT; >= 1 for TYPED_FLOTILLA_POOL
  readiness: SafeInt; // 0..100 (AUTHORED domain, mirrors reliability range)
  reliability: SafeInt; // 0..100 (DESIGN-34 §7 exact range)
  currentStrategicAreaId: string;
  homeBaseId: string;
  fuelAndSupplyState: FuelAndSupplyState;
  missionPolicyId: SubmarinePolicy; // which §5 policy the asset operates under
  damageLossState: SubmarineDamageLossState;
  monthlyBattleParticipationCount: SafeInt; // >= 0
  rulesetVersion: string;
  aggregateHash: string; // deterministic SHA-256 over the non-hash surface
}

function isSafeIntRange(v: unknown, lo: number, hi: number): v is SafeInt {
  return (
    typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v) && v >= lo && v <= hi
  );
}

// AC-1: §1 boundary validation. Rejects a missing/mixed representation, a §1
// field-set violation, a type→representation pair that violates the §1 shipped
// mapping (e.g. COASTAL + PERSISTENT_UNIT), and a persistent unit with quantity
// != 1 — all with INVALID_SUBMARINE_REPRESENTATION (the §1 fail-closed code).
// Validates the surface except the aggregate-hash presence (a hash-less surface
// is validated before hashing).
export function assertSubmarineStrategicAssetSurface(a: SubmarineStrategicAsset): void {
  if (!isNonEmptyString(a.assetId))
    representationInvariant(a.assetId, "assetId", "asset identifier must be non-empty");
  if (!isNonEmptyString(a.ownerNationId))
    representationInvariant(a.ownerNationId, "ownerNationId", "owner nation must be non-empty");
  if (!(SUBMARINE_TYPES as readonly string[]).includes(a.submarineTypeId))
    representationInvariant(a.submarineTypeId, "submarineTypeId", "must be a canonical §4 type");
  // §1 "exactly one strategic representation": the representation field must be
  // one of the two canonical values. A MISSING (undefined) or MIXED/non-canonical
  // value fails closed here — never a silent default.
  const isCanonical =
    a.representation === "PERSISTENT_UNIT" || a.representation === "TYPED_FLOTILLA_POOL";
  if (!isCanonical) {
    representationInvariant(
      a.representation,
      "representation",
      "exactly one canonical strategic representation (PERSISTENT_UNIT | TYPED_FLOTILLA_POOL) required",
    );
  }
  // §1 type→representation coherence: the representation must match the §1
  // shipped mapping for the asset's type (MISSILE -> PERSISTENT_UNIT; the other
  // four types -> TYPED_FLOTILLA_POOL). A canonical-but-mismatched pair (e.g.
  // COASTAL + PERSISTENT_UNIT, MISSILE + TYPED_FLOTILLA_POOL) fails closed here —
  // the mapping is pinned at this boundary, never silently paired.
  if (a.representation !== strategicRepresentationForType(a.submarineTypeId)) {
    representationInvariant(
      a.representation,
      "representation",
      `representation must match the §1 shipped type→representation mapping for ${a.submarineTypeId}`,
    );
  }
  if (!SafeInt.isSafeInt(a.quantity))
    representationInvariant(a.quantity, "quantity", "quantity must be a safe integer");
  // §1 "quantity, equal to 1 for persistent units".
  if (a.representation === "PERSISTENT_UNIT" && a.quantity !== (1 as SafeInt)) {
    representationInvariant(a.quantity, "quantity", "persistent-unit quantity must be exactly 1");
  }
  if (a.quantity < (1 as SafeInt))
    representationInvariant(a.quantity, "quantity", "quantity must be at least 1");
  if (!isSafeIntRange(a.readiness, 0, 100))
    representationInvariant(a.readiness, "readiness", "readiness must be an integer in [0, 100]");
  if (!isSafeIntRange(a.reliability, 0, 100))
    representationInvariant(
      a.reliability,
      "reliability",
      "reliability must be an integer in [0, 100] (§7)",
    );
  if (!isNonEmptyString(a.currentStrategicAreaId))
    representationInvariant(
      a.currentStrategicAreaId,
      "currentStrategicAreaId",
      "current strategic area must be non-empty",
    );
  if (!isNonEmptyString(a.homeBaseId))
    representationInvariant(a.homeBaseId, "homeBaseId", "home-base identifier must be non-empty");
  const fuel = a.fuelAndSupplyState;
  if (!fuel || typeof fuel !== "object")
    representationInvariant(fuel, "fuelAndSupplyState", "fuel/supply state is required");
  if (!isSafeIntRange(fuel?.fuelBp, 0, SUBMARINE_BASIS_POINTS_PER_UNIT))
    representationInvariant(
      fuel?.fuelBp,
      "fuelAndSupplyState.fuelBp",
      "fuel must be basis points [0, 10_000]",
    );
  if (!isSafeIntRange(fuel?.supplyBp, 0, SUBMARINE_BASIS_POINTS_PER_UNIT))
    representationInvariant(
      fuel?.supplyBp,
      "fuelAndSupplyState.supplyBp",
      "supply must be basis points [0, 10_000]",
    );
  if (!(SUBMARINE_POLICIES as readonly string[]).includes(a.missionPolicyId))
    representationInvariant(a.missionPolicyId, "missionPolicyId", "must be a canonical §5 policy");
  const dmg = a.damageLossState;
  if (!dmg || typeof dmg !== "object" || typeof dmg.kind !== "string")
    representationInvariant(dmg, "damageLossState", "damage/loss state is required");
  if (dmg.kind === "OPERATIONAL") {
    if (
      !isSafeIntRange((dmg as { damageBp: unknown }).damageBp, 0, SUBMARINE_BASIS_POINTS_PER_UNIT)
    )
      representationInvariant(
        (dmg as { damageBp: unknown }).damageBp,
        "damageLossState.damageBp",
        "operational damage must be basis points [0, 10_000]",
      );
  } else if (!["SUNK", "CAPTURED", "SCUTTLED"].includes(dmg.kind)) {
    representationInvariant(
      dmg.kind,
      "damageLossState.kind",
      "damage/loss kind must be OPERATIONAL, SUNK, CAPTURED, or SCUTTLED",
    );
  }
  if (!SafeInt.isSafeInt(a.monthlyBattleParticipationCount))
    representationInvariant(
      a.monthlyBattleParticipationCount,
      "monthlyBattleParticipationCount",
      "must be a safe integer",
    );
  if (a.monthlyBattleParticipationCount < (0 as SafeInt))
    representationInvariant(
      a.monthlyBattleParticipationCount,
      "monthlyBattleParticipationCount",
      "must be >= 0",
    );
  if (a.rulesetVersion !== SUBMARINE_RULESET_VERSION)
    representationInvariant(a.rulesetVersion, "rulesetVersion", "must be the shipped ruleset");
}

export function validateSubmarineStrategicAsset(a: SubmarineStrategicAsset): void {
  assertSubmarineStrategicAssetSurface(a);
  if (!isNonEmptyString(a.aggregateHash))
    representationInvariant(a.aggregateHash, "aggregateHash", "aggregate hash must be non-empty");
}

// Deterministic aggregate hash over the non-hash surface, domain-separated with
// submarine_strategic_asset_v1. Identical state -> identical hash.
export function computeSubmarineStrategicAssetAggregateHash(
  a: Omit<SubmarineStrategicAsset, "aggregateHash">,
): string {
  const { aggregateHash: _ignored, ...surface } = a as SubmarineStrategicAsset;
  return createEnvelope("submarine-strategic-asset", submarineStrategicAssetPolicyId, surface)
    .bodyHash;
}

export function withSubmarineStrategicAssetAggregateHash(
  a: Omit<SubmarineStrategicAsset, "aggregateHash">,
): SubmarineStrategicAsset {
  assertSubmarineStrategicAssetSurface(a as SubmarineStrategicAsset);
  return { ...a, aggregateHash: computeSubmarineStrategicAssetAggregateHash(a) };
}

export function verifySubmarineStrategicAssetAggregateHash(a: SubmarineStrategicAsset): boolean {
  return computeSubmarineStrategicAssetAggregateHash(a) === a.aggregateHash;
}

// ---------------------------------------------------------------------------
// §4 type definitions
// ---------------------------------------------------------------------------

// DESIGN-34 §9 exact remote-efficiency table (LOCAL/REGIONAL/REMOTE/EXTREME_REMOTE).
export const SUBMARINE_REMOTE_EFFICIENCY_BP: Readonly<
  Record<SubmarineType, Readonly<Record<BaseProximityBand, number>>>
> = {
  COASTAL: { LOCAL: 10_000, REGIONAL: 7_500, REMOTE: 2_500, EXTREME_REMOTE: 0 },
  MEDIUM_RANGE: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 7_500, EXTREME_REMOTE: 5_000 },
  LONG_RANGE: { LOCAL: 10_000, REGIONAL: 11_000, REMOTE: 12_500, EXTREME_REMOTE: 10_000 },
  MINELAYING: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 8_000, EXTREME_REMOTE: 5_000 },
  MISSILE: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 10_000, EXTREME_REMOTE: 9_000 },
};

// DESIGN-34 §10 exact long-range ASW-vulnerability table. DESIGN-34 only names
// LONG_RANGE; the other four types carry the NEUTRAL baseline (10_000 = no
// change) as an AUTHORED default — never invented (the table's shape is
// DESIGN-34-exact for long range; §10 does not define a modifier for the others).
export const SUBMARINE_ASW_VULNERABILITY_BP: Readonly<Record<BaseProximityBand, number>> = {
  LOCAL: 10_500,
  REGIONAL: 10_750,
  REMOTE: 11_000,
  EXTREME_REMOTE: 11_500,
};

export const SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP = SUBMARINE_BASIS_POINTS_PER_UNIT;

export interface SubmarineTypeDefinition {
  submarineTypeId: SubmarineType;
  rangeClass: SubmarineRangeClass;
  remoteEfficiencyProfileBp: Readonly<Record<BaseProximityBand, number>>; // §9 exact
  aswVulnerabilityProfileBp: Readonly<Record<BaseProximityBand, number>>; // §10 (long) / neutral
  missionEligibility: readonly SubmarineMission[];
  baseSupportRequirement: "REQUIRED" | "OPTIONAL";
  tacticalProjectionId: string;
  technologyPrerequisiteIds: readonly string[];
  contentVersion: string;
  contentHash: string; // deterministic SHA-256 over the non-hash surface
}

// Hits every field; the labelled field is the one reported on failure.
function assertSubmarineTypeDefinitionField(
  def: SubmarineTypeDefinition,
  field: keyof SubmarineTypeDefinition,
  ok: boolean,
  reason: string,
): void {
  if (!ok) definitionInvariant(def[field], String(field), reason);
}

export function assertSubmarineTypeDefinitionSurface(def: SubmarineTypeDefinition): void {
  const { submarineTypeId } = def;
  assertSubmarineTypeDefinitionField(
    def,
    "submarineTypeId",
    (SUBMARINE_TYPES as readonly string[]).includes(submarineTypeId),
    "submarineTypeId must be a canonical §4 type",
  );
  assertSubmarineTypeDefinitionField(
    def,
    "rangeClass",
    ["SHORT", "MEDIUM", "LONG"].includes(def.rangeClass),
    "rangeClass must be a canonical range class",
  );
  if (!def.remoteEfficiencyProfileBp || typeof def.remoteEfficiencyProfileBp !== "object")
    definitionInvariant(def.remoteEfficiencyProfileBp, "remoteEfficiencyProfileBp", "required");
  for (const band of BASE_PROXIMITY_BANDS) {
    const w = def.remoteEfficiencyProfileBp[band];
    if (w !== SUBMARINE_REMOTE_EFFICIENCY_BP[submarineTypeId][band])
      definitionInvariant(
        w,
        `remoteEfficiencyProfileBp.${band}`,
        `§9 shipped remote-efficiency for ${submarineTypeId}`,
      );
  }
  if (!def.aswVulnerabilityProfileBp || typeof def.aswVulnerabilityProfileBp !== "object")
    definitionInvariant(def.aswVulnerabilityProfileBp, "aswVulnerabilityProfileBp", "required");
  for (const band of BASE_PROXIMITY_BANDS) {
    const expected =
      submarineTypeId === "LONG_RANGE"
        ? SUBMARINE_ASW_VULNERABILITY_BP[band]
        : SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP;
    const w = def.aswVulnerabilityProfileBp[band];
    if (w !== expected)
      definitionInvariant(
        w,
        `aswVulnerabilityProfileBp.${band}`,
        `shipped ASW-vulnerability for ${submarineTypeId}`,
      );
  }
  if (!Array.isArray(def.missionEligibility) || def.missionEligibility.length === 0)
    definitionInvariant(
      def.missionEligibility,
      "missionEligibility",
      "at least one mission required",
    );
  assertSubmarineTypeDefinitionField(
    def,
    "baseSupportRequirement",
    def.baseSupportRequirement === "REQUIRED" || def.baseSupportRequirement === "OPTIONAL",
    "base-support requirement must be REQUIRED or OPTIONAL",
  );
  assertSubmarineTypeDefinitionField(
    def,
    "tacticalProjectionId",
    isNonEmptyString(def.tacticalProjectionId),
    "tactical projection id must be non-empty",
  );
  assertSubmarineTypeDefinitionField(
    def,
    "technologyPrerequisiteIds",
    Array.isArray(def.technologyPrerequisiteIds) &&
      def.technologyPrerequisiteIds.every(isNonEmptyString),
    "every technology prerequisite must be a non-empty string",
  );
  assertSubmarineTypeDefinitionField(
    def,
    "contentVersion",
    isNonEmptyString(def.contentVersion),
    "content version must be a non-empty string",
  );
}

export function validateSubmarineTypeDefinition(def: SubmarineTypeDefinition): void {
  assertSubmarineTypeDefinitionSurface(def);
  if (!isNonEmptyString(def.contentHash))
    definitionInvariant(def.contentHash, "contentHash", "content hash must be non-empty");
}

export function computeSubmarineTypeDefinitionContentHash(
  def: Omit<SubmarineTypeDefinition, "contentHash">,
): string {
  const { contentHash: _ignored, ...surface } = def as SubmarineTypeDefinition;
  return createEnvelope("submarine-type-definition", submarineTypesPolicyId, surface).bodyHash;
}

export function withSubmarineTypeDefinitionContentHash(
  def: Omit<SubmarineTypeDefinition, "contentHash">,
): SubmarineTypeDefinition {
  assertSubmarineTypeDefinitionSurface(def as SubmarineTypeDefinition);
  return { ...def, contentHash: computeSubmarineTypeDefinitionContentHash(def) };
}

export function verifySubmarineTypeDefinitionContentHash(def: SubmarineTypeDefinition): boolean {
  return computeSubmarineTypeDefinitionContentHash(def) === def.contentHash;
}

// ---- Shipped five canonical type definitions (DESIGN-34 §4) ----
// missionEligibility membership is AUTHORED (DESIGN-34 §4 lists the required
// field, not a per-type matrix; the full eligibility predicate is INC-2 / AC-4).
// rangeClass / baseSupportRequirement / tacticalProjectionId are AUTHORED
// non-normative labels (ticket 06) — the only DESIGN-34-exact fields here are the
// type ids, the §9 remote-efficiency table, and the §10 ASW table.
const COASTAL_MISSIONS: readonly SubmarineMission[] = [
  "FLEET_INTERDICTION",
  "RECONNAISSANCE",
  "TACTICAL_BATTLE_SUPPORT",
];
const MEDIUM_MISSIONS: readonly SubmarineMission[] = [
  "FLEET_INTERDICTION",
  "MERCHANT_RAIDING",
  "RECONNAISSANCE",
];
const LONG_MISSIONS: readonly SubmarineMission[] = [
  "FLEET_INTERDICTION",
  "MERCHANT_RAIDING",
  "RECONNAISSANCE",
  "RETURNING_SHIP_INTERCEPTION",
];
const MINELAYING_MISSIONS: readonly SubmarineMission[] = ["FLEET_INTERDICTION", "MINE_LAYING"];
const MISSILE_MISSIONS: readonly SubmarineMission[] = ["FLEET_INTERDICTION", "MISSILE_PATROL"];

export const SHIPPED_SUBMARINE_TYPE_DEFINITIONS: readonly SubmarineTypeDefinition[] = [
  withSubmarineTypeDefinitionContentHash({
    submarineTypeId: "COASTAL",
    rangeClass: "SHORT",
    remoteEfficiencyProfileBp: SUBMARINE_REMOTE_EFFICIENCY_BP.COASTAL,
    aswVulnerabilityProfileBp: {
      LOCAL: 10_000,
      REGIONAL: 10_000,
      REMOTE: 10_000,
      EXTREME_REMOTE: 10_000,
    },
    missionEligibility: COASTAL_MISSIONS,
    baseSupportRequirement: "REQUIRED",
    tacticalProjectionId: "tactical_projection_coastal_v1",
    technologyPrerequisiteIds: [],
    contentVersion: submarineTypesPolicyId,
  }),
  withSubmarineTypeDefinitionContentHash({
    submarineTypeId: "MEDIUM_RANGE",
    rangeClass: "MEDIUM",
    remoteEfficiencyProfileBp: SUBMARINE_REMOTE_EFFICIENCY_BP.MEDIUM_RANGE,
    aswVulnerabilityProfileBp: {
      LOCAL: 10_000,
      REGIONAL: 10_000,
      REMOTE: 10_000,
      EXTREME_REMOTE: 10_000,
    },
    missionEligibility: MEDIUM_MISSIONS,
    baseSupportRequirement: "REQUIRED",
    tacticalProjectionId: "tactical_projection_medium_range_v1",
    technologyPrerequisiteIds: [],
    contentVersion: submarineTypesPolicyId,
  }),
  withSubmarineTypeDefinitionContentHash({
    submarineTypeId: "LONG_RANGE",
    rangeClass: "LONG",
    remoteEfficiencyProfileBp: SUBMARINE_REMOTE_EFFICIENCY_BP.LONG_RANGE,
    aswVulnerabilityProfileBp: SUBMARINE_ASW_VULNERABILITY_BP, // §10 exact
    missionEligibility: LONG_MISSIONS,
    baseSupportRequirement: "OPTIONAL",
    tacticalProjectionId: "tactical_projection_long_range_v1",
    technologyPrerequisiteIds: ["long_range_submarine_technology"],
    contentVersion: submarineTypesPolicyId,
  }),
  withSubmarineTypeDefinitionContentHash({
    submarineTypeId: "MINELAYING",
    rangeClass: "MEDIUM",
    remoteEfficiencyProfileBp: SUBMARINE_REMOTE_EFFICIENCY_BP.MINELAYING,
    aswVulnerabilityProfileBp: {
      LOCAL: 10_000,
      REGIONAL: 10_000,
      REMOTE: 10_000,
      EXTREME_REMOTE: 10_000,
    },
    missionEligibility: MINELAYING_MISSIONS,
    baseSupportRequirement: "REQUIRED",
    tacticalProjectionId: "tactical_projection_minelaying_v1",
    technologyPrerequisiteIds: ["minelaying_submarine_technology"],
    contentVersion: submarineTypesPolicyId,
  }),
  withSubmarineTypeDefinitionContentHash({
    submarineTypeId: "MISSILE",
    rangeClass: "LONG",
    remoteEfficiencyProfileBp: SUBMARINE_REMOTE_EFFICIENCY_BP.MISSILE,
    aswVulnerabilityProfileBp: {
      LOCAL: 10_000,
      REGIONAL: 10_000,
      REMOTE: 10_000,
      EXTREME_REMOTE: 10_000,
    },
    missionEligibility: MISSILE_MISSIONS,
    baseSupportRequirement: "OPTIONAL",
    tacticalProjectionId: "tactical_projection_missile_v1",
    technologyPrerequisiteIds: ["missile_submarine_technology"],
    contentVersion: submarineTypesPolicyId,
  }),
];

// Fail-closed lookup: a shipped submarine type by id. An unknown id fails with
// SUBMARINE_STATE_INVARIANT_FAILED (never a silent default), mirroring
// mineTypeDefinitionById.
export function submarineTypeDefinitionById(submarineTypeId: string): SubmarineTypeDefinition {
  const def = SHIPPED_SUBMARINE_TYPE_DEFINITIONS.find((d) => d.submarineTypeId === submarineTypeId);
  if (!def) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "unknown submarine type id — no shipped definition for this type",
      value: submarineTypeId,
    });
  }
  return def;
}

// ---------------------------------------------------------------------------
// §5 policies
// ---------------------------------------------------------------------------

export interface SubmarinePolicyDefinition {
  policyId: SubmarinePolicy;
  warshipAttackWeightBp: number;
  merchantAttackWeightBp: number;
  neutralIncidentMultiplierBp: number;
  contentVersion: string;
  contentHash: string;
}

// DESIGN-34 §5: "Weights MUST sum to exactly 10_000 for each policy." Per the
// shipped values, the two complementary allocation weights (warship + merchant)
// are the summands — every policy's warship+merchant equals exactly 10_000
// (FLEET 8_000+2_000, PRIZE 5_000+5_000, UNRESTRICTED 2_500+7_500). The neutral
// incident multiplier is an INDEPENDENT scalar (5_000/10_000/20_000), not part
// of the 10_000 allocation sum. Enforced structurally here (AC-3) and by the
// validate guard.
export function assertSubmarinePolicyDefinitionSurface(p: SubmarinePolicyDefinition): void {
  const { policyId } = p;
  if (!(SUBMARINE_POLICIES as readonly string[]).includes(policyId))
    definitionInvariant(policyId, "policyId", "must be a canonical §5 policy");
  const allocationTotal = p.warshipAttackWeightBp + p.merchantAttackWeightBp;
  if (allocationTotal !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    definitionInvariant(
      allocationTotal,
      "allocationWeights",
      "§5 warship + merchant allocation weights must sum to exactly 10_000",
    );
  if (!isBp(p.warshipAttackWeightBp))
    definitionInvariant(
      p.warshipAttackWeightBp,
      "warshipAttackWeightBp",
      "must be basis points [0, 10_000]",
    );
  if (!isBp(p.merchantAttackWeightBp))
    definitionInvariant(
      p.merchantAttackWeightBp,
      "merchantAttackWeightBp",
      "must be basis points [0, 10_000]",
    );
  // The neutral-incident multiplier is an INDEPENDENT scalar (shipped 5_000/
  // 10_000/20_000) NOT bounded by the 10_000 basis-point scale — it only needs
  // to be a non-negative safe integer.
  if (
    typeof p.neutralIncidentMultiplierBp !== "number" ||
    !Number.isInteger(p.neutralIncidentMultiplierBp) ||
    !Number.isSafeInteger(p.neutralIncidentMultiplierBp) ||
    p.neutralIncidentMultiplierBp < 0
  )
    definitionInvariant(
      p.neutralIncidentMultiplierBp,
      "neutralIncidentMultiplierBp",
      "must be a non-negative safe integer",
    );
  if (p.contentVersion !== submarinePoliciesPolicyId)
    definitionInvariant(p.contentVersion, "contentVersion", "policy content version");
}

export function validateSubmarinePolicyDefinition(p: SubmarinePolicyDefinition): void {
  assertSubmarinePolicyDefinitionSurface(p);
  if (!isNonEmptyString(p.contentHash))
    definitionInvariant(p.contentHash, "contentHash", "content hash must be non-empty");
}

export function computeSubmarinePolicyContentHash(
  p: Omit<SubmarinePolicyDefinition, "contentHash">,
): string {
  const { contentHash: _ignored, ...surface } = p as SubmarinePolicyDefinition;
  return createEnvelope("submarine-policy", submarinePoliciesPolicyId, surface).bodyHash;
}

export function withSubmarinePolicyContentHash(
  p: Omit<SubmarinePolicyDefinition, "contentHash">,
): SubmarinePolicyDefinition {
  assertSubmarinePolicyDefinitionSurface(p as SubmarinePolicyDefinition);
  return { ...p, contentHash: computeSubmarinePolicyContentHash(p) };
}

export function verifySubmarinePolicyContentHash(p: SubmarinePolicyDefinition): boolean {
  return computeSubmarinePolicyContentHash(p) === p.contentHash;
}

function policyFromWeights(p: SubmarinePolicy): SubmarinePolicyDefinition {
  const w = {
    FLEET_SUPPORT: {
      warshipAttackWeightBp: 8_000,
      merchantAttackWeightBp: 2_000,
      neutralIncidentMultiplierBp: 5_000,
    },
    PRIZE_RULES: {
      warshipAttackWeightBp: 5_000,
      merchantAttackWeightBp: 5_000,
      neutralIncidentMultiplierBp: 10_000,
    },
    UNRESTRICTED: {
      warshipAttackWeightBp: 2_500,
      merchantAttackWeightBp: 7_500,
      neutralIncidentMultiplierBp: 20_000,
    },
  }[p];
  return withSubmarinePolicyContentHash({
    policyId: p,
    ...w,
    contentVersion: submarinePoliciesPolicyId,
  });
}

// DESIGN-34 §5 shipped three-policy set. Every policy sums to exactly 10_000
// (asserted by withSubmarinePolicyContentHash -> assertSubmarinePolicyDefinitionSurface).
export const SHIPPED_SUBMARINE_POLICIES: readonly SubmarinePolicyDefinition[] = [
  policyFromWeights("FLEET_SUPPORT"),
  policyFromWeights("PRIZE_RULES"),
  policyFromWeights("UNRESTRICTED"),
];

export function submarinePolicyById(policyId: string): SubmarinePolicyDefinition {
  const def = SHIPPED_SUBMARINE_POLICIES.find((p) => p.policyId === policyId);
  if (!def) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "unknown submarine policy id — no shipped definition for this policy",
      value: policyId,
    });
  }
  return def;
}

// ---------------------------------------------------------------------------
// §5 policy-change surface (command layer DEFERRED per spec §3 / ticket 03)
// ---------------------------------------------------------------------------

// DESIGN-34 §5: "Policy changes require an accepted command and become effective
// at the next trade-warfare resolution." The command/IPC (accepted-command)
// machinery is DEFERRED to the later command/AI slice (spec §3); INC-1 ships the
// documented value/predicate surface only — the accepted-command gate predicate
// + the effective-at constant — as pure functions. No IPC/command path is built.
export const SUBMARINE_POLICY_CHANGE_EFFECTIVE_AT = "NEXT_TRADE_WARFARE_RESOLUTION" as const;

export interface SubmarinePolicyChangeCommand {
  fromPolicyId: SubmarinePolicy;
  toPolicyId: SubmarinePolicy;
}

export type SubmarinePolicyChangeVerdict =
  | {
      accepted: true;
      fromPolicyId: SubmarinePolicy;
      toPolicyId: SubmarinePolicy;
      effectiveAt: typeof SUBMARINE_POLICY_CHANGE_EFFECTIVE_AT;
    }
  | {
      accepted: false;
      fromPolicyId: SubmarinePolicy | null;
      toPolicyId: SubmarinePolicy | null;
      reason: string;
    };

// Accepted-command predicate. An accepted change is effective at the next
// trade-warfare resolution (DESIGN-34 §5). Rejects a non-canonical target or a
// no-op (from === to) change.
export function acceptSubmarinePolicyChange(
  command: SubmarinePolicyChangeCommand,
): SubmarinePolicyChangeVerdict {
  if (!command || !(SUBMARINE_POLICIES as readonly string[]).includes(command.toPolicyId)) {
    return {
      accepted: false,
      fromPolicyId: command?.fromPolicyId ?? null,
      toPolicyId: command?.toPolicyId ?? null,
      reason: "policy change target must be a canonical §5 policy",
    };
  }
  if (
    command.fromPolicyId !== undefined &&
    !(SUBMARINE_POLICIES as readonly string[]).includes(command.fromPolicyId)
  ) {
    return {
      accepted: false,
      fromPolicyId: command.fromPolicyId,
      toPolicyId: command.toPolicyId,
      reason: "policy change source must be a canonical §5 policy",
    };
  }
  if (command.fromPolicyId === command.toPolicyId) {
    return {
      accepted: false,
      fromPolicyId: command.fromPolicyId,
      toPolicyId: command.toPolicyId,
      reason: "policy change must select a different policy (no-op rejected)",
    };
  }
  return {
    accepted: true,
    fromPolicyId: command.fromPolicyId,
    toPolicyId: command.toPolicyId,
    effectiveAt: SUBMARINE_POLICY_CHANGE_EFFECTIVE_AT,
  };
}

// Smallest exported helper used by consumers of the shipped sets to assert the
// invariant that every shipped definition self-validates (guards the set never
// loses its exactness at build time).
export function validateShippedSubmarineDefinitions(): void {
  for (const def of SHIPPED_SUBMARINE_TYPE_DEFINITIONS) validateSubmarineTypeDefinition(def);
  for (const pol of SHIPPED_SUBMARINE_POLICIES) validateSubmarinePolicyDefinition(pol);
}
