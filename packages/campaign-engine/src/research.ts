import type { CampaignState } from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { economyOutlook, type ResearchUnfundedReason } from "@bluewave/campaign";
import type { PlayerProjectionMonth } from "./projection.js";

/**
 * Research & Technology screen projection (desktop-engine-feature-gate INC-1).
 * Every field is a pure, deterministic derivation over the compiled
 * `CampaignSnapshot`'s `nation.research` (`ResearchState`) — no session state,
 * no I/O, no randomness — so the desktop bridge can rebuild the same
 * `ResearchScreenProjection` from the exact same immutable snapshot on every
 * `inspectResearchScreen` call.
 *
 * Nothing is fabricated (spec D3): `researchBudget`, `fieldPriorities`,
 * `discoveredTechIds`, `inProgressTechnologies` and `currentProjectTechId`
 * map one-to-one to `ResearchState` fields. `currentProjectTechId` is `null`
 * when the state carries no authored/selected project (the field is optional
 * on `ResearchState`).
 *
 * The canonical research-field registry and priority weights
 * (`CANONICAL_RESEARCH_FIELD_IDS`, `RESEARCH_FIELD_PRIORITY_WEIGHTS`,
 * `MAX_HIGH_PRIORITY_FIELDS`) are re-exported here from
 * `@bluewave/content-schema` (DESIGN-20 §1/§5 — the authoritative source the
 * phase engine's `SetResearchPriorityCommand` validation uses), so the
 * desktop's main-process command issue path and the renderer's edit controls
 * share one constant set instead of duplicating it.
 */
export { CANONICAL_RESEARCH_FIELD_IDS, MAX_HIGH_PRIORITY_FIELDS, RESEARCH_FIELD_PRIORITY_WEIGHTS };
export type { ResearchFieldId } from "@bluewave/content-schema";

/** One row of `ResearchState.technologies` flattened for UI rendering. */
export interface ResearchInProgressTechnology {
  readonly techId: string;
  /** `TechnologyProgress.investedPoints` in SafeInt-friendly UI units. */
  readonly investedPoints: number;
  readonly completed: boolean;
}

/** The Research & Technology screen's slice of a nation's `ResearchState`. */
export interface ResearchScreenProjection {
  readonly nationId: string;
  /** `ResearchState.researchBudget` (SafeInt) as a UI number: the standing monthly spend. */
  readonly researchBudget: number;
  /** The authored annual allocation the standing monthly spend was derived from; null when the nation has none (spec #138). */
  readonly annualAllocation: number | null;
  /** The most the nation may fund a month: `floor(12% x monthly revenue)`; 0 when its appropriation is too small to fund research. */
  readonly researchCap: number;
  /** Why the standing budget is not paid next month, or null when it is (or none is set). */
  readonly unfundedReason: ResearchUnfundedReason | null;
  /** `ResearchState.fieldPriorities`, same integer weight scale the engine
   * interprets (`RESEARCH_FIELD_PRIORITY_WEIGHTS`). Carries only the fields
   * the compiled snapshot actually holds — partial records are NOT padded. */
  readonly fieldPriorities: Readonly<Record<string, number>>;
  /** `ResearchState.discoveredTechs`, sorted for deterministic rendering. */
  readonly discoveredTechIds: readonly string[];
  /** `ResearchState.technologies` — in-progress AND completed tech work. */
  readonly inProgressTechnologies: readonly ResearchInProgressTechnology[];
  /** `ResearchState.currentProjectTechId`, `null` when not set. */
  readonly currentProjectTechId: string | null;
}

/**
 * Builds the research-screen projection for `playerSlotId` from a real
 * compiled `CampaignState` (INC-1). Returns `undefined` when
 * `playerSlotId` doesn't resolve to a nation in the snapshot — the same
 * convention as `buildPlayerProjection`; the desktop handler turns that into
 * a stable `UNKNOWN_PLAYER_SLOT` error result.
 */
export function buildResearchScreenProjection(
  state: CampaignState,
  playerSlotId: string,
  _month: PlayerProjectionMonth,
): ResearchScreenProjection | undefined {
  const nation = state.snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  const research = nation.research;
  const outlook = economyOutlook(state.snapshot, playerSlotId)!;
  const fieldPriorities: Record<string, number> = {};
  for (const [fieldId, weight] of Object.entries(research.fieldPriorities)) {
    fieldPriorities[fieldId] = Number(weight);
  }

  return {
    nationId: research.nationId,
    researchBudget: Number(research.researchBudget),
    annualAllocation:
      research.annualResearchAllocation === undefined
        ? null
        : Number(research.annualResearchAllocation),
    researchCap: outlook.researchCap,
    unfundedReason: outlook.researchUnfundedReason ?? null,
    fieldPriorities,
    discoveredTechIds: [...research.discoveredTechs].sort((a, b) => a.localeCompare(b)),
    inProgressTechnologies: research.technologies.map((tech) => ({
      techId: tech.techId,
      investedPoints: Number(tech.investedPoints),
      completed: tech.completed,
    })),
    currentProjectTechId: research.currentProjectTechId ?? null,
  };
}
