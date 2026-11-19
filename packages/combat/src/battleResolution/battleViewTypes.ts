import type { ExplanationTree } from "@bluewave/events";
import type { PlayerBattleStance } from "./playerSessionTypes.js";
import type { RunPauseReason } from "./playerSessionRun.js";

export const BATTLE_VIEW_VERSION = "battle_view_v1" as const;

export const SIGHTING_TIERS = ["UNIDENTIFIED", "TYPE", "CLASS"] as const;
export type SightingTier = (typeof SIGHTING_TIERS)[number];

export const BATTLE_VIEW_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type BattleViewSeverity = (typeof BATTLE_VIEW_SEVERITIES)[number];

export const DAMAGE_STARS = [0, 1, 2, 3] as const;
export type DamageStars = (typeof DAMAGE_STARS)[number];

export type BattleViewSide = "ATTACKER" | "DEFENDER";
export type PointM = readonly [number, number];

export interface PlannedCourseLine {
  readonly kind: "RAY";
  readonly fromM: PointM;
  readonly headingDeg: number;
  readonly crossesLand: boolean | null;
}

export interface BattleViewOrder {
  readonly stance: PlayerBattleStance;
  readonly speedPercent: number;
  readonly courseDeg: number | null;
  readonly speedKnots: number | null;
  readonly plannedCourse: PlannedCourseLine | null;
  readonly routeCrossesLand: boolean | null;
}

export interface BattleViewMachinery {
  readonly label: string;
}

export interface BattleViewTurretBearing {
  readonly turretId: string;
  readonly bearingDeg: number;
  readonly bearsOnTarget: boolean;
}

export interface BattleViewShipExplanations {
  readonly gunneryAccuracy: ExplanationTree | null;
  readonly torpedoSolution: ExplanationTree | null;
  readonly damageControl: ExplanationTree | null;
  readonly loss: ExplanationTree | null;
}

export interface BattleViewOwnShip {
  readonly shipId: string;
  readonly name: string;
  readonly className: string;
  readonly shipType: string;
  readonly divisionId: string | null;
  readonly positionM: PointM | null;
  readonly headingDeg: number | null;
  readonly orderedSpeedMilliKnots: number | null;
  readonly currentSpeedMilliKnots: number | null;
  readonly attainableSpeedMilliKnots: number | null;
  readonly speedExplanation: ExplanationTree | null;
  readonly damageStars: DamageStars;
  readonly damageState: string;
  readonly hitPoints: number;
  readonly maxHitPoints: number;
  readonly explanations: BattleViewShipExplanations;
  readonly carriesMines: boolean | null;
  readonly machinery: BattleViewMachinery | null;
  readonly separation: BattleViewSeparation | null;
  readonly turrets: readonly BattleViewTurretBearing[];
}

export type BattleViewSeparation = "SEPARATED" | "DISORDERED";

export interface BattleViewOwnDivision {
  readonly divisionId: string;
  readonly flag: "PLAYER";
  readonly role: string;
  readonly formation: string;
  readonly leadShipId: string;
  readonly control: "PLAYER";
  readonly shipIds: readonly string[];
  readonly order: BattleViewOrder | null;
  readonly offStation: boolean | null;
}

interface ContactBase {
  readonly handle: string;
  readonly positionM: PointM;
  readonly ageMinutes: number;
  readonly courseDeg: number;
  readonly speedMilliKnots: number;
  readonly confidenceBp: number;
  readonly stale: boolean;
}

export type BattleViewContact =
  | (ContactBase & { readonly tier: "UNIDENTIFIED" })
  | (ContactBase & { readonly tier: "TYPE"; readonly shipType: string })
  | (ContactBase & {
      readonly tier: "CLASS";
      readonly shipType: string;
      readonly className: string;
    });

export interface BattleViewFriendlyReport {
  readonly reportId: string;
  readonly minute: number;
  readonly positionM: PointM;
  readonly strengthBand: string;
}

export interface BattleViewLogEntry {
  readonly minute: number;
  readonly severity: BattleViewSeverity;
  readonly eventType: string;
  readonly actorRef: string | null;
  readonly targetRef: string | null;
  readonly actorPositionM: PointM | null;
}

export interface BattleViewWeather {
  readonly seaState: string;
  readonly precipitation: string;
  readonly daylight: boolean;
  readonly visibilityM: number;
  readonly windDirectionDeg: number;
  readonly windSpeedMetresPerSecond: number;
}

export interface BattleViewStatus {
  readonly minute: number;
  readonly elapsedMinutes: number;
  readonly maxMinutes: number;
  readonly dayPhase: "DAY" | "NIGHT";
  readonly localMinuteOfDay: number | null;
  readonly latLonAnchor: { readonly latMicroDeg: number; readonly lonMicroDeg: number } | null;
  readonly weather: BattleViewWeather;
}

export interface BattleViewOverlays {
  readonly sightingRangesM: {
    readonly visualM: number;
    readonly radarM: number | null;
  };
  readonly gunRangeArcs: readonly never[];
  readonly fireLines: readonly never[];
  readonly smoke: readonly never[];
  readonly flotillaAttack: boolean | null;
  readonly forceState: string | null;
  readonly terrain: {
    readonly land: readonly never[];
    readonly shallows: readonly never[];
    readonly exclusionZones: readonly never[];
  };
}

export interface BattleViewAccessibility {
  readonly tierLabels: Readonly<Record<SightingTier, string>>;
  readonly stars: Readonly<Record<string, string>>;
}

export interface BattleView {
  readonly version: typeof BATTLE_VIEW_VERSION;
  readonly battleId: string;
  readonly areaId: string;
  readonly campaignMonth: string;
  readonly side: BattleViewSide;
  readonly playerNationId: string;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly pauseReason: RunPauseReason | null;
  readonly objectives: readonly string[];
  readonly status: BattleViewStatus;
  readonly divisions: readonly BattleViewOwnDivision[];
  readonly ships: readonly BattleViewOwnShip[];
  readonly contacts: readonly BattleViewContact[];
  readonly friendlyReports: readonly BattleViewFriendlyReport[];
  readonly overlays: BattleViewOverlays;
  readonly log: readonly BattleViewLogEntry[];
  readonly accessibility: BattleViewAccessibility;
}
