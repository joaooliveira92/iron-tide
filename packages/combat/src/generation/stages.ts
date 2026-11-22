import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { BattleMissionOpportunity } from "./opportunity.js";

export const GENERATION_STAGES = [
  "DETERMINE_MISSION_OPPORTUNITIES",
  "DETERMINE_PARTICIPATING_SIDES",
  "CREATE_FORCE_REQUIREMENTS",
  "GATHER_ELIGIBLE_ASSETS",
  "PRESERVE_PERMANENT_DIVISIONS",
  "ASSIGN_MANDATORY_ROLES",
  "SELECT_OPTIONAL_ASSETS",
  "ADD_ALLIED_SUPPORT",
  "INSTANTIATE_GENERATED_ELEMENTS",
  "VALIDATE_REACHABILITY_AND_LEGALITY",
  "REPAIR_GENERATED_COMPOSITION",
  "REJECT_IRREPARABLE_ENGAGEMENTS",
  "CANONICALIZE_BATTLE_MANIFEST",
  "ASSIGN_BATTLE_SEED",
  "CREATE_INTELLIGENCE_LIMITED_PRESENTATION",
] as const;
export type GenerationStage = (typeof GENERATION_STAGES)[number];

export interface BattleGenerationStageRecord {
  opportunityId: string;
  prospectiveBattleId: string;
  stageId: GenerationStage;
  ordinal: number;
  inputHashes: string[];
  orderedCandidates: string[];
  predicateResults: string[];
  selections: string[];
  exclusions: string[];
  randomDecisionRefs: string[];
  repairs: string[];
  resultCode: string;
  outputHash: string;
  rulesetVersion: string;
  formulaVersion: string;
}

export function stageRecord(
  opp: BattleMissionOpportunity,
  prospectiveBattleId: string,
  stageId: GenerationStage,
  rulesetVersion: string,
  formulaVersion: string,
  extra: Partial<BattleGenerationStageRecord> = {},
): BattleGenerationStageRecord {
  return {
    opportunityId: opp.opportunityId,
    prospectiveBattleId,
    stageId,
    ordinal: GENERATION_STAGES.indexOf(stageId) + 1,
    inputHashes: [],
    orderedCandidates: [],
    predicateResults: [],
    selections: [],
    exclusions: [],
    randomDecisionRefs: [],
    repairs: [],
    resultCode: "OK",
    outputHash: sha256Hex(canonicalSerialize({ stageId, opportunityId: opp.opportunityId })),
    rulesetVersion,
    formulaVersion,
    ...extra,
  };
}
