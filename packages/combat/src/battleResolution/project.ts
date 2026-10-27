import { sha256Hex } from "@bluewave/deterministic";
import { canonicalSerialize } from "@bluewave/deterministic";
import { BluewaveError } from "@bluewave/contracts";
import type { CompiledArmamentMount } from "@bluewave/armament";
import type { CompiledDesignVersion, Officer, PermanentDivision, Ship } from "@bluewave/campaign";
import {
  isShipOperational,
  officerAccuracyBp,
  VACANT_COMMANDER_ACCURACY_BP,
} from "@bluewave/campaign";
import {
  promoteTacticalUnit,
  TACTICAL_UNIT_PROMOTION_INVALID,
  type TacticalShipUnit,
} from "../tactical/unit.js";
import { projectPermanentDivision, type TacticalDivision } from "../tactical/division.js";
import type { TacticalBattleState } from "../tactical/state.js";
import { computeInitialMovementStates } from "../simulation/spawn.js";
import type { GunneryBattery } from "../gunnery/resolve.js";
import {
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  NO_TARGET,
} from "../gunnery/index.js";
import { GUNNERY_RULESET_VERSION, GUNNERY_FORMULA_VERSION } from "../gunnery/constants.js";
import type { BattleManifest } from "../generation/manifest.js";
import {
  initialDamageState,
  type DamageContext,
  type DamageTargetContext,
} from "../damage/minuteDamage.js";
import {
  AUTO_RESOLUTION_COMPARTMENTS,
  AUTO_RESOLUTION_COMPONENTS,
  RANGE_CONTEST_OWN_MANEUVER_BP,
  DEFAULT_AREA_BBOX,
  FLOAT_UNIT,
  GUNNERY_ACCURACY_BASE_BP,
  GUNNERY_BASE_RELOAD_MS,
  STABILITY_INITIAL_BP,
  autoZonesForBelt,
  designedSpeedBpKnots,
} from "./constants.js";
import { resolveRangeController } from "./engagement.js";
import { designRadarFactors, type GunneryRadarRules } from "./gunneryRadar.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { projectTorpedoes } from "./torpedoProjection.js";
import type { TorpedoContext } from "../torpedoes/index.js";
import {
  projectMissileContext,
  type MissileContext,
  type MissileRules,
} from "../missiles/index.js";

import {
  NO_TRAINING_EFFECTS,
  scaleByTrainingBp,
  type BattleTrainingEffects,
  type TrainingEffectsBySide,
} from "./trainingEffects.js";

export interface AutoResolverNation {
  nationId: string;
  ships: Ship[];
  designs: Map<string, CompiledDesignVersion>;
  divisions: PermanentDivision[];
  officers?: Officer[];
  trainingEffects?: BattleTrainingEffects;
}

export interface ProjectBattleInput {
  manifest: BattleManifest;
  areaId: string;
  campaignMonth: string;
  attacker: AutoResolverNation;
  defender: AutoResolverNation;
  rulesetVersion: string;
  gunneryRadar?: GunneryRadarRules;
  missilesRules?: MissileRules;
}

export interface ProjectBattleOutput {
  state: TacticalBattleState;
  batteries: GunneryBattery[];
  damage: DamageContext;
  orders: Record<string, { orderedHeading: number; orderedSpeedBp: number }>;
  units: TacticalShipUnit[];
  designs: Record<string, CompiledDesignVersion>;
  torpedoes?: TorpedoContext;
  missiles?: MissileContext;
  trainingEffects: TrainingEffectsBySide;
}

function commanderAccuracyBp(
  unit: TacticalShipUnit,
  attacker: AutoResolverNation,
  defender: AutoResolverNation,
): number {
  const nation = unit.sideId === "ATTACKER" ? attacker : defender;
  const division = nation.divisions.find((d) => d.shipOrder.includes(unit.assetId));
  if (!division) return 10_000;
  const officer = (nation.officers ?? []).find((o) => o.id === division.commanderOfficerId);
  return officer ? officerAccuracyBp(Number(officer.skill)) : VACANT_COMMANDER_ACCURACY_BP;
}

function mainArmamentOf(design: CompiledDesignVersion): CompiledArmamentMount | undefined {
  const list = design.armament;
  if (!list || list.length === 0) return undefined;
  const sorted = [...list].sort((a, b) =>
    a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
  );
  const caliber = design.mainGunsCaliber as number;
  return sorted.find((a) => a.caliberUm === caliber) ?? sorted[0];
}

export function projectBattle(input: ProjectBattleInput): ProjectBattleOutput {
  const { manifest, attacker, defender } = input;

  const attackerByPid = new Map(attacker.ships.map((s) => [s.id, s]));
  const defenderByPid = new Map(defender.ships.map((s) => [s.id, s]));
  const assets = [...manifest.persistentAssets].sort();

  const promoted: TacticalShipUnit[] = [];
  const unitDesigns: Record<string, CompiledDesignVersion> = {};

  for (const assetId of assets) {
    const ship = attackerByPid.get(assetId) ?? defenderByPid.get(assetId);
    if (!ship) {
      throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
        code: BATTLE_AUTO_RESOLUTION_FAILED,
        assetId,
        battleId: manifest.battleId,
        reason: "manifest persistent asset not found in either nation's committed ships",
      });
    }
    if (!isShipOperational(ship)) continue;

    const sideId: "ATTACKER" | "DEFENDER" = attackerByPid.has(assetId) ? "ATTACKER" : "DEFENDER";
    const designs = sideId === "ATTACKER" ? attacker.designs : defender.designs;
    const design = designs.get(ship.designVersionId);
    if (!design) {
      throw new BluewaveError(TACTICAL_UNIT_PROMOTION_INVALID, {
        code: TACTICAL_UNIT_PROMOTION_INVALID,
        shipId: ship.id,
        designVersionId: ship.designVersionId,
        reason: "missing design reference for a committed ship",
      });
    }

    const unit = promoteTacticalUnit(ship, design, {
      sideId,
      preBattleStateHash: preBattleHash(
        manifest.battleId,
        input.areaId,
        input.campaignMonth,
        ship.id,
      ),
      projectionReason: "auto-resolution",
    });
    promoted.push(unit);
    unitDesigns[unit.assetId] = design;
  }

  const attackerUnits = promoted.filter((u) => u.sideId === "ATTACKER");
  const defenderUnits = promoted.filter((u) => u.sideId === "DEFENDER");
  const units = [...attackerUnits, ...defenderUnits];

  const movement = computeInitialMovementStates(
    DEFAULT_AREA_BBOX,
    units.map((u) => ({
      assetId: u.assetId,
      sideId: u.sideId as "ATTACKER" | "DEFENDER",
      orderedSpeedBpKnots: designedSpeedBpKnots(u.designedSpeedUms as number),
      designedSpeedBpKnots: designedSpeedBpKnots(u.designedSpeedUms as number),
      turningRateMdegS: 1_000,
    })),
  );

  const divisions: TacticalDivision[] = [];
  const projectDivision = (
    div: PermanentDivision,
    sideUnits: TacticalShipUnit[],
    sideId: string,
  ): void => {
    const res = projectPermanentDivision(
      div,
      sideUnits,
      manifest.battleId,
      sideId,
      input.rulesetVersion,
    );
    divisions.push(...res.tacticalDivisions);
  };
  for (const d of attacker.divisions) projectDivision(d, attackerUnits, "ATTACKER");
  for (const d of defender.divisions) projectDivision(d, defenderUnits, "DEFENDER");

  const state: TacticalBattleState = {
    battleId: manifest.battleId,
    mapId: input.areaId,
    sides: [
      { sideId: "ATTACKER", participantIds: attackerUnits.map((u) => u.assetId) },
      { sideId: "DEFENDER", participantIds: defenderUnits.map((u) => u.assetId) },
    ],
    forces: {
      ATTACKER: attackerUnits.map((u) => u.assetId),
      DEFENDER: defenderUnits.map((u) => u.assetId),
    },
    divisions,
    units,
    contacts: [],
    movementStates: movement,
    objectives: [],
    weather: {
      weather: manifest.weather,
      seaState: manifest.seaState,
      visibilityNm: 20,
      daylight: true,
    },
    exitZones: [],
    battleEventLedger: [],
  };

  const rangeControl = resolveRangeController(units);
  const contestedOwnManeuverBp =
    rangeControl.controller === null ? null : RANGE_CONTEST_OWN_MANEUVER_BP;
  const batteries: GunneryBattery[] = [];
  for (const u of units) {
    const design = unitDesigns[u.assetId]!;
    const mainGunsCount = design.mainGunsCount as number;
    if (mainGunsCount <= 0) continue;
    const batteryId = `${u.assetId}:MAIN`;
    const armament = mainArmamentOf(design);
    const radar = designRadarFactors(design.capabilities, input.gunneryRadar);
    const isContesting = rangeControl.controller !== null && u.sideId !== rangeControl.controller;
    batteries.push({
      id: batteryId,
      ownerShipId: u.assetId,
      sideId: u.sideId,
      mountOrdinal: 1,
      commandSource: "CENTRAL",
      baseReloadMs: GUNNERY_BASE_RELOAD_MS,
      salvoCount: mainGunsCount,
      preferredType: "ARMOR_PIERCING",
      rateFactors: neutralRateFactors(),
      ...(radar.blindFireAllowed ? { blindFireAllowed: true } : {}),
      accuracyFactors: {
        ...neutralAccuracyFactors(GUNNERY_ACCURACY_BASE_BP),
        radar: radar.accuracyBp,
        officer: commanderAccuracyBp(u, attacker, defender),
        training: scaleByTrainingBp(
          10_000,
          (u.sideId === "ATTACKER" ? attacker : defender).trainingEffects?.gunneryBp ?? 0,
        ),
        ...(isContesting ? { ownManeuver: contestedOwnManeuverBp! } : {}),
      },
      state: withGunneryStateHash({
        batteryId,
        ownerShipId: u.assetId,
        gunDefinitionId: armament?.gunModelId ?? `${u.designVersionId}:MAIN`,
        mountDefinitionId: armament?.mountId ?? "MAIN-BATTERY",
        ...(armament ? { gunFamilyId: armament.gunFamilyId } : {}),
        ...(armament ? { ammunitionPatternId: armament.ammunitionId } : {}),
        targetContactId: NO_TARGET,
        acquisitionProgressBp: 10_000,
        rangeEstimateUm: 10_000_000_000,
        rangeUncertaintyUm: 150_000_000,
        fireControlSolutionQualityBp: 10_000,
        ammunition: { ARMOR_PIERCING: 10_000, COMMON: 0, HIGH_EXPLOSIVE: 0 },
        fireMode: "NORMAL",
        reloadProgressMs: 0,
        straddleState: null,
        damageState: null,
        aaEligibilityState: null,
        lastSalvoMinute: -1,
        lastSalvoSubstep: 0,
        rulesetVersion: GUNNERY_RULESET_VERSION,
        formulaVersion: GUNNERY_FORMULA_VERSION,
      }),
    });
  }

  const targets: Record<string, DamageTargetContext> = {};
  for (const u of units) {
    const design = unitDesigns[u.assetId]!;
    targets[u.assetId] = {
      shipId: u.assetId,
      zones: autoZonesForBelt(design.normalizedArmorUm as number),
      compartments: [...AUTO_RESOLUTION_COMPARTMENTS],
      components: [...AUTO_RESOLUTION_COMPONENTS],
      state: initialDamageState(u.assetId),
      designFlotationReserve: FLOAT_UNIT,
      designStabilityScore: STABILITY_INITIAL_BP,
      designDisplacementKg: Number(u.displacementKg),
      beltArmorUm: design.normalizedArmorUm as number,
      mainGunsCaliberUm: design.mainGunsCaliber as number,
      shipType: u.shipType,
      maxHitPoints: u.maxHitPoints as number,
    };
  }

  const orders: Record<string, { orderedHeading: number; orderedSpeedBp: number }> = {};
  for (const u of units) {
    const m = movement[u.assetId]!;
    orders[u.assetId] = {
      orderedHeading: m.heading,
      orderedSpeedBp: designedSpeedBpKnots(u.designedSpeedUms as number),
    };
  }

  const torpedoes = projectTorpedoes({
    battleId: manifest.battleId,
    units,
    designs: unitDesigns,
    damageTargets: targets,
  });

  const missiles =
    input.missilesRules === undefined
      ? undefined
      : projectMissileContext(
          units.map((unit) => ({
            shipId: unit.assetId,
            sideId: unit.sideId,
            ...(unit.capabilities === undefined ? {} : { capabilities: unit.capabilities }),
          })),
          input.missilesRules,
        );

  return {
    state,
    batteries,
    damage: { battleId: manifest.battleId, targets },
    orders,
    units,
    designs: unitDesigns,
    ...(torpedoes ? { torpedoes } : {}),
    ...(missiles ? { missiles } : {}),
    trainingEffects: {
      ATTACKER: attacker.trainingEffects ?? NO_TRAINING_EFFECTS,
      DEFENDER: defender.trainingEffects ?? NO_TRAINING_EFFECTS,
    },
  };
}

function preBattleHash(battleId: string, areaId: string, month: string, shipId: string): string {
  return sha256Hex(canonicalSerialize({ battleId, areaId, month, shipId }));
}
