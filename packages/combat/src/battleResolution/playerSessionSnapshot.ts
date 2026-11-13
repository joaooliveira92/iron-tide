import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalDivision } from "../tactical/division.js";
import type { MovementState } from "../movement/neighbour.js";
import { explainGunneryAccuracy } from "../gunnery/accuracy-explanation.js";
import { battleLoss } from "../damage/minuteDamage.js";
import type { BattleSide } from "./viability.js";
import { withNightTraining, effectsOf } from "./trainingEffects.js";
import {
  explainBattleLoss,
  explainDamageControl,
  explainShipMotion,
  explainTorpedoSolution,
} from "./battle-explanations.js";
import type {
  PlayerBattleDivisionView,
  PlayerBattleResult,
  PlayerBattleSession,
  PlayerBattleShipView,
  PlayerBattleView,
} from "./playerSessionTypes.js";

function divisionOf(state: TacticalBattleState): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const division of state.divisions) {
    for (const unitId of division.orderedTacticalUnitIds) {
      map.set(unitId, division.tacticalDivisionId);
    }
  }
  return map;
}

export function resultOf(session: PlayerBattleSession): PlayerBattleResult {
  const sunk = (side: BattleSide): string[] =>
    session.units
      .filter((unit) => unit.sideId === side)
      .filter(
        (unit) =>
          (session.damage.targets[unit.assetId]?.state.terminalStatus ?? "NORMAL") !== "NORMAL",
      )
      .map((unit) => unit.assetId)
      .sort();
  const damageReport: Record<string, number> = {};
  for (const unit of session.units) {
    const state = session.damage.targets[unit.assetId]?.state;
    if (!state) continue;
    damageReport[unit.assetId] = battleLoss(
      unit.hitPoints as number,
      state,
      unit.maxHitPoints as number,
    );
  }
  return {
    winnerId: session.winnerId,
    loserId: session.loserId,
    attackerLosses: sunk("ATTACKER"),
    defenderLosses: sunk("DEFENDER"),
    damageReport,
  };
}

export function playerBattleResult(session: PlayerBattleSession): PlayerBattleResult {
  if (session.result !== null) return session.result;
  return resultOf(session);
}

export function playerBattleSessionHash(session: PlayerBattleSession): string {
  return sha256Hex(
    canonicalSerialize({
      battleId: session.battleId,
      minute: session.minute,
      ended: session.ended,
      endReason: session.endReason,
      winnerId: session.winnerId,
      loserId: session.loserId,
      state: session.state,
      batteries: session.batteries,
      damageTargets: session.damage.targets,
      weather: session.weather.components,
      torpedoes: session.torpedoes ?? null,
      missiles: session.missiles ?? null,
      smoke: session.smoke,
      airCombat: session.airCombat,
      airDefense: session.airDefense,
      log: session.log,
    }),
  );
}

export function playerBattleView(session: PlayerBattleSession): PlayerBattleView {
  const divisionOfUnit = divisionOf(session.state);
  const divisions: PlayerBattleDivisionView[] = session.state.divisions.map(
    (division: TacticalDivision) => ({
      divisionId: division.tacticalDivisionId,
      sideId: division.sideId,
      role: division.role,
      formation: division.formation,
      flagshipId: division.tacticalFlagshipId,
      unitIds: [...division.orderedTacticalUnitIds],
    }),
  );
  const playerSide = session.attackerId === session.playerNationId ? "ATTACKER" : "DEFENDER";
  const playerTorpedoShips = new Set(
    (session.torpedoes?.launchers ?? [])
      .filter((launcher) => launcher.sideId === playerSide)
      .map((launcher) => launcher.ownerShipId),
  );
  const torpedoTacticsBp = effectsOf(session.trainingEffects, playerSide).torpedoTacticsBp;
  const batteryOf = new Map(
    withNightTraining(
      session.batteries,
      session.trainingEffects,
      session.weather.components.timeOfDay,
    )
      .filter((battery) => battery.sideId === playerSide)
      .map((battery) => [battery.ownerShipId, battery] as const),
  );
  const freshContacts = new Map(
    (session.state.contacts ?? [])
      .filter((contact) => contact.sideId !== playerSide && !contact.stale)
      .map((contact) => [contact.assetId, contact] as const),
  );
  const ships: PlayerBattleShipView[] = session.units.map((unit) => {
    const battery = batteryOf.get(unit.assetId);
    const damageState = session.damage.targets[unit.assetId]?.state;
    const movement: MovementState | undefined = session.state.movementStates?.[unit.assetId];
    const own = unit.sideId === playerSide;
    const contact = own ? undefined : freshContacts.get(unit.assetId);
    const observed = own
      ? movement && {
          position: movement.position,
          heading: movement.heading,
          speed: movement.currentSpeed,
        }
      : contact && { position: contact.position, heading: contact.course, speed: contact.speed };
    const loss =
      own && damageState !== undefined
        ? explainBattleLoss(unit.hitPoints as number, damageState, unit.maxHitPoints as number)
        : undefined;
    const lossValue = loss === undefined ? 0 : Number(loss.result);
    return {
      shipId: unit.assetId,
      name: unit.name,
      className: unit.className,
      shipType: unit.shipType,
      sideId: unit.sideId,
      divisionId: divisionOfUnit.get(unit.assetId) ?? null,
      hitPoints: unit.hitPoints as number,
      maxHitPoints: unit.maxHitPoints as number,
      damageState: damageState?.terminalStatus ?? "NORMAL",
      position: observed ? [observed.position[0], observed.position[1]] : null,
      headingDeg: observed ? observed.heading : null,
      speedBp: observed ? observed.speed : null,
      contactConfidenceBp: contact ? contact.confidence : null,
      ...(own && movement ? { motion: explainShipMotion(movement) } : {}),
      ...(battery === undefined
        ? {}
        : { gunneryAccuracy: explainGunneryAccuracy(battery.accuracyFactors) }),
      ...(own && playerTorpedoShips.has(unit.assetId)
        ? { torpedoSolution: explainTorpedoSolution(torpedoTacticsBp) }
        : {}),
      ...(own && lossValue > 0 ? { damageControl: explainDamageControl() } : {}),
      ...(loss === undefined || lossValue === 0 ? {} : { loss }),
    };
  });
  return {
    battleId: session.battleId,
    campaignMonth: session.campaignMonth,
    playerNationId: session.playerNationId,
    areaId: session.areaId,
    attackerId: session.attackerId,
    defenderId: session.defenderId,
    minute: session.minute,
    maxMinutes: session.maxMinutes,
    ended: session.ended,
    endReason: session.endReason,
    winnerId: session.winnerId,
    loserId: session.loserId,
    objectives: session.objectives,
    weather: {
      seaState: session.state.weather.seaState,
      visibilityNm: session.state.weather.visibilityNm,
      precipitation: session.state.weather.weather,
      daylight: session.state.weather.daylight,
    },
    ships,
    divisions,
    log: session.log,
  };
}
