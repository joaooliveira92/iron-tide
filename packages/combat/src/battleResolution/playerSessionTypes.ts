import type {
  CollisionContext,
  CollisionRules,
  TacticalMinefieldRecord,
} from "../collision/index.js";
import type { TerrainView } from "../terrain/index.js";
import type { DivisionAiMemory } from "../division-ai/memory.js";
import type { GunneryBattery } from "../gunnery/resolve.js";
import type { SeparationState } from "../navigation/model.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { StrategicWeatherState, WeatherEngineContext } from "../weather/neighbour.js";
import type { TorpedoContext } from "../torpedoes/index.js";
import type { MissileContext, MissileRules } from "../missiles/index.js";
import type { SmokeContext } from "../smoke/engineWiring.js";
import type { AirCombatContext } from "../air-combat/engineWiring.js";
import type { AirDefenseContext } from "../air-defense/engineWiring.js";
import type { DamageContext } from "../damage/minuteDamage.js";
import type { BattleManifest } from "../generation/manifest.js";
import type { GunneryRadarRules } from "./gunneryRadar.js";
import type { GunQualityRules } from "./gunQualityRules.js";
import type { AutoResolverNation } from "./project.js";
import type { TrainingEffectsBySide } from "./trainingEffects.js";
import {
  DIVISION_STANCES,
  type DivisionStance,
  type ForceOrderIssue,
  type ForceOrderRuleset,
  type ForceOrderSet,
  type ForceRuntime,
  type RealismMode,
} from "../orders/index.js";

export const PLAYER_BATTLE_STANCES = DIVISION_STANCES;
export type PlayerBattleStance = DivisionStance;

export interface PlayerBattleWaypoint {
  readonly xMetres: number;
  readonly yMetres: number;
  readonly pauseOnArrival: boolean;
}

export interface PlayerBattleWaypointArrival extends PlayerBattleWaypoint {
  readonly headingDeg: number;
  readonly minute: number;
}

export interface WaypointRules {
  readonly arrivalToleranceMetres: number;
}

export interface PlayerBattleDivisionOrder {
  readonly stance: PlayerBattleStance;
  readonly speedPercent: number;
  readonly courseDeg?: number;
  readonly speedKnots?: number;
  readonly waypoint?: PlayerBattleWaypoint;
  readonly targetHandle?: string;
}

export interface PlayerBattleOrders {
  readonly divisions: Readonly<Record<string, PlayerBattleDivisionOrder>>;
  readonly forceOrders?: ForceOrderSet;
}

export interface PlayerForceSession {
  readonly forceId: string;
  readonly realismMode: RealismMode;
  readonly ruleset: ForceOrderRuleset;
  readonly runtime: ForceRuntime;
  readonly lastIssues: readonly ForceOrderIssue[];
}

export interface PlayerBattleEvent {
  readonly minute: number;
  readonly eventType: string;
  readonly actorId: string;
  readonly targetId: string;
}

export interface PlayerBattleResult {
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

export interface CreatePlayerBattleInput {
  readonly manifest: BattleManifest;
  readonly areaId: string;
  readonly campaignMonth: string;
  readonly attacker: AutoResolverNation;
  readonly defender: AutoResolverNation;
  readonly playerNationId: string;
  readonly strategicWeather: StrategicWeatherState;
  readonly campaignSeed: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly rngVersion: string;
  readonly gunneryRadar?: GunneryRadarRules;
  readonly gunQuality?: GunQualityRules;
  readonly missilesRules?: MissileRules;
  readonly maxMinutes?: number;
  readonly waypointRules?: WaypointRules;
  readonly terrain?: TerrainView;
  readonly minefields?: readonly TacticalMinefieldRecord[];
  readonly collisionRules?: CollisionRules;
}

export interface PlayerDivisionAiSession {
  readonly memory: DivisionAiMemory;
}

export interface PlayerBattleSession {
  readonly battleId: string;
  readonly areaId: string;
  readonly campaignMonth: string;
  readonly playerNationId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly seed: string;
  readonly battleDate: string;
  readonly maxMinutes: number;
  readonly minute: number;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly objectives: readonly string[];
  readonly state: TacticalBattleState;
  readonly batteries: readonly GunneryBattery[];
  readonly damage: DamageContext;
  readonly weather: WeatherEngineContext;
  readonly torpedoes?: TorpedoContext;
  readonly missiles?: MissileContext;
  readonly smoke: SmokeContext;
  readonly airCombat: AirCombatContext;
  readonly airDefense: AirDefenseContext;
  readonly units: readonly TacticalShipUnit[];
  readonly trainingEffects: TrainingEffectsBySide;
  readonly baseOrders: Readonly<
    Record<string, { readonly orderedHeading: number; readonly orderedSpeedBp: number }>
  >;
  readonly log: readonly PlayerBattleEvent[];
  readonly result: PlayerBattleResult | null;
  readonly force?: PlayerForceSession;
  readonly waypointRules?: WaypointRules;
  readonly waypointArrivals?: Readonly<Record<string, PlayerBattleWaypointArrival>>;
  readonly separation?: Readonly<Record<string, SeparationState>>;
  readonly collision?: CollisionContext;
  readonly divisionAi?: PlayerDivisionAiSession;
}
