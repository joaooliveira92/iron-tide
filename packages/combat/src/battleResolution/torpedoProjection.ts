import type { CompiledDesignVersion } from "@bluewave/campaign";
import type { CompiledTorpedo } from "@bluewave/armament";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { DamageTargetContext } from "./damage.js";
import {
  computeBaseBreachRateKgMin,
  EMPTY_TUBE,
  NO_FIRE_SOLUTION,
  NO_RELOAD_IN_PROGRESS,
  TORPEDO_FORMULA_VERSION,
  TORPEDO_MOUNT_TYPES,
  TORPEDO_RULESET_VERSION,
  withTorpedoLauncherStateHash,
  type TorpedoContext,
  type TorpedoLauncherWiring,
  type TorpedoMountType,
  type TorpedoTargetContext,
} from "../torpedoes/index.js";
import { BluewaveError } from "@bluewave/contracts";
import { AUTO_TORPEDO_CREW_QUALITY_BP } from "./constants.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";

export { AUTO_TORPEDO_CREW_QUALITY_BP };
export const AUTO_TORPEDO_DEPTH_M = 3;
const AUTO_TORPEDO_BREACH_AREA_M2 = 20;
const TRAINING_LIMITS_MDEG: Readonly<Record<TorpedoMountType, { min: number; max: number }>> = {
  UNDERWATER_FIXED: { min: -10_000, max: 10_000 },
  UNDERWATER_TRAINABLE: { min: -90_000, max: 90_000 },
  ABOVE_WATER_FIXED: { min: -100_000, max: 100_000 },
  ABOVE_WATER_TRAINABLE: { min: -150_000, max: 150_000 },
  SUBMARINE_INTERNAL: { min: -10_000, max: 10_000 },
};

function cbrtTonnes(displacementKg: number): number {
  return Math.cbrt(Math.max(1, displacementKg) / 1_000);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function autoCollisionRadiusM(displacementKg: number): number {
  return clamp(Math.round(cbrtTonnes(displacementKg) * 2.5), 5, 150);
}

export function autoDraftM(displacementKg: number): number {
  return clamp(Math.round(cbrtTonnes(displacementKg) * 0.35), 1, 12);
}

export function launcherId(assetId: string, mountIndex: number): string {
  return `${assetId}:TT${mountIndex + 1}`;
}

export function projectTorpedoes(input: {
  battleId: string;
  units: readonly TacticalShipUnit[];
  designs: Readonly<Record<string, CompiledDesignVersion>>;
  damageTargets: Readonly<Record<string, DamageTargetContext>>;
}): TorpedoContext | undefined {
  const launchers: TorpedoLauncherWiring[] = [];
  const registry: Record<string, CompiledTorpedo> = {};
  for (const u of input.units) {
    const mounts = input.designs[u.assetId]?.torpedoArmament ?? [];
    mounts.forEach((mount, i) => {
      if (!(TORPEDO_MOUNT_TYPES as readonly string[]).includes(mount.mountType)) {
        throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
          code: BATTLE_AUTO_RESOLUTION_FAILED,
          shipId: u.assetId,
          mountType: mount.mountType,
          reason: "design torpedo mount type is not a canonical DESIGN-40 §2 mount",
        });
      }
      const mountType = mount.mountType as TorpedoMountType;
      const compiled = mount.compiledTorpedo;
      if (compiled === undefined) {
        throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
          code: BATTLE_AUTO_RESOLUTION_FAILED,
          shipId: u.assetId,
          torpedoModelId: mount.torpedoModelId,
          reason: "design torpedo mount carries no compiled torpedo record",
        });
      }
      const familyId = `${Math.round(compiled.diameterUm / 25_400)}in_${mountType.toLowerCase()}`;
      if (!(compiled.launchTypes as readonly string[]).includes(mountType)) {
        throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
          code: BATTLE_AUTO_RESOLUTION_FAILED,
          shipId: u.assetId,
          torpedoModelId: compiled.partId,
          launcherFamilyId: familyId,
          reason: "design torpedo model is not compatible with the mount's launcher family",
        });
      }
      registry[compiled.partId] = compiled;
      const tubeCount = Number(mount.tubeCount);
      const id = launcherId(u.assetId, i);
      launchers.push({
        launcher: withTorpedoLauncherStateHash({
          launcherId: id,
          ownerPlatformId: u.assetId,
          launcherFamilyId: familyId,
          mountPosition: `mount_${i + 1}`,
          mountType,
          tubeCount,
          loadedPerTube: Array.from({ length: tubeCount }, () => compiled.partId),
          reserveAmmunition: { [compiled.partId]: 0 },
          reloadState: NO_RELOAD_IN_PROGRESS,
          trainingLimitsMdeg: { ...TRAINING_LIMITS_MDEG[mountType] },
          underwaterLaunchCapability: mountType.startsWith("UNDERWATER"),
          fireControlConnectionState: "CONNECTED",
          damageState: "OPERATIONAL",
          floodingIsolationState: "INTACT",
          activeFireSolution: NO_FIRE_SOLUTION,
          rulesetVersion: TORPEDO_RULESET_VERSION,
          formulaVersion: TORPEDO_FORMULA_VERSION,
        }),
        ownerShipId: u.assetId,
        sideId: u.sideId,
        crewQualityBp: AUTO_TORPEDO_CREW_QUALITY_BP,
        commandSource: "CENTRAL",
        aboveWaterMaxLaunchSpeedKnots: null,
      });
    });
  }
  if (launchers.length === 0) return undefined;

  const targets: Record<string, TorpedoTargetContext> = {};
  for (const u of input.units) {
    const displacementKg = Number(u.displacementKg);
    const damage = input.damageTargets[u.assetId];
    const contactId = `${input.battleId}:${u.assetId}`;
    targets[u.assetId] = {
      shipId: u.assetId,
      contactId,
      profile: {
        targetId: u.assetId,
        contactId,
        collisionRadiusM: autoCollisionRadiusM(displacementKg),
        draftM: autoDraftM(displacementKg),
        terminalStatus: "NORMAL",
      },
      zone: "MACHINERY",
      protectionLevel: "WEAK",
      scene: {
        impactSide: "STARBOARD",
        longitudinalPositionM: autoCollisionRadiusM(displacementKg),
        hullBreachAreaM2: AUTO_TORPEDO_BREACH_AREA_M2,
        fireProbabilityBp: 1_000,
        crewCasualties: 20,
        damageControlAccessibility: "ACCESSIBLE",
        isolationState: "INTACT",
      },
      damageState: damage!.state,
      designFlotationReserve: damage!.designFlotationReserve,
      designStabilityScore: damage!.designStabilityScore,
      flooding: [
        {
          compartmentId: "COMP-BELT-1",
          baseBreachRateKgMin: computeBaseBreachRateKgMin(AUTO_TORPEDO_BREACH_AREA_M2),
          isolationState: "INTACT",
        },
      ],
      machinery: { zone: "MACHINERY", machineryComponents: ["ENGINE-1"] },
    };
  }
  return { launchers, commands: [], targets, tracks: [], torpedoes: registry };
}

export function firstLoadedTube(wiring: TorpedoLauncherWiring): number | null {
  const idx = wiring.launcher.loadedPerTube.findIndex((t) => t !== EMPTY_TUBE);
  return idx === -1 ? null : idx;
}
