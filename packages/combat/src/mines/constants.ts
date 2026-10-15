//packages/combat/src/mines/constants.ts
// Versioned authoritative mine-type constants (DESIGN-35 §2/§9/§15/§21 surface
// shipped by INC-1) shipped as a `mine_type_definitions_v1` policy +
// `SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT` + `validateMineTypeDefinitionsContract`,
// mirroring packages/combat/src/torpedoes/constants.ts. Fail-closed on
// mismatch. DESIGN-35's own numbers are exact/shipped — no research grounding
// needed (ticket 04/06, docs/research/c2-m3-mine-warfare.md). Pure/deterministic:
// fixed integer constants only.
import { BluewaveError } from "@bluewave/contracts";
import { INVALID_MINE_TYPE_DEFINITION } from "./reasonCodes.js";

export const mineTypeDefinitionsPolicyId = "mine_type_definitions_v1" as const;

export const MINE_RULESET_VERSION = "mine_ruleset_v1" as const;
export const MINE_FORMULA_VERSION = "mine_formula_v1" as const;

// fixed-point scale shared by every basis-point quantity in this subsystem.
export const MINE_BASIS_POINTS_PER_UNIT = 10_000 as const;

// DESIGN-35 §2 canonical mine-type enum — exactly these six values.
export const MINE_TYPES = [
  "CONTACT",
  "MAGNETIC",
  "ACOUSTIC",
  "CONTROLLED_DEFENSIVE",
  "SUBMARINE_LAID",
  "SCENARIO_SPECIAL",
] as const;
export type MineType = (typeof MINE_TYPES)[number];

// DESIGN-35 §3 canonical mine-source-kind enum — exactly these six values.
// Full source *records*/eligibility predicates ship in INC-2; this increment
// only needs the closed vocabulary to populate MineTypeDefinition.eligibleLayingSourceKinds.
export const MINE_SOURCE_KINDS = [
  "CONTROLLED_NAVAL_BASE",
  "COASTAL_ARTILLERY_OR_CONTROLLED_MINE_INSTALLATION",
  "MINE_CAPABLE_SURFACE_SHIP",
  "MINELAYING_SUBMARINE",
  "SCENARIO_MINEFIELD",
  "TYPED_EVENT_MINEFIELD",
] as const;
export type MineSourceKind = (typeof MINE_SOURCE_KINDS)[number];

// DESIGN-35 §14 "target class eligible for that mine type" vocabulary. DESIGN-35
// does not narrow eligibility per canonical mine type (no per-type restriction
// table is given), so every shipped type definition below declares both
// classes eligible — a per-type narrowing is content-authoring, deferred.
export const MINE_TARGET_CLASSES = ["SURFACE_SHIP", "SUBMARINE"] as const;
export type MineTargetClass = (typeof MINE_TARGET_CLASSES)[number];

// DESIGN-35 §15 mine-strike outcome enum — the seven closed outcomes. Base
// severity weights (below) cover six of them; IMMOBILIZED_FOR_TOW is reached
// through modifier resolution, not the base roll (the six listed weights
// already total exactly 10_000 — DESIGN-35 §31 item 12).
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

// DESIGN-35 §9 sweep-resistance shapes. CONTACT/CONTROLLED_DEFENSIVE/
// SUBMARINE_LAID ship a single flat value; MAGNETIC/ACOUSTIC ship the
// capability-gated pair; SCENARIO_SPECIAL ships definition-required (no
// content pack is authored this sprint — a downstream lookup without a value
// fails MINE_SWEEP_RESISTANCE_MISSING, owned by INC-3).
export type MineSweepResistance =
  | { kind: "FLAT"; valueBp: number }
  | { kind: "CAPABILITY_GATED"; withCapabilityBp: number; withoutCapabilityBp: number }
  | { kind: "DEFINITION_REQUIRED" };

// DESIGN-35 §21 decay-policy shapes. CONTROLLED_DEFENSIVE ships the
// infrastructure-gated pair (§21 gives both explicit values); the other flat
// types ship a single retention value. freshnessRetentionBp is null when the
// mine type does not narrow freshness retention below the pressure-retention
// multiplier (§21: "uses the same multiplier unless ... a narrower explicit
// value").
export type MineDecayPolicy =
  | { kind: "FLAT"; retentionBp: number; freshnessRetentionBp: number | null }
  | {
      kind: "INFRASTRUCTURE_GATED";
      operationalRetentionBp: number;
      nonOperationalRetentionBp: number;
      freshnessRetentionBp: number | null;
    }
  | { kind: "DEFINITION_REQUIRED" };

// DESIGN-35 §25/§19-20/§11 shared policy ids: these formulas key off the
// mine-strike/report/battle-generation *event*, not the mine type (no
// per-type multiplier table is shipped by DESIGN-35), so every canonical type
// declares the same shipped policy id. Only the report-signature contract is
// actually named by DESIGN-35 (§20: "the report classifier MUST use
// `underwater_explosion_identification_v1`"). §11 and §25 only name RNG
// decision streams (`mine_warfare/battle/area/hazard_generation`,
// `mine_warfare/month/area/friendly_strike`), not policy-id constants — the
// friendly-fire and battle-generation ids below are authored placeholders
// (owned/formalized by the later increment that ships the contract itself),
// not DESIGN-35-literal names.
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
  // Fail closed on the shipped-type-id list: exact (ordered) equality with the
  // canonical §2 six-type set. A tampered/empty/extra list never passes.
  if (!c.shippedMineTypeIds || !arrayEquals(c.shippedMineTypeIds, MINE_TYPES))
    throwMismatch(c, "mine_type_definitions_v1 shipped mine-type id list");
}
