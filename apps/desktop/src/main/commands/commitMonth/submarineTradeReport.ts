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
  type SubmarineTradeShip,
} from "@bluewave/campaign-engine";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { ExplanationTree } from "@bluewave/events";

const SUBMARINE_ATTACK_REASON = "SUBMARINE_ATTACK";
const ENTITY_KEY_PARTS = 5;
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
  const explained = explainSubmarineTrade({
    rules: input.rules,
    victimId: input.playerNationId,
    victimShortfallBp: input.shortfallBp,
    victimShips: victim.fleets.flatMap((fleet) => fleet.ships),
    attackers: submarineTradeAttackers(input.wars, input.nations, input.playerNationId),
    blockades: input.blockades,
    designs: input.designs,
  });
  if (explained === undefined || explained.tree.result !== draws.length) return undefined;
  const chances = [...explained.chancesBp.values()];
  const reproduced = draws.every((draw) =>
    chances.some(
      (chanceBp) =>
        draw.inputHash === sha256Hex(canonicalSerialize({ entityKey: draw.entityKey, chanceBp })),
    ),
  );
  return reproduced ? explained.tree : undefined;
}
