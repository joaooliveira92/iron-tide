import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { warScoreSplit } from "../diplomacy/diplomacy-presentation.js";
import { nationFlagUrl } from "../../content/nation-flag.js";

/** The relation of a nation to the player, as the rail states it in words. */
export type NationRailRelation = "self" | "peace" | "pact" | "alliance" | "war" | "trade";

export interface NationRailRow {
  readonly nationId: string;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly relation: NationRailRelation;
  /** Words only: the relation is never carried by colour alone. */
  readonly relationLabel: string;
  readonly blockade: boolean;
  /** Present only while the player is in an active war against this nation. */
  readonly warScore: { readonly yours: number; readonly enemy: number } | null;
  readonly tension: number | null;
  readonly since: string | null;
  /** Resolved flag art URL, or null when the power has none — the view renders a value, not a lookup. */
  readonly flagUrl: string | null;
}

const BASE_LABEL: Readonly<Record<NationRailRelation, string>> = {
  self: "You",
  peace: "Peace",
  pact: "Non-aggression pact",
  alliance: "Alliance",
  war: "War",
  trade: "Trade agreement",
};

type DiplomacyRelation = DiplomacyScreenProjection["relations"][number]["relation"];

const RELATION_BY_DIPLOMACY: Readonly<Record<DiplomacyRelation, NationRailRelation>> = {
  neutral: "peace",
  at_war: "war",
  allied: "alliance",
  trade_agreement: "trade",
};

/**
 * Engine precedence, preserved: war > alliance > non-aggression pact > trade
 * agreement > peace. A pact overrides a trade agreement but never a war or alliance.
 */
function relationFor(
  row: DiplomacyScreenProjection["relations"][number] | undefined,
): NationRailRelation {
  if (row === undefined) return "peace";
  if (row.nap && row.relation !== "at_war" && row.relation !== "allied") return "pact";
  return RELATION_BY_DIPLOMACY[row.relation];
}

/**
 * Pure view-model for the nation rail, derived from the Diplomacy & War
 * projection (the same `inspectDiplomacyScreen` view the Diplomacy screen
 * reads). The player is pinned first; the rest follow by name.
 */
export function buildNationRail(
  projection: DiplomacyScreenProjection,
  playerName: string,
): readonly NationRailRow[] {
  const player = projection.playerNationId;
  const rows: NationRailRow[] = [
    {
      nationId: player,
      name: playerName,
      isPlayer: true,
      relation: "self",
      relationLabel: BASE_LABEL.self,
      blockade: false,
      warScore: null,
      tension: null,
      since: null,
      flagUrl: nationFlagUrl(player),
    },
  ];
  const others = [...projection.knownNations].sort((a, b) => a.name.localeCompare(b.name));
  for (const nation of others) {
    const row = projection.relations.find((r) => r.partnerNationId === nation.nationId);
    const blockade = projection.blockades.some(
      (b) =>
        (b.blockaderId === player && b.blockadedNationId === nation.nationId) ||
        (b.blockaderId === nation.nationId && b.blockadedNationId === player),
    );
    const relation = relationFor(row);
    const war =
      relation === "war"
        ? projection.wars.find((w) => {
            if (w.status !== "ACTIVE") return false;
            const opposing =
              w.playerSide === "attacker" ? w.defenderSideMembers : w.attackerSideMembers;
            return opposing.includes(nation.nationId);
          })
        : undefined;
    const split = war === undefined ? null : warScoreSplit(war);
    rows.push({
      nationId: nation.nationId,
      name: nation.name,
      isPlayer: false,
      relation,
      relationLabel: blockade ? `${BASE_LABEL[relation]}, blockade` : BASE_LABEL[relation],
      blockade,
      warScore: split === null ? null : { yours: split.yours, enemy: split.enemy },
      tension: row?.tension ?? null,
      since: row?.since ?? null,
      flagUrl: nationFlagUrl(nation.nationId),
    });
  }
  return rows;
}
