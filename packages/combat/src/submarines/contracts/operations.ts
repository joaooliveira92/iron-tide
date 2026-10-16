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
import {
  SUBMARINE_ASW_VULNERABILITY_BP,
  SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP,
} from "../model.js";
import { BluewaveError } from "@bluewave/contracts";
import {
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  SUBMARINE_FORMULA_VERSION,
  SUBMARINE_RULESET_VERSION,
  submarineMissionsPolicyId,
  submarineProximityPolicyId,
  submarineReliabilityPolicyId,
  submarineRemoteEfficiencyPolicyId,
  submarineLongRangeAswVulnerabilityPolicyId,
  SUBMARINE_MISSIONS,
} from "../constants.js";
import { SUBMARINE_STATE_INVARIANT_FAILED } from "../reasonCodes.js";
import { SHIPPED_SUBMARINE_MISSION_DEFINITIONS } from "../missionEligibility.js";
import {
  SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP,
  SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR,
  SUBMARINE_RELIABILITY_MIN,
  SUBMARINE_RELIABILITY_MAX,
} from "../reliability.js";
import { arrayEquals } from "./shared.js";

export interface SubmarineMissionsContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  missions: readonly string[];
  shippedMissionDefinitions: ReadonlyArray<{
    missionId: string;
    topicLabel: string;
    missionPriority: number;
  }>;
  shippedMissionIds: readonly string[];
}

// §26.4 mission-priority values are AUTHORED record (see missionEligibility.ts);
// the contract wires the single shipped definitions copy so the shipped set and
// this contract cannot drift apart.
const MISSION_DEFINITION_SURFACES: SubmarineMissionsContract["shippedMissionDefinitions"] =
  SHIPPED_SUBMARINE_MISSION_DEFINITIONS.map((m) => ({
    missionId: m.missionId,
    topicLabel: m.topicLabel,
    missionPriority: m.missionPriority,
  }));

export const SHIPPED_SUBMARINE_MISSIONS_CONTRACT: SubmarineMissionsContract = {
  policyId: submarineMissionsPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  missions: SUBMARINE_MISSIONS,
  shippedMissionDefinitions: MISSION_DEFINITION_SURFACES,
  shippedMissionIds: SUBMARINE_MISSIONS,
};

export function validateSubmarineMissionsContract(
  c: Partial<SubmarineMissionsContract> | null | undefined,
): asserts c is SubmarineMissionsContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_missions_v1 missing contract");
  if (c.policyId !== submarineMissionsPolicyId)
    mismatch(c, "submarine_missions_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_missions_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_missions_v1 basis-point scale");
  if (!c.missions || !arrayEquals(c.missions, SUBMARINE_MISSIONS))
    mismatch(c, "submarine_missions_v1 §6 closed seven-mission enum");
  if (
    !c.shippedMissionDefinitions ||
    c.shippedMissionDefinitions.length !== SUBMARINE_MISSIONS.length
  )
    mismatch(c, "submarine_missions_v1 shipped mission definitions count");
  for (let i = 0; i < SUBMARINE_MISSIONS.length; i += 1) {
    const shipped = MISSION_DEFINITION_SURFACES[i];
    const tampered = c.shippedMissionDefinitions[i];
    if (!shipped || !tampered)
      mismatch(c, `submarine_missions_v1 definition missing at index ${i}`);
    if (tampered.missionId !== shipped.missionId)
      mismatch(c, `submarine_missions_v1 §6 mission id at index ${i}`);
    if (tampered.topicLabel !== shipped.topicLabel)
      mismatch(c, `submarine_missions_v1 topic label for ${shipped.missionId}`);
    if (tampered.missionPriority !== shipped.missionPriority)
      mismatch(c, `submarine_missions_v1 §26.4 mission priority for ${shipped.missionId}`);
  }
  // §26.4 canonical ordering is by mission priority — the shipped priority field
  // MUST be an injective (no ties) ascending sequence so INC-8's ordering is
  // deterministic and total.
  const priorities = c.shippedMissionDefinitions.map((m) => m.missionPriority);
  for (let i = 0; i < priorities.length; i += 1) {
    const prev = priorities[i - 1];
    const next = priorities[i];
    if (prev !== undefined && next !== undefined && !(next > prev))
      mismatch(c, "submarine_missions_v1 §26.4 priorities must be strictly ascending");
  }
  if (!c.shippedMissionIds || !arrayEquals(c.shippedMissionIds, SUBMARINE_MISSIONS))
    mismatch(c, "submarine_missions_v1 shipped mission id list");
  void c;
}

// submarine_reliability_v1 (§7)

export interface SubmarineReliabilityContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  reliabilityRangeMin: number; // §7 exact: 0
  reliabilityRangeMax: number; // §7 exact: 100
  offensiveDeploymentFloor: number; // §7 exact: 20
  multiplierTableBp: ReadonlyArray<{ min: number; max: number; multiplierBp: number }>;
}

export const SHIPPED_SUBMARINE_RELIABILITY_CONTRACT: SubmarineReliabilityContract = {
  policyId: submarineReliabilityPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  reliabilityRangeMin: SUBMARINE_RELIABILITY_MIN,
  reliabilityRangeMax: SUBMARINE_RELIABILITY_MAX,
  offensiveDeploymentFloor: SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR,
  multiplierTableBp: SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP,
};

export function validateSubmarineReliabilityContract(
  c: Partial<SubmarineReliabilityContract> | null | undefined,
): asserts c is SubmarineReliabilityContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_reliability_v1 missing contract");
  if (c.policyId !== submarineReliabilityPolicyId)
    mismatch(c, "submarine_reliability_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_reliability_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_reliability_v1 basis-point scale");
  if (
    c.reliabilityRangeMin !== SUBMARINE_RELIABILITY_MIN ||
    c.reliabilityRangeMax !== SUBMARINE_RELIABILITY_MAX
  )
    mismatch(c, "submarine_reliability_v1 §7 integer range [0, 100]");
  if (c.offensiveDeploymentFloor !== SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR)
    mismatch(c, "submarine_reliability_v1 §7 offensive-deployment floor of 20");
  if (!c.multiplierTableBp || c.multiplierTableBp.length !== 6)
    mismatch(c, "submarine_reliability_v1 §7 six-band multiplier table");
  const shipped = SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP;
  for (let i = 0; i < shipped.length; i += 1) {
    const s = shipped[i];
    const t = c.multiplierTableBp[i];
    if (!s || !t) mismatch(c, `submarine_reliability_v1 §7 band missing at index ${i}`);
    if (t.min !== s.min || t.max !== s.max || t.multiplierBp !== s.multiplierBp)
      mismatch(
        c,
        `submarine_reliability_v1 §7 band ${s.min}..${s.max} must be ${s.multiplierBp} bp`,
      );
  }
  void c;
}

// submarine_proximity_v1 (§8)

export interface SubmarineProximityContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  proximityBands: ReadonlyArray<{
    band: string;
    minDistance: number;
    maxDistance: number;
  }>;
}

const PROXIMITY_BAND_DEFINITIONS: SubmarineProximityContract["proximityBands"] = [
  { band: "LOCAL", minDistance: 0, maxDistance: 1 },
  { band: "REGIONAL", minDistance: 2, maxDistance: 3 },
  { band: "REMOTE", minDistance: 4, maxDistance: 6 },
  { band: "EXTREME_REMOTE", minDistance: 7, maxDistance: Infinity },
];

export const SHIPPED_SUBMARINE_PROXIMITY_CONTRACT: SubmarineProximityContract = {
  policyId: submarineProximityPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  proximityBands: PROXIMITY_BAND_DEFINITIONS,
};

export function validateSubmarineProximityContract(
  c: Partial<SubmarineProximityContract> | null | undefined,
): asserts c is SubmarineProximityContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_proximity_v1 missing contract");
  if (c.policyId !== submarineProximityPolicyId)
    mismatch(c, "submarine_proximity_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_proximity_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_proximity_v1 basis-point scale");
  if (!c.proximityBands || c.proximityBands.length !== 4)
    mismatch(c, "submarine_proximity_v1 §8 four-band table");
  for (let i = 0; i < PROXIMITY_BAND_DEFINITIONS.length; i += 1) {
    const s = PROXIMITY_BAND_DEFINITIONS[i];
    const t = c.proximityBands[i];
    if (!s || !t) mismatch(c, `submarine_proximity_v1 band missing at index ${i}`);
    if (t.band !== s.band || t.minDistance !== s.minDistance || t.maxDistance !== s.maxDistance)
      mismatch(c, `submarine_proximity_v1 §8 band ${s.band} bounds`);
  }
  void c;
}

// submarine_remote_efficiency_v1 (§9)

export interface SubmarineRemoteEfficiencyContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  efficiencyTableBp: ReadonlyArray<{
    submarineTypeId: string;
    bands: Record<string, number>;
  }>;
}

const REMOTE_EFFICIENCY_ENTRIES: SubmarineRemoteEfficiencyContract["efficiencyTableBp"] = [
  {
    submarineTypeId: "COASTAL",
    bands: { LOCAL: 10_000, REGIONAL: 7_500, REMOTE: 2_500, EXTREME_REMOTE: 0 },
  },
  {
    submarineTypeId: "MEDIUM_RANGE",
    bands: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 7_500, EXTREME_REMOTE: 5_000 },
  },
  {
    submarineTypeId: "LONG_RANGE",
    bands: { LOCAL: 10_000, REGIONAL: 11_000, REMOTE: 12_500, EXTREME_REMOTE: 10_000 },
  },
  {
    submarineTypeId: "MINELAYING",
    bands: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 8_000, EXTREME_REMOTE: 5_000 },
  },
  {
    submarineTypeId: "MISSILE",
    bands: { LOCAL: 10_000, REGIONAL: 10_000, REMOTE: 10_000, EXTREME_REMOTE: 9_000 },
  },
];

export const SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT: SubmarineRemoteEfficiencyContract = {
  policyId: submarineRemoteEfficiencyPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  efficiencyTableBp: REMOTE_EFFICIENCY_ENTRIES,
};

export function validateSubmarineRemoteEfficiencyContract(
  c: Partial<SubmarineRemoteEfficiencyContract> | null | undefined,
): asserts c is SubmarineRemoteEfficiencyContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_remote_efficiency_v1 missing contract");
  if (c.policyId !== submarineRemoteEfficiencyPolicyId)
    mismatch(c, "submarine_remote_efficiency_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_remote_efficiency_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_remote_efficiency_v1 basis-point scale");
  if (!c.efficiencyTableBp || c.efficiencyTableBp.length !== 5)
    mismatch(c, "submarine_remote_efficiency_v1 §9 five-type table");
  for (let i = 0; i < REMOTE_EFFICIENCY_ENTRIES.length; i += 1) {
    const s = REMOTE_EFFICIENCY_ENTRIES[i];
    const t = c.efficiencyTableBp[i];
    if (!s || !t) mismatch(c, `submarine_remote_efficiency_v1 entry missing at index ${i}`);
    if (t.submarineTypeId !== s.submarineTypeId)
      mismatch(c, `submarine_remote_efficiency_v1 type id at index ${i}`);
    for (const band of ["LOCAL", "REGIONAL", "REMOTE", "EXTREME_REMOTE"] as const) {
      if (t.bands[band] !== s.bands[band])
        mismatch(c, `submarine_remote_efficiency_v1 ${s.submarineTypeId} ${band} value`);
    }
  }
  void c;
}

// submarine_long_range_asw_vulnerability_v1 (§10)

export interface SubmarineLongRangeAswVulnerabilityContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  validRangeMin: number;
  validRangeMax: number;
  vulnerabilityTableBp: Record<string, number>;
  neutralVulnerabilityBp: number;
}

export const SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT: SubmarineLongRangeAswVulnerabilityContract =
  {
    policyId: submarineLongRangeAswVulnerabilityPolicyId,
    rulesetVersion: SUBMARINE_RULESET_VERSION,
    formulaVersion: SUBMARINE_FORMULA_VERSION,
    basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
    validRangeMin: SUBMARINE_BASIS_POINTS_PER_UNIT,
    validRangeMax: 12_500,
    vulnerabilityTableBp: SUBMARINE_ASW_VULNERABILITY_BP,
    neutralVulnerabilityBp: SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP,
  };

export function validateSubmarineLongRangeAswVulnerabilityContract(
  c: Partial<SubmarineLongRangeAswVulnerabilityContract> | null | undefined,
): asserts c is SubmarineLongRangeAswVulnerabilityContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_long_range_asw_vulnerability_v1 missing contract");
  if (c.policyId !== submarineLongRangeAswVulnerabilityPolicyId)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 basis-point scale");
  if (c.validRangeMin !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 valid range min 10_000");
  if (c.validRangeMax !== 12_500)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 valid range max 12_500");
  if (!c.vulnerabilityTableBp)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 table missing");
  for (const band of ["LOCAL", "REGIONAL", "REMOTE", "EXTREME_REMOTE"] as const) {
    if (c.vulnerabilityTableBp[band] !== SUBMARINE_ASW_VULNERABILITY_BP[band])
      mismatch(c, `submarine_long_range_asw_vulnerability_v1 ${band} value`);
  }
  if (c.neutralVulnerabilityBp !== SUBMARINE_NEUTRAL_ASW_VULNERABILITY_BP)
    mismatch(c, "submarine_long_range_asw_vulnerability_v1 neutral baseline");
  void c;
}

// submarine_effectiveness_v1 (§11 + §12)
