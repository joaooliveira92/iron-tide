import { BluewaveError } from "@bluewave/contracts";
import { INVALID_MINE_TYPE_DEFINITION } from "./reasonCodes.js";

export const mineTypeDefinitionsPolicyId = "mine_type_definitions_v1" as const;

export const MINE_RULESET_VERSION = "mine_ruleset_v1" as const;
export const MINE_FORMULA_VERSION = "mine_formula_v1" as const;

export const MINE_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const MINE_TYPES = [
  "CONTACT",
  "MAGNETIC",
  "ACOUSTIC",
  "CONTROLLED_DEFENSIVE",
  "SUBMARINE_LAID",
  "SCENARIO_SPECIAL",
] as const;
export type MineType = (typeof MINE_TYPES)[number];

export const MINE_SOURCE_KINDS = [
  "CONTROLLED_NAVAL_BASE",
  "COASTAL_ARTILLERY_OR_CONTROLLED_MINE_INSTALLATION",
  "MINE_CAPABLE_SURFACE_SHIP",
  "MINELAYING_SUBMARINE",
  "SCENARIO_MINEFIELD",
  "TYPED_EVENT_MINEFIELD",
] as const;
export type MineSourceKind = (typeof MINE_SOURCE_KINDS)[number];

export const MINE_TARGET_CLASSES = ["SURFACE_SHIP", "SUBMARINE"] as const;
export type MineTargetClass = (typeof MINE_TARGET_CLASSES)[number];

export const MINE_STRIKE_OUTCOMES = [
  "DUD_OR_NO_DAMAGE",
  "MINOR_DAMAGE",
  "MAJOR_DAMAGE",
  "MISSION_KILL",
  "SINKING",
  "SUNK",
  "IMMOBILIZED_FOR_TOW",
] as const;
export type MineStrikeOutcome = (typeof MINE_STRIKE_OUTCOMES)[number];

export const MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP: Readonly<
  Record<Exclude<MineStrikeOutcome, "IMMOBILIZED_FOR_TOW">, number>
> = {
  DUD_OR_NO_DAMAGE: 1_500,
  MINOR_DAMAGE: 3_500,
  MAJOR_DAMAGE: 2_500,
  MISSION_KILL: 1_500,
  SINKING: 750,
  SUNK: 250,
};

export type MineSweepResistance =
  | { kind: "FLAT"; valueBp: number }
  | { kind: "CAPABILITY_GATED"; withCapabilityBp: number; withoutCapabilityBp: number }
  | { kind: "DEFINITION_REQUIRED" };

export type MineDecayPolicy =
  | { kind: "FLAT"; retentionBp: number; freshnessRetentionBp: number | null }
  | {
      kind: "INFRASTRUCTURE_GATED";
      operationalRetentionBp: number;
      nonOperationalRetentionBp: number;
      freshnessRetentionBp: number | null;
    }
  | { kind: "DEFINITION_REQUIRED" };

export const MINE_FRIENDLY_FIRE_POLICY_ID = "mine_friendly_fire_v1" as const;
export const MINE_BATTLE_GENERATION_POLICY_ID = "mine_battle_hazard_v1" as const;
export const MINE_REPORT_SIGNATURE_POLICY_ID = "underwater_explosion_identification_v1" as const;

export interface MineTypeDefinitionsContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  mineTypes: readonly MineType[];
  sourceKinds: readonly MineSourceKind[];
  targetClasses: readonly MineTargetClass[];
  strikeOutcomes: readonly MineStrikeOutcome[];
  strikeBaseSeverityWeightsBp: Record<Exclude<MineStrikeOutcome, "IMMOBILIZED_FOR_TOW">, number>;
  friendlyFirePolicyId: string;
  battleGenerationPolicyId: string;
  reportSignaturePolicyId: string;
  shippedMineTypeIds: readonly string[];
}

export const SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT: MineTypeDefinitionsContract = {
  policyId: mineTypeDefinitionsPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  mineTypes: MINE_TYPES,
  sourceKinds: MINE_SOURCE_KINDS,
  targetClasses: MINE_TARGET_CLASSES,
  strikeOutcomes: MINE_STRIKE_OUTCOMES,
  strikeBaseSeverityWeightsBp: MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP,
  friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
  battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
  reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
  shippedMineTypeIds: MINE_TYPES,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_TYPE_DEFINITION, {
    code: INVALID_MINE_TYPE_DEFINITION,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateMineTypeDefinitionsContract(
  c: Partial<MineTypeDefinitionsContract> | null | undefined,
): asserts c is MineTypeDefinitionsContract {
  if (!c) throwMismatch(c, "mine_type_definitions_v1 missing contract");
  if (c.policyId !== mineTypeDefinitionsPolicyId)
    throwMismatch(c, "mine_type_definitions_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "mine_type_definitions_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "mine_type_definitions_v1 basis-point scale");
  if (!c.mineTypes || !arrayEquals(c.mineTypes, MINE_TYPES))
    throwMismatch(c, "mine_type_definitions_v1 §2 closed mine-type enum");
  if (!c.sourceKinds || !arrayEquals(c.sourceKinds, MINE_SOURCE_KINDS))
    throwMismatch(c, "mine_type_definitions_v1 §3 closed source-kind enum");
  if (!c.targetClasses || !arrayEquals(c.targetClasses, MINE_TARGET_CLASSES))
    throwMismatch(c, "mine_type_definitions_v1 §14 target-class vocabulary");
  if (!c.strikeOutcomes || !arrayEquals(c.strikeOutcomes, MINE_STRIKE_OUTCOMES))
    throwMismatch(c, "mine_type_definitions_v1 §15 closed strike-outcome enum");
  if (!c.strikeBaseSeverityWeightsBp)
    throwMismatch(c, "mine_type_definitions_v1 §15 base severity weights missing");
  let total = 0;
  for (const outcome of MINE_STRIKE_OUTCOMES) {
    if (outcome === "IMMOBILIZED_FOR_TOW") continue;
    const weight = c.strikeBaseSeverityWeightsBp[outcome];
    if (weight !== MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP[outcome])
      throwMismatch(c, `mine_type_definitions_v1 §15 base severity weight for ${outcome}`);
    total += weight;
  }
  if (total !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "mine_type_definitions_v1 §15 base severity weights must total 10_000");
  if (c.friendlyFirePolicyId !== MINE_FRIENDLY_FIRE_POLICY_ID)
    throwMismatch(c, "mine_type_definitions_v1 §25 friendly-fire policy id");
  if (c.battleGenerationPolicyId !== MINE_BATTLE_GENERATION_POLICY_ID)
    throwMismatch(c, "mine_type_definitions_v1 §11 battle-generation policy id");
  if (c.reportSignaturePolicyId !== MINE_REPORT_SIGNATURE_POLICY_ID)
    throwMismatch(c, "mine_type_definitions_v1 §20 report-signature policy id");
  if (!c.shippedMineTypeIds || !arrayEquals(c.shippedMineTypeIds, MINE_TYPES))
    throwMismatch(c, "mine_type_definitions_v1 shipped mine-type id list");
}
