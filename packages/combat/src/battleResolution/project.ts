//packages/combat/src/battleResolution/project.ts
// B-6 INC-2 (AC-4): project the battle manifest + committed campaign ships
// (B-1 promotions) + divisions into a deterministic `TacticalBattleState` with
// realism-independent stats (DESIGN-38 §9, §33), the main-battery gunnery
// surface, and the per-ship damage contexts.
//
// Rules (recorded in ADR-0026):
//  - only ships on `manifest.persistentAssets` that are present in the owning
//    nation's fleets and NOT under construction are promoted; unit assetId ==
//    campaign ship id;
//  - sides follow the manifest (ATTACKER nation / DEFENDER nation), units
//    ordered by canonicalized persistentAssets;
//  - a missing design for a promoted ship fails closed with the promotion
//    guard's TACTICAL_UNIT_PROMOTION_INVALID (never a silent skip);
//  - an asset on the manifest missing from both nations fails closed with
//    BATTLE_AUTO_RESOLUTION_FAILED and a stable diagnostic (no partial result);
//  - movement spawn uses the canonical default area bbox; initial headings
//    from spawn.ts (attackers heading 0 = east, defenders 180 = west).
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
import { initialDamageState, type DamageContext, type DamageTargetContext } from "./damage.js";
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
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { projectTorpedoes } from "./torpedoProjection.js";
import type { TorpedoContext } from "../torpedoes/index.js";

export interface AutoResolverNation {
  nationId: string;
  ships: Ship[];
  designs: Map<string, CompiledDesignVersion>;
  divisions: PermanentDivision[];
  /** The nation's officer corps; a division commander's skill adds to its ships' accuracy (ADR-0065). */
  officers?: Officer[];
}

export interface ProjectBattleInput {
  manifest: BattleManifest;
  areaId: string;
  campaignMonth: string;
  attacker: AutoResolverNation;
  defender: AutoResolverNation;
  rulesetVersion: string;
}

export interface ProjectBattleOutput {
  state: TacticalBattleState;
  /** Main-battery gunnery surface (engine/resolver thread the states). */
  batteries: GunneryBattery[];
  /** Per-ship damage contexts (engine/resolver update states per minute). */
  damage: DamageContext;
  /** Mission orders (spawn headings at full designed speed). */
  orders: Record<string, { orderedHeading: number; orderedSpeedBp: number }>;
  /** Promoted units keyed by assetId. */
  units: TacticalShipUnit[];
  /** Resolved designs for the promoted units (promotion-verified). */
  designs: Record<string, CompiledDesignVersion>;
  /** P-1: torpedo launchers + targets; absent when no unit carries torpedo armament. */
  torpedoes?: TorpedoContext;
}

/**
 * Accuracy multiplier (bp) from the commander of the division a ship belongs to
 * (ADR-0065). Ships outside any division, and every nation without divisions, stay neutral;
 * a division with no commander (or an unknown one) takes the DESIGN-26 vacancy penalty.
 */
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

/**
 * The main-battery armament installation of a compiled design (ADR-0093 Step 4): the deterministically
 * first installation whose caliber matches the design's aggregated main-gun caliber, else the first
 * installation by placement id. Absent when the design carries no first-class armament snapshot (a legacy
 * or authored design), which projects through the documented compatibility path.
 */
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

  // ---- Committed ships: manifest.persistentAssets only ---------------------
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
    if (!isShipOperational(ship)) continue; // B-1: under-construction (or under-rebuild) ships cannot promote

    const sideId: "ATTACKER" | "DEFENDER" = attackerByPid.has(assetId) ? "ATTACKER" : "DEFENDER";
    const designs = sideId === "ATTACKER" ? attacker.designs : defender.designs;
    const design = designs.get(ship.designVersionId);
    if (!design) {
      // Fail closed with the promotion guard's stable diagnostic — a design is
      // REQUIRED for every committed ship (never a silent skip).
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

  // ---- sides/forces (attacker then defender, canonical asset order) --------
  const attackerUnits = promoted.filter((u) => u.sideId === "ATTACKER");
  const defenderUnits = promoted.filter((u) => u.sideId === "DEFENDER");
  const units = [...attackerUnits, ...defenderUnits];

  // ---- movement spawn (canonical default area box) -------------------------
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

  // P-1 ticket 08 (supersedes the ADR-0046 override): spawn.ts now follows movement's
  // `directionBp` convention (0 = +X east, 180 = -X west), so ATTACKER 0 / DEFENDER 180
  // closing headings come straight from `computeInitialMovementStates`.

  // ---- divisions -----------------------------------------------------------
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

  // ---- main-battery gunnery surface (one battery per armed ship) -----------
  // ADR-0072: the side with the greater maximum designed speed is the RANGE
  // CONTROLLER (standoff doctrine — it dictates the engagement band; see
  // engagement.ts). The contesting side is denied the range initiative: it still
  // charges straight under ADR-0046 pursuit. That denial is priced by an
  // explicitly versioned BALANCE TARGET — the contesting side's DESIGN-39 §3
  // `ownManeuver` factor is multiplied to RANGE_CONTEST_OWN_MANEUVER_BP — not by
  // actual manoeuvring (the side performs none). Equal maximum speeds leave both
  // sides neutral (controller = null, no penalty).
  const rangeControl = resolveRangeController(units);
  const contestedOwnManeuverBp =
    rangeControl.controller === null ? null : RANGE_CONTEST_OWN_MANEUVER_BP;
  const batteries: GunneryBattery[] = [];
  for (const u of units) {
    const design = unitDesigns[u.assetId]!;
    const mainGunsCount = design.mainGunsCount as number;
    if (mainGunsCount <= 0) continue; // no main battery -> no gunnery (canonical)
    const batteryId = `${u.assetId}:MAIN`;
    const armament = mainArmamentOf(design);
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
      accuracyFactors: {
        ...neutralAccuracyFactors(GUNNERY_ACCURACY_BASE_BP),
        officer: commanderAccuracyBp(u, attacker, defender),
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

  // ---- per-ship damage contexts --------------------------------------------
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

  // ---- orders (keep spawn headings; steam at full designed speed) ----------
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

  return {
    state,
    batteries,
    damage: { battleId: manifest.battleId, targets },
    orders,
    units,
    designs: unitDesigns,
    ...(torpedoes ? { torpedoes } : {}),
  };
}

/** Deterministic pre-battle state hash for a promoted ship (promotion seam). */
function preBattleHash(battleId: string, areaId: string, month: string, shipId: string): string {
  return sha256Hex(canonicalSerialize({ battleId, areaId, month, shipId }));
}
