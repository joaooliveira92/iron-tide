import {
  isHighTension,
  tensionLabel,
  type DiplomacyRelationKind,
  type TensionLabel,
} from "@bluewave/campaign-engine";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { nationFlagUrl } from "../../content/nation-flag.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { nationIdToCountryId } from "../new-game/nation-selection/slotBridge.js";
import { nationDossier } from "../../content/presentationContent.js";
import {
  RELATION_LABELS,
  areaName,
  describeDraft,
  durationLabel,
  monthsBetween,
  warScoreSplit,
  warStanding,
  type WarStanding,
  sortActions,
  diplomacyLegalActions,
  nationName,
  sideLabel,
  tensionBadgeLabel,
} from "./diplomacy-presentation.js";
import type { DiplomacyActionKind, DiplomacyDraftCommand } from "./diplomacy-screen-state.js";

type Projection = DiplomacyScreenProjection;
type War = Projection["wars"][number];

export interface DiplomacyRelationRow {
  readonly flagUrl: string | null;
  readonly relation: DiplomacyRelationKind;
  readonly band: TensionLabel;
  readonly atWar: boolean;
  readonly allied: boolean;
  readonly blockades: readonly DiplomacyBlockadeRow[];
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
  readonly yourFlagUrl: string | null;
  readonly enemyFlagUrl: string | null;
  readonly standing: WarStanding;
  readonly duration: string;
  readonly blockades: readonly DiplomacyBlockadeRow[];
}

export interface DiplomacyBlockadeRow {
  readonly key: string;
  readonly blockaderName: string;
  readonly blockadedName: string;
  readonly areaLabel: string;
  readonly establishedMonth: string;
}

export interface DiplomacyPosture {
  readonly activeWars: number;
  readonly allies: number;
  readonly pacts: number;
  readonly blockades: number;
  readonly mostTense: {
    readonly partnerNationId: string;
    readonly partnerName: string;
    readonly tension: number;
    readonly band: TensionLabel;
  } | null;
}

export interface DiplomacyViewModel {
  readonly playerFlagUrl: string | null;
  readonly draftFlagUrl: string | null;
  readonly posture: DiplomacyPosture;
  readonly relations: readonly DiplomacyRelationRow[];
  readonly wars: readonly DiplomacyWarRow[];
  readonly blockades: readonly DiplomacyBlockadeRow[];
  readonly draftLabel: string | null;
}

function likelyRivalNames(playerNationId: string): readonly string[] {
  const playerCountryId = nationIdToCountryId(playerNationId);
  return playerCountryId !== null ? nationDossier(playerCountryId).likelyRivals : [];
}

function threatOrder(a: DiplomacyRelationRow, b: DiplomacyRelationRow): number {
  if (a.atWar !== b.atWar) return a.atWar ? -1 : 1;
  if (a.tension !== b.tension) return b.tension - a.tension;
  return a.partnerName.localeCompare(b.partnerName);
}

function blockadeRow(projection: Projection, blockade: Projection["blockades"][number]) {
  return {
    key: `${blockade.blockaderId}:${blockade.blockadedNationId}:${blockade.areaId}`,
    blockaderName: nationName(projection, blockade.blockaderId),
    blockadedName: nationName(projection, blockade.blockadedNationId),
    areaLabel: areaName(projection, blockade.areaId),
    establishedMonth: blockade.establishedMonth,
  };
}

export function buildDiplomacyViewModel(
  projection: Projection,
  draft: DiplomacyDraftCommand | null,
): DiplomacyViewModel {
  const rivals = likelyRivalNames(projection.playerNationId);
  const blockades = projection.blockades.map((b) => ({
    row: blockadeRow(projection, b),
    nationIds: [b.blockaderId, b.blockadedNationId],
  }));
  const relations: DiplomacyRelationRow[] = projection.relations
    .map((row) => ({
      flagUrl: nationFlagUrl(row.partnerNationId),
      relation: row.relation,
      band: tensionLabel(row.tension),
      atWar: row.relation === "at_war",
      allied: row.relation === "allied",
      blockades: blockades
        .filter((b) => b.nationIds.includes(row.partnerNationId))
        .map((b) => b.row),
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
      actions: sortActions(diplomacyLegalActions(row)),
    }))
    .sort(threatOrder);
  const tensest = relations.find((r) => !r.atWar) ?? relations[0];
  return {
    playerFlagUrl: nationFlagUrl(projection.playerNationId),
    draftFlagUrl: draft === null ? null : nationFlagUrl(draft.partnerNationId),
    posture: {
      activeWars: projection.wars.filter((w) => w.status === "ACTIVE").length,
      allies: relations.filter((r) => r.allied).length,
      pacts: relations.filter((r) => r.nap).length,
      blockades: projection.blockades.length,
      mostTense:
        tensest === undefined
          ? null
          : {
              partnerNationId: tensest.partnerNationId,
              partnerName: tensest.partnerName,
              tension: tensest.tension,
              band: tensest.band,
            },
    },
    relations,
    wars: projection.wars.map((war) => {
      const memberIds = [...war.attackerSideMembers, ...war.defenderSideMembers];
      return {
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
        yourFlagUrl: nationFlagUrl(projection.playerNationId),
        enemyFlagUrl: nationFlagUrl(
          war.playerSide === "attacker" ? war.defenderId : war.attackerId,
        ),
        standing: warStanding(warScoreSplit(war)),
        duration: durationLabel(monthsBetween(war.startDate, projection.month)),
        blockades: blockades
          .filter((b) => b.nationIds.every((id) => memberIds.includes(id)))
          .map((b) => b.row),
      };
    }),
    blockades: blockades.map((b) => b.row),
    draftLabel: draft === null ? null : describeDraft(projection, draft),
  };
}
