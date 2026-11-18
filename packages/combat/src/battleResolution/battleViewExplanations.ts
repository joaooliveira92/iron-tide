import type { GunneryAccuracyFactors } from "../gunnery/accuracy.js";
import { explainGunneryAccuracy } from "../gunnery/accuracy-explanation.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import {
  explainBattleLoss,
  explainDamageControl,
  explainTorpedoSolution,
} from "./battle-explanations.js";
import type { BattleViewShipExplanations } from "./battleViewTypes.js";
import { playerSideOf } from "./playerSessionPause.js";
import type { PlayerBattleSession } from "./playerSessionTypes.js";
import { effectsOf, withNightTraining } from "./trainingEffects.js";

export interface OwnShipExplanationSources {
  readonly accuracyFactorsOf: ReadonlyMap<string, GunneryAccuracyFactors>;
  readonly torpedoShips: ReadonlySet<string>;
  readonly torpedoTacticsBp: number;
}

export function ownShipExplanationSources(session: PlayerBattleSession): OwnShipExplanationSources {
  const side = playerSideOf(session);
  const accuracyFactorsOf = new Map(
    withNightTraining(
      session.batteries,
      session.trainingEffects,
      session.weather.components.timeOfDay,
    )
      .filter((battery) => battery.sideId === side)
      .map((battery) => [battery.ownerShipId, battery.accuracyFactors] as const),
  );
  const torpedoShips = new Set(
    (session.torpedoes?.launchers ?? [])
      .filter((launcher) => launcher.sideId === side)
      .map((launcher) => launcher.ownerShipId),
  );
  return {
    accuracyFactorsOf,
    torpedoShips,
    torpedoTacticsBp: effectsOf(session.trainingEffects, side).torpedoTacticsBp,
  };
}

export function ownShipExplanations(
  session: PlayerBattleSession,
  unit: TacticalShipUnit,
  sources: OwnShipExplanationSources,
): BattleViewShipExplanations {
  const damageState = session.damage.targets[unit.assetId]?.state;
  const loss =
    damageState === undefined
      ? null
      : explainBattleLoss(unit.hitPoints as number, damageState, unit.maxHitPoints as number);
  const lossValue = loss === null ? 0 : Number(loss.result);
  const accuracy = sources.accuracyFactorsOf.get(unit.assetId);
  return {
    gunneryAccuracy: accuracy === undefined ? null : explainGunneryAccuracy(accuracy),
    torpedoSolution: sources.torpedoShips.has(unit.assetId)
      ? explainTorpedoSolution(sources.torpedoTacticsBp)
      : null,
    damageControl: lossValue > 0 ? explainDamageControl() : null,
    loss: loss === null || lossValue === 0 ? null : loss,
  };
}
