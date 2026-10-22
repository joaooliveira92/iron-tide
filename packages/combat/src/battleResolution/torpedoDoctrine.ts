import { directionBp, speedBpKnotsToUmS } from "../movement/kinematics.js";
import { DIRECTION_FIXED } from "../movement/constants.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import {
  EMPTY_TUBE,
  compiledTorpedoOf,
  type TorpedoContext,
  type TorpedoLaunchCommand,
} from "../torpedoes/index.js";
import type { DamageContext } from "./damage.js";
import { AUTO_TORPEDO_DEPTH_M } from "./torpedoProjection.js";

const UM_PER_M = 1_000_000;
const PREDICTION_SECONDS = 60;

export function planTorpedoCommands(input: {
  battleId: string;
  torpedoes: TorpedoContext;
  battleState: TacticalBattleState;
  damage: DamageContext;
  units: readonly TacticalShipUnit[];
}): TorpedoLaunchCommand[] {
  const { battleId, torpedoes, battleState, damage, units } = input;
  const movement = battleState.movementStates ?? {};
  const contactPos = new Map(
    (battleState.contacts ?? []).map((c) => {
      const { cosBp, sinBp } = directionBp(c.course);
      const travelUm = speedBpKnotsToUmS(c.speed) * PREDICTION_SECONDS;
      const predicted: [number, number] = [
        c.position[0] + Math.round((travelUm * cosBp) / DIRECTION_FIXED),
        c.position[1] + Math.round((travelUm * sinBp) / DIRECTION_FIXED),
      ];
      return [c.contactId, predicted] as const;
    }),
  );
  const viable = (id: string): boolean =>
    (damage.targets[id]?.state.terminalStatus ?? "NORMAL") === "NORMAL";
  const enemiesBySide = new Map<string, TacticalShipUnit[]>();
  for (const u of units) {
    for (const other of units) {
      if (other.sideId === u.sideId) continue;
      const list = enemiesBySide.get(u.sideId) ?? [];
      if (!list.includes(other)) list.push(other);
      enemiesBySide.set(u.sideId, list);
    }
  }

  const commands: TorpedoLaunchCommand[] = [];
  const launchers = [...torpedoes.launchers].sort((a, b) =>
    a.launcher.launcherId < b.launcher.launcherId ? -1 : 1,
  );
  for (const wiring of launchers) {
    if (!viable(wiring.ownerShipId)) continue;
    const tubeIndex = wiring.launcher.loadedPerTube.findIndex((t) => t !== EMPTY_TUBE);
    if (tubeIndex === -1) continue;
    const own = movement[wiring.ownerShipId];
    if (!own) continue;
    const model = compiledTorpedoOf(torpedoes.torpedoes, wiring.launcher.loadedPerTube[tubeIndex]!);
    const setting = model.speedSettings[0]!;
    const { cosBp, sinBp } = directionBp(own.heading);
    const leadUm = speedBpKnotsToUmS(own.currentSpeed) * PREDICTION_SECONDS;
    const launchX = own.position[0] + Math.round((leadUm * cosBp) / DIRECTION_FIXED);
    const launchY = own.position[1] + Math.round((leadUm * sinBp) / DIRECTION_FIXED);

    let best: { contactId: string; alongM: number; assetId: string } | null = null;
    const enemies = [...(enemiesBySide.get(wiring.sideId) ?? [])].sort((a, b) =>
      a.assetId < b.assetId ? -1 : 1,
    );
    for (const enemy of enemies) {
      if (!viable(enemy.assetId)) continue;
      const contactId = `${battleId}:${enemy.assetId}`;
      const pos = contactPos.get(contactId);
      if (!pos) continue;
      const dx = pos[0] - launchX;
      const dy = pos[1] - launchY;
      const alongM = Math.floor((dx * cosBp + dy * sinBp) / DIRECTION_FIXED / UM_PER_M);
      const crossM = Math.abs(Math.floor((dx * sinBp - dy * cosBp) / DIRECTION_FIXED / UM_PER_M));
      const radiusM = torpedoes.targets[enemy.assetId]?.profile.collisionRadiusM ?? 0;
      if (alongM < model.minimumArmingDistanceM || alongM > setting.rangeM) continue;
      if (crossM > radiusM) continue;
      if (!best || alongM < best.alongM) best = { contactId, alongM, assetId: enemy.assetId };
    }
    if (!best) continue;

    const loaded = wiring.launcher.loadedPerTube.filter((t) => t !== EMPTY_TUBE).length;
    commands.push({
      shipId: wiring.ownerShipId,
      launcherId: wiring.launcher.launcherId,
      tubeIndexes: [tubeIndex],
      targetContactId: best.contactId,
      selectedSettingId: setting.settingId,
      depthSettingM: AUTO_TORPEDO_DEPTH_M,
      salvoPolicy: {
        missionObjective: "ATTACK",
        withdrawalState: "NORMAL",
        targetCombatValueBp: 5_000,
        targetSizeBp: 5_000,
        targetEstimatedRangeM: best.alongM,
        solutionQualityBp: 8_000,
        remainingTotalAmmunition: loaded,
        friendlyLauncherCount: 1,
        overkillEstimateBp: 0,
      },
    });
  }
  return commands;
}
