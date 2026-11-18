import {
  battleView,
  type BattleView,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { decodeBattleView } from "../../shared/battle-view-schemas.js";
import { toCombatOrders } from "../../shared/player-battle-orders.js";
import type { PlayerBattleStep } from "../playerBattleSidecar.js";

export const BATTLE_VIEW_INVALID = "BATTLE_VIEW_INVALID" as const;

export type BattleViewOutcome =
  | { readonly kind: "view"; readonly view: BattleView }
  | { readonly kind: "invalid"; readonly diagnostics: readonly string[] };

export function boundaryBattleView(
  session: PlayerBattleSession,
  lastStep: PlayerBattleStep | undefined,
): BattleViewOutcome {
  const built = battleView(session, {
    pauseReason: session.ended ? "BATTLE_END" : null,
    orders: lastStep === undefined ? null : toCombatOrders(lastStep.divisions),
  });
  const decoded = decodeBattleView(built);
  return decoded.kind === "decoded"
    ? { kind: "view", view: decoded.view }
    : { kind: "invalid", diagnostics: decoded.issues };
}
