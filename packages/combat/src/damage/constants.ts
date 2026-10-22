import { BluewaveError } from "@bluewave/contracts";
import { DAMAGE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const damagePolicyId = "damage_v1" as const;

export const DAMAGE_RULESET_VERSION = "damage_ruleset_v1" as const;
export const DAMAGE_FORMULA_VERSION = "damage_formula_v1" as const;

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

export const TERMINAL_STATUSES = ["NORMAL", "SINKING", "FOUNDERED"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

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
