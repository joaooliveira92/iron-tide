import type { PlayerBattleOrders } from "@bluewave/combat/battleResolution";
import type { PlayerBattleDivisionOrderDto } from "./player-battle-contract.js";

export const PLAYER_BATTLE_STANCES = ["ENGAGE", "HOLD", "WITHDRAW"] as const;
export const MIN_SPEED_PERCENT = 0;
export const MAX_SPEED_PERCENT = 100;
export const SPEED_PERCENT_STEP = 5;

export interface OrdersView {
  readonly playerNationId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly divisions: readonly { readonly divisionId: string; readonly sideId: string }[];
}

export interface DivisionOrder {
  readonly stance: PlayerBattleDivisionOrderDto["stance"];
  readonly speedPercent: number;
}

export type DivisionOrders = Readonly<Record<string, DivisionOrder>>;

export const DEFAULT_DIVISION_ORDER: DivisionOrder = {
  stance: "ENGAGE",
  speedPercent: MAX_SPEED_PERCENT,
};

export function playerSideOf(view: OrdersView): "ATTACKER" | "DEFENDER" | null {
  if (view.playerNationId === view.attackerId) return "ATTACKER";
  if (view.playerNationId === view.defenderId) return "DEFENDER";
  return null;
}

export function defaultOrdersFor(view: OrdersView): DivisionOrders {
  const side = playerSideOf(view);
  const out: Record<string, DivisionOrder> = {};
  for (const division of view.divisions) {
    if (division.sideId === side) out[division.divisionId] = DEFAULT_DIVISION_ORDER;
  }
  return out;
}

export function standingOrdersFor(
  view: OrdersView,
  lastOrders: readonly PlayerBattleDivisionOrderDto[],
): DivisionOrders {
  const out: Record<string, DivisionOrder> = { ...defaultOrdersFor(view) };
  for (const order of lastOrders) {
    out[order.divisionId] = { stance: order.stance, speedPercent: order.speedPercent };
  }
  return out;
}

export function ordersToDtos(orders: DivisionOrders): readonly PlayerBattleDivisionOrderDto[] {
  return Object.entries(orders).map(([divisionId, order]) => ({ divisionId, ...order }));
}

export function toCombatOrders(
  divisions: readonly PlayerBattleDivisionOrderDto[],
): PlayerBattleOrders {
  const out: Record<string, DivisionOrder> = {};
  for (const order of divisions) {
    out[order.divisionId] = { stance: order.stance, speedPercent: order.speedPercent };
  }
  return { divisions: out };
}
