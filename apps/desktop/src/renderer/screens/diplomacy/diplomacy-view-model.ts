import { isHighTension, tensionLabel } from "@bluewave/campaign-engine";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { nationIdToCountryId } from "../new-game/nation-selection/slotBridge.js";
import { nationDossier } from "../../content/presentationContent.js";
import {
  RELATION_LABELS,
  areaName,
  describeDraft,
  diplomacyLegalActions,
  nationName,
  sideLabel,
  tensionBadgeLabel,
} from "./diplomacy-presentation.js";
import type { DiplomacyActionKind, DiplomacyDraftCommand } from "./diplomacy-screen-state.js";

type Projection = DiplomacyScreenProjection;
type War = Projection["wars"][number];

export interface DiplomacyRelationRow {
  readonly partnerNationId: string;
  readonly partnerName: string;
  readonly since: string;
  readonly relationLabel: string;
  readonly tension: number;
  readonly tensionBadge: string | null;
  readonly nap: boolean;
  readonly isLikelyRival: boolean;
  readonly highTension: boolean;
  readonly highTensionNote: string;
  readonly actions: readonly DiplomacyActionKind[];
}

export interface DiplomacyWarRow {
  readonly war: War;
  readonly attackerSideLabel: string;
  readonly defenderSideLabel: string;
  readonly yourName: string;
  readonly enemyName: string;
}

export interface DiplomacyBlockadeRow {
  readonly key: string;
  readonly blockaderName: string;
  readonly blockadedName: string;
  readonly areaLabel: string;
  readonly establishedMonth: string;
}

export interface DiplomacyViewModel {
  readonly relations: readonly DiplomacyRelationRow[];
  readonly wars: readonly DiplomacyWarRow[];
  readonly blockades: readonly DiplomacyBlockadeRow[];
  readonly draftLabel: string | null;
}

function likelyRivalNames(playerNationId: string): readonly string[] {
  const playerCountryId = nationIdToCountryId(playerNationId);
  return playerCountryId !== null ? nationDossier(playerCountryId).likelyRivals : [];
}

/**
 * Pure view-model for the Diplomacy & War screen: turns the engine projection
 * into render-ready relation/war/blockade rows with every display label and
 * affordance derived once. The engine remains the only authority; this module
 * only packages projected data for presentation.
 */
export function buildDiplomacyViewModel(
  projection: Projection,
  draft: DiplomacyDraftCommand | null,
): DiplomacyViewModel {
  const rivals = likelyRivalNames(projection.playerNationId);
  return {
    relations: projection.relations.map((row) => ({
      partnerNationId: row.partnerNationId,
      partnerName: row.partnerName,
      since: row.since,
      relationLabel: RELATION_LABELS[row.relation],
      tension: row.tension,
      tensionBadge: tensionBadgeLabel(row.relation, row.tension),
      nap: row.nap,
      isLikelyRival: rivals.includes(row.partnerName),
      highTension: isHighTension(row.tension),
      highTensionNote: humanizeId(tensionLabel(row.tension)).toLowerCase(),
      actions: diplomacyLegalActions(row),
    })),
    wars: projection.wars.map((war) => ({
      war,
      attackerSideLabel: sideLabel(projection, war.attackerSideMembers),
      defenderSideLabel: sideLabel(projection, war.defenderSideMembers),
      yourName: sideLabel(
        projection,
        war.playerSide === "attacker" ? war.attackerSideMembers : war.defenderSideMembers,
      ),
      enemyName: sideLabel(
        projection,
        war.playerSide === "attacker" ? war.defenderSideMembers : war.attackerSideMembers,
      ),
    })),
    blockades: projection.blockades.map((blockade) => ({
      key: `${blockade.blockaderId}:${blockade.blockadedNationId}:${blockade.areaId}`,
      blockaderName: nationName(projection, blockade.blockaderId),
      blockadedName: nationName(projection, blockade.blockadedNationId),
      areaLabel: areaName(projection, blockade.areaId),
      establishedMonth: blockade.establishedMonth,
    })),
    draftLabel: draft === null ? null : describeDraft(projection, draft),
  };
}
