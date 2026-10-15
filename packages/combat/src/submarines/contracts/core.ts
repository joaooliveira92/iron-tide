//packages/combat/src/submarines/contracts.ts
// DESIGN-34 engine-versioned constant-set contracts (C-3 spec §1.3) — the
// "content deliverable" of this sprint: every shipped `*_v1` policy id +
// `SHIPPED_*_CONTRACT` + a fail-closed `validate*Contract` guard. Mirrors
// packages/combat/src/mines/constants.ts (which shipped
// mine_type_definitions_v1) and mines/contracts.ts (the INC-8 rollup).
//
// INC-1 ships the three §1.3 contracts that the strategic-representation /
// types / policies slice exercises:
//   submarine_strategic_asset_v1   (DESIGN-34 §1)
//   submarine_types_v1             (DESIGN-34 §4 + §6 vocab + §9/§10 tables)
//   submarine_policies_v1          (DESIGN-34 §5)
// Each ships DESIGN-34's own exact integers (ticket 06 — no research catalog).
//
// Pure/deterministic; fail-closed: any tampered contract throws
// (INVALID_SUBMARINE_REPRESENTATION for the §1 guard, SUBMARINE_STATE_INVARIANT_FAILED
// for the type/policy definition guards) and never silently passes.
import { SUBMARINE_ASW_VULNERABILITY_BP } from "../model.js";
import { BluewaveError } from "@bluewave/contracts";
import {
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  SUBMARINE_FORMULA_VERSION,
  SUBMARINE_RULESET_VERSION,
  SUBMARINE_POLICY_TARGET_WEIGHTS_BP,
  submarinePoliciesPolicyId,
  submarineStrategicAssetPolicyId,
  submarineTypesPolicyId,
  STRATEGIC_REPRESENTATIONS,
  SUBMARINE_BASE_SUPPORT_REQUIREMENTS,
  SUBMARINE_MISSIONS,
  SUBMARINE_POLICIES,
  SUBMARINE_RANGE_CLASSES,
  SUBMARINE_TYPES,
  BASE_PROXIMITY_BANDS,
  type StrategicRepresentation,
  type SubmarinePolicy,
} from "../constants.js";
import { SUBMARINE_STATE_INVARIANT_FAILED } from "../reasonCodes.js";
import { arrayEquals, throwStrategicMismatch } from "./shared.js";

export interface SubmarineStrategicAssetContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  representations: readonly StrategicRepresentation[];
}

export const SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT: SubmarineStrategicAssetContract = {
  policyId: submarineStrategicAssetPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  representations: STRATEGIC_REPRESENTATIONS,
};

export function validateSubmarineStrategicAssetContract(
  c: Partial<SubmarineStrategicAssetContract> | null | undefined,
): asserts c is SubmarineStrategicAssetContract {
  if (!c) throwStrategicMismatch(c, "submarine_strategic_asset_v1 missing contract");
  if (c.policyId !== submarineStrategicAssetPolicyId)
    throwStrategicMismatch(c, "submarine_strategic_asset_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    throwStrategicMismatch(c, "submarine_strategic_asset_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    throwStrategicMismatch(c, "submarine_strategic_asset_v1 basis-point scale");
  if (!c.representations || !arrayEquals(c.representations, STRATEGIC_REPRESENTATIONS))
    throwStrategicMismatch(c, "submarine_strategic_asset_v1 §1 closed representation enum");
  // restore the typed value after guard (the throw path returns never)
  void c;
}

// submarine_types_v1 (§4 + §6 vocab + §9/§10 tables)

export interface SubmarineTypesContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  submarineTypes: readonly string[];
  submarineMissions: readonly string[];
  rangeClasses: readonly string[];
  baseSupportRequirements: readonly string[];
  proximityBands: readonly string[];
  longRangeAswVulnerabilityBp: Record<string, number>;
  shippedSubmarineTypeIds: readonly string[];
}

export const SHIPPED_SUBMARINE_TYPES_CONTRACT: SubmarineTypesContract = {
  policyId: submarineTypesPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  submarineTypes: SUBMARINE_TYPES,
  submarineMissions: SUBMARINE_MISSIONS,
  rangeClasses: SUBMARINE_RANGE_CLASSES,
  baseSupportRequirements: SUBMARINE_BASE_SUPPORT_REQUIREMENTS,
  proximityBands: BASE_PROXIMITY_BANDS,
  longRangeAswVulnerabilityBp: { ...SUBMARINE_ASW_VULNERABILITY_BP },
  shippedSubmarineTypeIds: SUBMARINE_TYPES,
};

export function validateSubmarineTypesContract(
  c: Partial<SubmarineTypesContract> | null | undefined,
): asserts c is SubmarineTypesContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_types_v1 missing contract");
  if (c.policyId !== submarineTypesPolicyId) mismatch(c, "submarine_types_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_types_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_types_v1 basis-point scale");
  if (!c.submarineTypes || !arrayEquals(c.submarineTypes, SUBMARINE_TYPES))
    mismatch(c, "submarine_types_v1 §4 closed five-type enum");
  if (!c.submarineMissions || !arrayEquals(c.submarineMissions, SUBMARINE_MISSIONS))
    mismatch(c, "submarine_types_v1 §6 closed seven-mission enum");
  if (!c.rangeClasses || !arrayEquals(c.rangeClasses, SUBMARINE_RANGE_CLASSES))
    mismatch(c, "submarine_types_v1 range-class vocabulary");
  if (
    !c.baseSupportRequirements ||
    !arrayEquals(c.baseSupportRequirements, SUBMARINE_BASE_SUPPORT_REQUIREMENTS)
  )
    mismatch(c, "submarine_types_v1 base-support vocabulary");
  if (!c.proximityBands || !arrayEquals(c.proximityBands, BASE_PROXIMITY_BANDS))
    mismatch(c, "submarine_types_v1 §8 proximity-band vocabulary");
  if (!c.longRangeAswVulnerabilityBp)
    mismatch(c, "submarine_types_v1 §10 long-range ASW table missing");
  for (const band of BASE_PROXIMITY_BANDS) {
    if (c.longRangeAswVulnerabilityBp[band] !== SUBMARINE_ASW_VULNERABILITY_BP[band])
      mismatch(c, `submarine_types_v1 §10 long-range ASW vulnerability for ${band}`);
  }
  if (!c.shippedSubmarineTypeIds || !arrayEquals(c.shippedSubmarineTypeIds, SUBMARINE_TYPES))
    mismatch(c, "submarine_types_v1 shipped submarine-type id list");
  void c;
}

// submarine_policies_v1 (§5)

export interface SubmarinePoliciesContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  policies: readonly SubmarinePolicy[];
  targetWeightsBp: Record<
    SubmarinePolicy,
    { warshipAttackBp: number; merchantAttackBp: number; neutralIncidentMultiplierBp: number }
  >;
  policyChangeEffectiveAt: string;
  shippedPolicyIds: readonly string[];
}

// §5 target weights derive from the single shipped constants copy
// (SUBMARINE_POLICY_TARGET_WEIGHTS_BP in constants.ts) — the contract never
// hand-copies the DESIGN-34 integers a second time, so the shipped set, the
// policy definitions, and this contract cannot drift apart.
const TARGET_WEIGHTS: SubmarinePoliciesContract["targetWeightsBp"] =
  SUBMARINE_POLICY_TARGET_WEIGHTS_BP;

export const SHIPPED_SUBMARINE_POLICIES_CONTRACT: SubmarinePoliciesContract = {
  policyId: submarinePoliciesPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  policies: SUBMARINE_POLICIES,
  targetWeightsBp: TARGET_WEIGHTS,
  policyChangeEffectiveAt: "NEXT_TRADE_WARFARE_RESOLUTION",
  shippedPolicyIds: SUBMARINE_POLICIES,
};

export function validateSubmarinePoliciesContract(
  c: Partial<SubmarinePoliciesContract> | null | undefined,
): asserts c is SubmarinePoliciesContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_policies_v1 missing contract");
  if (c.policyId !== submarinePoliciesPolicyId)
    mismatch(c, "submarine_policies_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_policies_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_policies_v1 basis-point scale");
  if (!c.policies || !arrayEquals(c.policies, SUBMARINE_POLICIES))
    mismatch(c, "submarine_policies_v1 §5 closed three-policy enum");
  if (!c.targetWeightsBp) mismatch(c, "submarine_policies_v1 §5 target weights missing");
  for (const policy of SUBMARINE_POLICIES) {
    const w = c.targetWeightsBp[policy];
    if (!w) mismatch(c, `submarine_policies_v1 §5 target weights for ${policy}`);
    if (w.warshipAttackBp !== TARGET_WEIGHTS[policy].warshipAttackBp)
      mismatch(c, `submarine_policies_v1 §5 warship weight for ${policy}`);
    if (w.merchantAttackBp !== TARGET_WEIGHTS[policy].merchantAttackBp)
      mismatch(c, `submarine_policies_v1 §5 merchant weight for ${policy}`);
    if (w.neutralIncidentMultiplierBp !== TARGET_WEIGHTS[policy].neutralIncidentMultiplierBp)
      mismatch(c, `submarine_policies_v1 §5 neutral-incident multiplier for ${policy}`);
    if (w.warshipAttackBp + w.merchantAttackBp !== SUBMARINE_BASIS_POINTS_PER_UNIT)
      mismatch(
        c,
        `submarine_policies_v1 §5 warship + merchant weights must sum to 10_000 for ${policy}`,
      );
  }
  if (c.policyChangeEffectiveAt !== "NEXT_TRADE_WARFARE_RESOLUTION")
    mismatch(c, "submarine_policies_v1 §5 policy change effective-at");
  if (!c.shippedPolicyIds || !arrayEquals(c.shippedPolicyIds, SUBMARINE_POLICIES))
    mismatch(c, "submarine_policies_v1 shipped policy id list");
  void c;
}

// submarine_missions_v1 (§6 + §26.4)
