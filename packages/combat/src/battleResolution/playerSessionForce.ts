import {
  PROVISIONAL_FORCE_ORDER_RULESET,
  FORCE_ORDER_VERSION,
  advanceForce,
  createForceRuntime,
  type DivisionOrderSet,
  type ForceOrderRuleset,
  type ForceSituation,
  type RealismMode,
} from "../orders/index.js";
import { initialDamageState } from "../damage/minuteDamage.js";
import { playerSideOf } from "./playerSessionPause.js";
import type {
  PlayerBattleOrders,
  PlayerBattleSession,
  PlayerForceSession,
} from "./playerSessionTypes.js";
import { isShipNonViable } from "./viability.js";

const BP = 10_000;

export interface EnablePlayerForceOrdersInput {
  readonly realismMode: RealismMode;
  readonly ruleset?: ForceOrderRuleset;
}

export function enablePlayerForceOrders(
  session: PlayerBattleSession,
  input: EnablePlayerForceOrdersInput,
): PlayerBattleSession {
  const ruleset = input.ruleset ?? PROVISIONAL_FORCE_ORDER_RULESET;
  const force: PlayerForceSession = {
    forceId: playerSideOf(session),
    realismMode: input.realismMode,
    ruleset,
    runtime: createForceRuntime(ruleset),
    lastIssues: [],
  };
  return { ...session, force };
}

export function forceSituation(session: PlayerBattleSession, forceId: string): ForceSituation {
  const own = session.units.filter((unit) => unit.sideId === forceId);
  if (own.length === 0) return { casualtyBp: 0, ammunitionBp: null };
  const lost = own.filter((unit) =>
    isShipNonViable({
      assetId: unit.assetId,
      sideId: playerSideOf(session),
      damageState: session.damage.targets[unit.assetId]?.state ?? initialDamageState(unit.assetId),
    }),
  ).length;
  return { casualtyBp: Math.floor((lost * BP) / own.length), ammunitionBp: null };
}

export function advancePlayerForce(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
  divisionOrders: DivisionOrderSet,
): { readonly force: PlayerForceSession; readonly divisionOrders: DivisionOrderSet } {
  const force = session.force!;
  const result = advanceForce({
    forceId: force.forceId,
    orders: orders.forceOrders ?? { version: FORCE_ORDER_VERSION, orders: [] },
    runtime: force.runtime,
    minute: session.minute,
    realismMode: force.realismMode,
    control: "PLAYER",
    divisions: session.state.divisions,
    divisionOrders,
    situation: forceSituation(session, force.forceId),
    ruleset: force.ruleset,
  });
  return {
    force: { ...force, runtime: result.runtime, lastIssues: result.issues },
    divisionOrders: result.divisionOrders,
  };
}
