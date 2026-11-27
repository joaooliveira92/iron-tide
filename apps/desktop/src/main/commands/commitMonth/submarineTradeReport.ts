import type {
  BlockadeState,
  SubmarinePolicy,
  TradeDutyDesign,
  TradeProtectionRules,
  WarDeclaration,
} from "@bluewave/campaign";
import {
  explainSubmarineTrade,
  submarineTradeAttackers,
  type SubmarineTradeAttacker,
  type SubmarineTradeShip,
} from "@bluewave/campaign-engine";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { ExplanationTree } from "@bluewave/events";

const SUBMARINE_ATTACK_REASON = "SUBMARINE_ATTACK";
const ENTITY_KEY_PARTS = 5;
const BOAT_PART = 2;
const VICTIM_PART = 3;

export interface SubmarineTradeReportInput {
  readonly rules: TradeProtectionRules | undefined;
  readonly playerNationId: string;
  readonly shortfallBp: number;
  readonly nations: ReadonlyMap<
    string,
    {
      readonly fleets: readonly { readonly ships: readonly SubmarineTradeShip[] }[];
      readonly submarinePolicy?: SubmarinePolicy | undefined;
    }
  >;
  readonly wars: readonly Pick<
    WarDeclaration,
    "id" | "status" | "attackerSideMembers" | "defenderSideMembers"
  >[];
  readonly blockades: readonly Pick<BlockadeState, "blockaderId" | "blockadedNationId">[];
  readonly designs: ReadonlyMap<string, TradeDutyDesign>;
  readonly randomDecisions: readonly {
    readonly entityKey: string;
    readonly inputHash: string;
    readonly reasonCode: string;
  }[];
}

function isPlayerDraw(entityKey: string, playerNationId: string): boolean {
  const parts = entityKey.split("/");
  return parts.length === ENTITY_KEY_PARTS && parts[VICTIM_PART] === playerNationId;
}

export function submarineTradeExplanation(
  input: SubmarineTradeReportInput,
): ExplanationTree | undefined {
  if (input.rules === undefined) return undefined;
  const draws = input.randomDecisions.filter(
    (draw) =>
      draw.reasonCode === SUBMARINE_ATTACK_REASON &&
      isPlayerDraw(draw.entityKey, input.playerNationId),
  );
  const victim = input.nations.get(input.playerNationId);
  if (draws.length === 0 || victim === undefined) return undefined;
  const attackers = submarineTradeAttackers(input.wars, input.nations, input.playerNationId);
  const explained = explainSubmarineTrade({
    rules: input.rules,
    victimId: input.playerNationId,
    victimShortfallBp: input.shortfallBp,
    victimShips: victim.fleets.flatMap((fleet) => fleet.ships),
    attackers,
    blockades: input.blockades,
    designs: input.designs,
  });
  if (explained === undefined || explained.tree.result !== draws.length) return undefined;
  const reproduced = draws.every((draw) => {
    const chanceBp = ownerChanceBp(draw.entityKey, attackers, explained.chancesBp);
    return (
      chanceBp !== undefined &&
      draw.inputHash === sha256Hex(canonicalSerialize({ entityKey: draw.entityKey, chanceBp }))
    );
  });
  return reproduced ? explained.tree : undefined;
}

function ownerChanceBp(
  entityKey: string,
  attackers: readonly SubmarineTradeAttacker[],
  chancesBp: ReadonlyMap<string, number>,
): number | undefined {
  const boatId = entityKey.split("/")[BOAT_PART];
  const owner = attackers.find((attacker) => attacker.ships.some((ship) => ship.id === boatId));
  return owner === undefined ? undefined : chancesBp.get(owner.nationId);
}
