import { battleLoss } from "../damage/minuteDamage.js";
import type { TacticalContact } from "../contact/neighbour.js";
import type { SeparationState } from "../navigation/model.js";
import type { TacticalDivision } from "../tactical/division.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import { explainShipMotion } from "./battle-explanations.js";
import {
  pointMetres,
  projectContact,
  projectLog,
  sightingTier,
  toMetres,
  visibilityMetres,
  type LogResolver,
} from "./battleViewFog.js";
import { BATTLE_VIEW_TUNING, starsForLoss, type BattleViewTuning } from "./battleViewTuning.js";
import {
  BATTLE_VIEW_VERSION,
  type BattleView,
  type BattleViewAccessibility,
  type BattleViewContact,
  type BattleViewOrder,
  type BattleViewOverlays,
  type BattleViewOwnDivision,
  type BattleViewOwnShip,
  type BattleViewSeparation,
  type BattleViewSide,
  type BattleViewStatus,
  type PointM,
} from "./battleViewTypes.js";
import { playerSideOf } from "./playerSessionPause.js";
import type { RunPauseReason } from "./playerSessionRun.js";
import type {
  PlayerBattleDivisionOrder,
  PlayerBattleOrders,
  PlayerBattleSession,
} from "./playerSessionTypes.js";

export interface BattleViewInput {
  readonly pauseReason: RunPauseReason | null;
  readonly orders: PlayerBattleOrders | null;
}

export const BATTLE_VIEW_ACCESSIBILITY: BattleViewAccessibility = {
  tierLabels: {
    UNIDENTIFIED: "battle.view.tier.unidentified",
    TYPE: "battle.view.tier.type",
    CLASS: "battle.view.tier.class",
  },
  stars: {
    "0": "battle.view.damage.none",
    "1": "battle.view.damage.light",
    "2": "battle.view.damage.heavy",
    "3": "battle.view.damage.critical",
  },
};

function orderView(
  order: PlayerBattleDivisionOrder | undefined,
  from: PointM | null,
): BattleViewOrder | null {
  if (order === undefined) return null;
  const courseDeg = order.courseDeg ?? null;
  return {
    stance: order.stance,
    speedPercent: order.speedPercent,
    courseDeg,
    speedKnots: order.speedKnots ?? null,
    plannedCourse:
      courseDeg === null || from === null
        ? null
        : { kind: "RAY", fromM: from, headingDeg: courseDeg, crossesLand: null },
  };
}

function separationFlag(state: SeparationState | undefined): BattleViewSeparation | null {
  if (state === undefined) return null;
  if (state.separated) return "SEPARATED";
  return state.disordered ? "DISORDERED" : null;
}

function ownShipView(
  session: PlayerBattleSession,
  unit: TacticalShipUnit,
  divisionOfShip: ReadonlyMap<string, string>,
  tuning: BattleViewTuning,
): BattleViewOwnShip {
  const movement = session.state.movementStates?.[unit.assetId];
  const damage = session.damage.targets[unit.assetId]?.state;
  const maxHitPoints = unit.maxHitPoints as number;
  const lost =
    damage === undefined
      ? 0
      : (battleLoss(unit.hitPoints as number, damage, maxHitPoints) as number);
  const lossBp =
    maxHitPoints > 0 ? Math.floor((lost * tuning.damageStars.scaleBp) / maxHitPoints) : 0;
  return {
    shipId: unit.assetId,
    name: unit.name,
    className: unit.className,
    shipType: unit.shipType,
    divisionId: divisionOfShip.get(unit.assetId) ?? null,
    positionM: movement === undefined ? null : pointMetres(movement.position),
    headingDeg: movement?.heading ?? null,
    orderedSpeedMilliKnots: movement?.orderedSpeed ?? null,
    currentSpeedMilliKnots: movement?.currentSpeed ?? null,
    attainableSpeedMilliKnots: null,
    speedExplanation: movement === undefined ? null : explainShipMotion(movement),
    damageStars: starsForLoss(lossBp, tuning),
    damageState: damage?.terminalStatus ?? "NORMAL",
    carriesMines: null,
    machinery: null,
    separation: separationFlag(session.separation?.[unit.assetId]),
    turrets: [],
  };
}

function divisionView(
  division: TacticalDivision,
  order: PlayerBattleDivisionOrder | undefined,
  leadPosition: PointM | null,
): BattleViewOwnDivision {
  return {
    divisionId: division.tacticalDivisionId,
    flag: "PLAYER",
    role: division.role,
    formation: division.formation,
    leadShipId: division.tacticalFlagshipId,
    control: "PLAYER",
    shipIds: [...division.orderedTacticalUnitIds],
    order: orderView(order, leadPosition),
    offStation: null,
  };
}

function contactViews(
  session: PlayerBattleSession,
  side: BattleViewSide,
  observers: readonly PointM[],
): ReadonlyMap<string, BattleViewContact> {
  const unitOf = new Map(session.units.map((unit) => [unit.assetId, unit] as const));
  const visibilityM = visibilityMetres(session);
  const views = new Map<string, BattleViewContact>();
  const hostile = (session.state.contacts ?? []).filter(
    (contact: TacticalContact) => contact.sideId !== side && unitOf.has(contact.assetId),
  );
  for (const contact of hostile) {
    const unit = unitOf.get(contact.assetId)!;
    const tier = sightingTier(contact, observers, visibilityM);
    views.set(
      contact.assetId,
      projectContact(session, contact, tier, {
        shipType: unit.shipType,
        className: unit.className,
      }),
    );
  }
  return views;
}

function statusView(session: PlayerBattleSession, visibilityM: number): BattleViewStatus {
  const { weather, components } = {
    weather: session.state.weather,
    components: session.weather.components,
  };
  return {
    minute: session.minute,
    elapsedMinutes: session.minute,
    maxMinutes: session.maxMinutes,
    dayPhase: weather.daylight ? "DAY" : "NIGHT",
    localMinuteOfDay: null,
    latLonAnchor: null,
    weather: {
      seaState: weather.seaState,
      precipitation: weather.weather,
      daylight: weather.daylight,
      visibilityM,
      windDirectionDeg: components.windDirectionDeg,
      windSpeedMetresPerSecond: toMetres(components.windSpeedUmPerSec),
    },
  };
}

function overlaysView(visibilityM: number): BattleViewOverlays {
  return {
    sightingRangesM: { visualM: visibilityM, radarM: null },
    gunRangeArcs: [],
    fireLines: [],
    smoke: [],
    flotillaAttack: null,
    forceState: null,
    terrain: { land: [], shallows: [], exclusionZones: [] },
  };
}

export function battleView(
  session: PlayerBattleSession,
  input: BattleViewInput,
  tuning: BattleViewTuning = BATTLE_VIEW_TUNING,
): BattleView {
  const side = playerSideOf(session);
  const ownUnits = session.units.filter((unit) => unit.sideId === side);
  const divisions = session.state.divisions.filter((division) => division.sideId === side);
  const divisionOfShip = new Map<string, string>();
  for (const division of divisions) {
    for (const shipId of division.orderedTacticalUnitIds) {
      divisionOfShip.set(shipId, division.tacticalDivisionId);
    }
  }
  const ships = ownUnits.map((unit) => ownShipView(session, unit, divisionOfShip, tuning));
  const ownPositions = new Map<string, PointM>();
  for (const ship of ships)
    if (ship.positionM !== null) ownPositions.set(ship.shipId, ship.positionM);
  const observers = ships
    .filter((ship) => ship.damageState === "NORMAL" && ship.positionM !== null)
    .map((ship) => ship.positionM!);
  const contactsByAsset = contactViews(session, side, observers);
  const resolver: LogResolver = {
    ownIds: new Set(ownUnits.map((unit) => unit.assetId)),
    ownPositions,
    contactsByAsset,
  };
  const visibilityM = visibilityMetres(session);
  return {
    version: BATTLE_VIEW_VERSION,
    battleId: session.battleId,
    areaId: session.areaId,
    side,
    playerNationId: session.playerNationId,
    ended: session.ended,
    endReason: session.endReason,
    winnerId: session.winnerId,
    loserId: session.loserId,
    pauseReason: input.pauseReason,
    objectives: [...session.objectives],
    status: statusView(session, visibilityM),
    divisions: divisions.map((division) =>
      divisionView(
        division,
        input.orders?.divisions[division.tacticalDivisionId],
        ownPositions.get(division.tacticalFlagshipId) ?? null,
      ),
    ),
    ships,
    contacts: [...contactsByAsset.values()].sort((a, b) => (a.handle < b.handle ? -1 : 1)),
    friendlyReports: [],
    overlays: overlaysView(visibilityM),
    log: projectLog(session, resolver, tuning),
    accessibility: BATTLE_VIEW_ACCESSIBILITY,
  };
}
