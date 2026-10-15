//packages/combat/src/damage/constants.ts
// Versioned authoritative damage base constants (DESIGN-41 §§1-9, §45-48) shipped as a
// `damage_v1` policy + `SHIPPED_DAMAGE_CONTRACT` + `validateDamageContract`,
// mirroring packages/combat/src/gunnery/constants.ts. Fail-closed on mismatch.
import { BluewaveError } from "@bluewave/contracts";
import { DAMAGE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const damagePolicyId = "damage_v1" as const;

// Ruleset and formula versions pinned by the damage_v1 contract.
export const DAMAGE_RULESET_VERSION = "damage_ruleset_v1" as const;
export const DAMAGE_FORMULA_VERSION = "damage_formula_v1" as const;

// The ten-stage pipeline stages in exact order (DESIGN-41 §3).
// Stages 7 and 10 are reserved for M3/C-5 flooding operations and damage control.
export const DAMAGE_PIPELINE_STAGES = [
  "HIT_LOCATION",
  "PROTECTION_INTERACTION",
  "LOCAL_COMPONENT_DAMAGE",
  "STRUCTURE_FLOTATION",
  "IMMEDIATE_FIRE_FLOODING",
  "SECONDARY_HAZARD",
  "STAGE_7_RESERVED",
  "TERMINAL_SEAM",
  "DAMAGE_EVENT_RECORD",
  "STAGE_10_RESERVED",
] as const;
export type DamagePipelineStage = (typeof DAMAGE_PIPELINE_STAGES)[number];

// Canonical damage packages of the seven categories.
export const DAMAGE_CATEGORIES = [
  "PENETRATION",
  "NON_PENETRATION",
  "SPLINTER",
  "FIRE",
  "FLOODING",
  "SECONDARY_HAZARD",
  "NO_EFFECT",
] as const;
export type DamageCategory = (typeof DAMAGE_CATEGORIES)[number];

// Terminal status values.
export const TERMINAL_STATUSES = ["NORMAL", "SINKING", "FOUNDERED"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

// ---------------------------------------------------------------------------
// DamagePolicyContract — ships all authored constant values.
export interface DamagePolicyContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  pipelineStages: readonly DamagePipelineStage[];
  damageCategories: readonly DamageCategory[];
  terminalStatuses: readonly TerminalStatus[];
}

export const SHIPPED_DAMAGE_CONTRACT: DamagePolicyContract = {
  policyId: damagePolicyId,
  rulesetVersion: DAMAGE_RULESET_VERSION,
  formulaVersion: DAMAGE_FORMULA_VERSION,
  pipelineStages: DAMAGE_PIPELINE_STAGES,
  damageCategories: DAMAGE_CATEGORIES,
  terminalStatuses: TERMINAL_STATUSES,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(DAMAGE_STATE_INVARIANT_FAILED, {
    code: DAMAGE_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateDamageContract(
  c: Partial<DamagePolicyContract> | null | undefined,
): asserts c is DamagePolicyContract {
  if (!c) throwMismatch(c, "damage_v1 missing contract");
  if (c.policyId !== damagePolicyId) throwMismatch(c, "damage_v1 expectant policy id");
  if (c.rulesetVersion !== DAMAGE_RULESET_VERSION || c.formulaVersion !== DAMAGE_FORMULA_VERSION)
    throwMismatch(c, "damage_v1 ruleset/formula versions");
  if (!c.pipelineStages || !arrayEquals(c.pipelineStages, DAMAGE_PIPELINE_STAGES))
    throwMismatch(c, "damage_v1 pipeline stage set");
  if (!c.damageCategories || !arrayEquals(c.damageCategories, DAMAGE_CATEGORIES))
    throwMismatch(c, "damage_v1 damage category set");
  if (!c.terminalStatuses || !arrayEquals(c.terminalStatuses, TERMINAL_STATUSES))
    throwMismatch(c, "damage_v1 terminal status set");
}
