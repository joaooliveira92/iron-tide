import type { DesignCapability } from "@bluewave/campaign";
import { createEnvelope } from "@bluewave/deterministic";

import {
  MISSILE_RULESET_VERSION,
  missilePolicyId,
  SSM_MISSILE_CLASSES,
  type MissileRules,
  type SsmMissileClass,
} from "./constants.js";

export interface MissileLauncherOwner {
  readonly shipId: string;
  readonly sideId: string;
  readonly capabilities?: readonly DesignCapability[];
}

export interface MissileLauncherState {
  readonly launcherId: string;
  readonly ownerShipId: string;
  readonly sideId: string;
  readonly missileClass: SsmMissileClass;
  readonly salvosFired: number;
  readonly maxSalvos: number;
  readonly stateHash: string;
}

export type MissileLauncherStateBody = Omit<MissileLauncherState, "stateHash">;

export interface MissileSalvoInFlight {
  readonly salvoId: string;
  readonly launcherId: string;
  readonly ownerShipId: string;
  readonly sideId: string;
  readonly missileClass: SsmMissileClass;
  readonly targetShipId: string;
  readonly launchMinute: number;
  readonly impactMinute: number;
  readonly missiles: number;
  readonly salvoHash: string;
}

export type MissileSalvoInFlightBody = Omit<MissileSalvoInFlight, "salvoHash">;

export interface MissileContext {
  readonly launchers: readonly MissileLauncherState[];
  readonly inFlight: readonly MissileSalvoInFlight[];
  readonly rules: MissileRules;
}

export function computeMissileLauncherStateHash(body: MissileLauncherStateBody): string {
  return createEnvelope("missile-launcher-state", missilePolicyId, body).bodyHash;
}

export function computeMissileSalvoHash(body: MissileSalvoInFlightBody): string {
  return createEnvelope("missile-salvo", missilePolicyId, body).bodyHash;
}

export function withMissileLauncherStateHash(body: MissileLauncherStateBody): MissileLauncherState {
  return { ...body, stateHash: computeMissileLauncherStateHash(body) };
}

export function withMissileSalvoHash(body: MissileSalvoInFlightBody): MissileSalvoInFlight {
  return { ...body, salvoHash: computeMissileSalvoHash(body) };
}

export function countLauncherCapabilities(
  capabilities: readonly DesignCapability[] | undefined,
): Readonly<Record<SsmMissileClass, number>> {
  const counts: Record<SsmMissileClass, number> = {
    light_ssm: 0,
    medium_ssm: 0,
    heavy_ssm: 0,
  };
  for (const capability of capabilities ?? []) {
    if (capability.kind !== "missile_launch") continue;
    if (capability.missileClass === "sam" || capability.missileClass === "asm") continue;
    if ((SSM_MISSILE_CLASSES as readonly string[]).includes(capability.missileClass)) {
      counts[capability.missileClass as SsmMissileClass] += 1;
    }
  }
  return counts;
}

export function projectMissileLaunchers(
  owners: readonly MissileLauncherOwner[],
  rules: MissileRules,
): MissileLauncherState[] {
  const launchers: MissileLauncherState[] = [];
  const sorted = [...owners].sort((a, b) =>
    a.shipId < b.shipId ? -1 : a.shipId > b.shipId ? 1 : 0,
  );
  for (const owner of sorted) {
    const counts = countLauncherCapabilities(owner.capabilities);
    for (const missileClass of SSM_MISSILE_CLASSES) {
      const count = counts[missileClass];
      if (count === 0) continue;
      const launcherId = `${owner.shipId}:SSM:${missileClass}`;
      launchers.push(
        withMissileLauncherStateHash({
          launcherId,
          ownerShipId: owner.shipId,
          sideId: owner.sideId,
          missileClass,
          salvosFired: 0,
          maxSalvos: count * rules.classes[missileClass].maxSalvosPerBattle,
        }),
      );
    }
  }
  return launchers;
}

export function projectMissileContext(
  owners: readonly MissileLauncherOwner[],
  rules: MissileRules,
): MissileContext | undefined {
  const launchers = projectMissileLaunchers(owners, rules);
  if (launchers.length === 0) return undefined;
  return { launchers, inFlight: [], rules };
}

export const MISSILE_MODEL_RULESET_VERSION = MISSILE_RULESET_VERSION;
