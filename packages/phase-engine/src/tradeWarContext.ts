import {
  submarinePolicyOf,
  tradeDutyDesigns,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type WarDeclaration,
} from "@bluewave/campaign";
import type { PhaseContext } from "./pipeline.js";
import type { TradeAttacker } from "./tradeSubmarines.js";

export const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function activeWars(ctx: PhaseContext): readonly WarDeclaration[] {
  return ctx.snapshot
    .read("wars")
    .wars.filter((war) => war.status === "ACTIVE")
    .sort((a, b) => byId(a.id, b.id));
}

function sideOf(war: WarDeclaration, nationId: string): "attacker" | "defender" | undefined {
  if (war.attackerSideMembers.includes(nationId)) return "attacker";
  if (war.defenderSideMembers.includes(nationId)) return "defender";
  return undefined;
}

export function opponentsOf(war: WarDeclaration, nationId: string): readonly string[] {
  const side = sideOf(war, nationId);
  if (side === undefined) return [];
  return [...(side === "attacker" ? war.defenderSideMembers : war.attackerSideMembers)].sort(byId);
}

export function shipsOf(nation: NationState): readonly Ship[] {
  return nation.fleets.flatMap((fleet) => fleet.ships).sort((a, b) => byId(a.id, b.id));
}

export function tradeAttackersOf(
  nations: ReadonlyMap<string, NationState>,
  wars: readonly WarDeclaration[],
  victimId: string,
): readonly TradeAttacker[] {
  const attackers: TradeAttacker[] = [];
  const seen = new Set<string>();
  for (const war of wars) {
    for (const opponentId of opponentsOf(war, victimId)) {
      if (seen.has(opponentId)) continue;
      seen.add(opponentId);
      const opponent = nations.get(opponentId);
      if (opponent === undefined) continue;
      attackers.push({
        warId: war.id,
        nationId: opponentId,
        ships: shipsOf(opponent),
        policy: submarinePolicyOf(opponent),
      });
    }
  }
  return attackers;
}

export function designMap(ctx: PhaseContext): ReadonlyMap<string, TradeDutyDesign> {
  return tradeDutyDesigns(ctx.snapshot.read("designs"));
}
