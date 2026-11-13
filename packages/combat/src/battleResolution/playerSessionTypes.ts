import type { ExplanationTree } from "@bluewave/events";
import type { GunneryBattery } from "../gunnery/resolve.js";
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
import { DIVISION_STANCES, type DivisionStance } from "../orders/index.js";

export const PLAYER_BATTLE_STANCES = DIVISION_STANCES;
export type PlayerBattleStance = DivisionStance;

export interface PlayerBattleDivisionOrder {
  readonly stance: PlayerBattleStance;
  readonly speedPercent: number;
  readonly courseDeg?: number;
  readonly speedKnots?: number;
}

export interface PlayerBattleOrders {
  readonly divisions: Readonly<Record<string, PlayerBattleDivisionOrder>>;
}

export interface PlayerBattleEvent {
  readonly minute: number;
  readonly eventType: string;
  readonly actorId: string;
  readonly targetId: string;
}

export interface PlayerBattleShipView {
  readonly shipId: string;
  readonly name: string;
  readonly className: string;
  readonly shipType: string;
  readonly sideId: string;
  readonly divisionId: string | null;
  readonly hitPoints: number;
  readonly maxHitPoints: number;
  readonly damageState: string;
  readonly position: readonly [number, number] | null;
  readonly headingDeg: number | null;
  readonly speedBp: number | null;
  readonly contactConfidenceBp: number | null;
  readonly motion?: ExplanationTree;
  readonly gunneryAccuracy?: ExplanationTree;
  readonly torpedoSolution?: ExplanationTree;
  readonly damageControl?: ExplanationTree;
  readonly loss?: ExplanationTree;
}

export interface PlayerBattleDivisionView {
  readonly divisionId: string;
  readonly sideId: string;
  readonly role: string;
  readonly formation: string;
  readonly flagshipId: string;
  readonly unitIds: readonly string[];
}

export interface PlayerBattleView {
  readonly battleId: string;
  readonly campaignMonth: string;
  readonly playerNationId: string;
  readonly areaId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly minute: number;
  readonly maxMinutes: number;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly objectives: readonly string[];
  readonly weather: {
    readonly seaState: string;
    readonly visibilityNm: number;
    readonly precipitation: string;
    readonly daylight: boolean;
  };
  readonly ships: readonly PlayerBattleShipView[];
  readonly divisions: readonly PlayerBattleDivisionView[];
  readonly log: readonly PlayerBattleEvent[];
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
}
