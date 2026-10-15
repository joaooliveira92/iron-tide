//packages/combat/src/generation/repair.ts
import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_COMPOSITION_IRREPARABLE } from "./reasonCodes.js";

export const BATTLE_COMPOSITION_REPAIR_V1 = "battle_composition_repair_v1" as const;

// DESIGN-37 §28: at most exactly 3 repair passes; permitted range 1..5.
export const REPAIR_MAX_PASSES = 3;
export const REPAIR_MIN_PASSES = 1;
export const REPAIR_MAX_RANGE = 5;

export interface RepairAction {
  kind:
    | "REMOVE_OPTIONAL_INELIGIBLE"
    | "REPLACE_OPTIONAL"
    | "SPLIT_PERMANENT_REMNANT"
    | "FILL_OPTIONAL_COMMAND_VACANCY"
    | "REDUCE_GENERATED_ELEMENTS"
    | "CHANGE_OPTIONAL_FORMATION";
  assetId?: string;
}

// DESIGN-37 §28 repair ordering.
export const REPAIR_ORDER: RepairAction["kind"][] = [
  "REMOVE_OPTIONAL_INELIGIBLE",
  "REPLACE_OPTIONAL",
  "SPLIT_PERMANENT_REMNANT",
  "FILL_OPTIONAL_COMMAND_VACANCY",
  "REDUCE_GENERATED_ELEMENTS",
  "CHANGE_OPTIONAL_FORMATION",
];

export interface RepairResult {
  actions: RepairAction[];
  passes: number;
  repaired: boolean;
}

// Structural repair driver: iterates up to 3 passes applying only the permitted
// actions; if still invalid the caller rejects with BATTLE_COMPOSITION_IRREPARABLE.
export function battleCompositionRepairV1(
  invalidOptionalAssets: string[],
  optionalCandidatePool: string[],
): RepairResult {
  const actions: RepairAction[] = [];
  let passes = 0;

  const invalid = [...invalidOptionalAssets];
  while (invalid.length > 0 && passes < REPAIR_MAX_PASSES) {
    passes++;
    const removed = invalid.shift()!;
    actions.push({ kind: "REMOVE_OPTIONAL_INELIGIBLE", assetId: removed });
    if (optionalCandidatePool.length > 0) {
      const replacement = optionalCandidatePool.shift()!;
      actions.push({ kind: "REPLACE_OPTIONAL", assetId: replacement });
    }
  }

  return { actions, passes, repaired: invalid.length === 0 };
}

export function assertRepairable(passes: number, context?: Record<string, unknown>): void {
  if (passes > REPAIR_MAX_PASSES) {
    throw new BluewaveError(BATTLE_COMPOSITION_IRREPARABLE, {
      code: BATTLE_COMPOSITION_IRREPARABLE,
      passes,
      maxPasses: REPAIR_MAX_PASSES,
      ...context,
    });
  }
}
