import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

import {
  FIREFIGHTING_PER_TEAM_BP,
  PUMPING_PER_TEAM_KG_MIN,
  createDefaultDamageControlResource,
  damageControlPolicyId,
} from "../damage/index.js";
import { battleLoss, hpOfState } from "../damage/minuteDamage.js";
import type { ShipDamageState } from "../damage/state.js";
import {
  TORPEDO_FORMULA_VERSION,
  computeTorpedoSolutionQuality,
  neutralTorpedoSolutionFactors,
} from "../torpedoes/index.js";
import { AUTO_SOLUTION_BASE_BP } from "./torpedoDoctrine.js";
import { scaleByTrainingBp } from "./trainingEffects.js";

const NEUTRAL_BP = 10_000;

const torpedoSource = { kind: "ruleset", ref: TORPEDO_FORMULA_VERSION } as const;
const damageControlSource = { kind: "ruleset", ref: damageControlPolicyId } as const;

export function explainTorpedoSolution(torpedoTacticsBp: number): ExplanationTree {
  const scaledBaseBp = scaleByTrainingBp(AUTO_SOLUTION_BASE_BP, torpedoTacticsBp);
  const resolution = computeTorpedoSolutionQuality(neutralTorpedoSolutionFactors(scaledBaseBp));
  const builder = new ExplanationBuilder("torpedo_solution", TORPEDO_FORMULA_VERSION)
    .withInput("baseSolutionBp", AUTO_SOLUTION_BASE_BP)
    .withInput("torpedoTacticsBp", torpedoTacticsBp)
    .withIntermediate("trainingScaledBp", scaledBaseBp)
    .withIntermediate("rawFlooredBp", resolution.rounding.rawFlooredBp)
    .withResult(resolution.solutionQualityBp)
    .withUnit("bp")
    .withOperation("multiply")
    .withSource(torpedoSource);
  if (torpedoTacticsBp !== 0) {
    const multiplierBp = NEUTRAL_BP + torpedoTacticsBp;
    builder.addChild(
      new ExplanationBuilder("torpedo_solution.training", TORPEDO_FORMULA_VERSION)
        .withInput("multiplierBp", multiplierBp)
        .withResult(multiplierBp)
        .withUnit("bp")
        .withOperation("multiply")
        .withSource(torpedoSource)
        .build(),
    );
  }
  return builder.build();
}

const motionSource = { kind: "code", ref: "combat/movement/kinematics#resolvePropulsion" } as const;

export function explainShipMotion(movement: {
  readonly heading: number;
  readonly orderedSpeed: number;
  readonly currentSpeed: number;
}): ExplanationTree {
  return new ExplanationBuilder("ship_motion", "ship_motion_v1")
    .withInput("orderedSpeedMilliKnots", movement.orderedSpeed)
    .withInput("headingDeg", movement.heading)
    .withResult(movement.currentSpeed)
    .withUnit("mkn")
    .withOperation("identity")
    .withSource(motionSource)
    .addChild(
      new ExplanationBuilder("ship_motion.orderedSpeed", "ship_motion_v1")
        .withResult(movement.orderedSpeed)
        .withUnit("mkn")
        .withOperation("identity")
        .withSource(motionSource)
        .build(),
    )
    .build();
}

export function explainDamageControl(): ExplanationTree {
  const resources = createDefaultDamageControlResource();
  const builder = new ExplanationBuilder("damage_control", damageControlPolicyId)
    .withInput("teamCount", resources.teamCount)
    .withInput("pumpingPerTeamKgMin", PUMPING_PER_TEAM_KG_MIN)
    .withInput("firefightingPerTeamBp", FIREFIGHTING_PER_TEAM_BP)
    .withIntermediate("pumpingCapacityKgMin", resources.pumpingCapacity)
    .withIntermediate("firefightingCapacityBp", resources.firefightingCapacity)
    .withResult(resources.pumpingCapacity)
    .withUnit("kg/min")
    .withOperation("multiply")
    .withSource(damageControlSource);
  builder.addChild(
    new ExplanationBuilder("damage_control.pumping", damageControlPolicyId)
      .withInput("teamCount", resources.teamCount)
      .withInput("pumpingPerTeamKgMin", PUMPING_PER_TEAM_KG_MIN)
      .withResult(resources.pumpingCapacity)
      .withUnit("kg/min")
      .withOperation("multiply")
      .withSource(damageControlSource)
      .build(),
  );
  builder.addChild(
    new ExplanationBuilder("damage_control.firefighting", damageControlPolicyId)
      .withInput("teamCount", resources.teamCount)
      .withInput("firefightingPerTeamBp", FIREFIGHTING_PER_TEAM_BP)
      .withResult(resources.firefightingCapacity)
      .withUnit("bp")
      .withOperation("multiply")
      .withSource(damageControlSource)
      .build(),
  );
  return builder.build();
}

export function explainBattleLoss(
  battleStartHitPoints: number,
  state: ShipDamageState,
  maxHitPoints: number,
): ExplanationTree {
  const currentHitPoints = Number(hpOfState(state, maxHitPoints));
  const loss = Number(battleLoss(battleStartHitPoints, state, maxHitPoints));
  const builder = new ExplanationBuilder("battle_loss", "battle_loss_v1")
    .withInput("battleStartHitPoints", battleStartHitPoints)
    .withInput("currentHitPoints", currentHitPoints)
    .withResult(loss)
    .withUnit("hp")
    .withOperation("subtract")
    .withSource({ kind: "code", ref: "combat/damage/minuteDamage#battleLoss" });
  builder.addChild(
    new ExplanationBuilder("battle_loss.battleStartHitPoints", "battle_loss_v1")
      .withResult(battleStartHitPoints)
      .withUnit("hp")
      .withOperation("identity")
      .withSource({ kind: "code", ref: "combat/battleResolution/playerSession#hitPoints" })
      .build(),
  );
  builder.addChild(
    new ExplanationBuilder("battle_loss.currentHitPoints", "battle_loss_v1")
      .withResult(currentHitPoints)
      .withUnit("hp")
      .withOperation("identity")
      .withSource({ kind: "code", ref: "combat/damage/minuteDamage#hpOfState" })
      .build(),
  );
  return builder.build();
}
