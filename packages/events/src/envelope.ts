import type { DeclinedBattleRecord } from "@bluewave/campaign";
import type { SafeInt } from "@bluewave/contracts";

export type EventVersion = string;
export type AggregateType = string;
export type AggregateId = string;
export type EventType = DomainEventBody["kind"];
export type Reason = string;

export interface NationBudgetChanged {
  readonly kind: "NationBudgetChanged";
  readonly nationId: string;
  readonly previousTreasury: SafeInt;
  readonly newTreasury: SafeInt;
  readonly delta: SafeInt;
  readonly reason: Reason;
}

export interface ConstructionProgressed {
  readonly kind: "ConstructionProgressed";
  readonly projectId: string;
  readonly nationId: string;
  readonly previousWork: SafeInt;
  readonly newWork: SafeInt;
  readonly workAdded: SafeInt;
}

export interface ShipRebuilt {
  readonly kind: "ShipRebuilt";
  readonly projectId: string;
  readonly nationId: string;
  readonly shipId: string;
  readonly fromDesignVersionId: string;
  readonly toDesignVersionId: string;
}

export interface ConstructionProjectCancelled {
  readonly kind: "ConstructionProjectCancelled";
  readonly projectId: string;
  readonly nationId: string;
  readonly projectType: string;
  readonly consumedWork: SafeInt;
  readonly refundedAmount: SafeInt;
  readonly lostAmount: SafeInt;
  readonly salvageableAmount: SafeInt;
  readonly reason: Reason;
}

export interface ConstructionDelayed {
  readonly kind: "ConstructionDelayed";
  readonly projectId: string;
  readonly nationId: string;
  readonly reason: Reason;
  readonly delayMonth: string;
}

export interface ResearchProgressed {
  readonly kind: "ResearchProgressed";
  readonly nationId: string;
  readonly techId: string;
  readonly previousPoints: SafeInt;
  readonly newPoints: SafeInt;
}

export interface BattleInitiated {
  readonly kind: "BattleInitiated";
  readonly battleId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly areaId: string;
}

export interface BattleResolved {
  readonly kind: "BattleResolved";
  readonly battleId: string;
  readonly winnerId: string;
  readonly loserId: string;
}

export interface TechnologyDiscovered {
  readonly kind: "TechnologyDiscovered";
  readonly nationId: string;
  readonly techId: string;
  readonly researchFieldId: string;
  readonly discoveryMonth: string;
  readonly cost: SafeInt;
}

export interface ShipReadinessChanged {
  readonly kind: "ShipReadinessChanged";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromReadiness: string;
  readonly toReadiness: string;
  readonly reason: Reason;
  readonly crewQuality: SafeInt;
}

export interface ShipStationAssignmentChanged {
  readonly kind: "ShipStationAssignmentChanged";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromAssignment: string;
  readonly toAssignment: string;
  readonly reason: Reason;
}

export interface PresenceShortfall {
  readonly kind: "PresenceShortfall";
  readonly nationId: string;
  readonly areaId: string;
  readonly requiredTons: SafeInt;
  readonly presentTons: SafeInt;
  readonly shortfallTons: SafeInt;
}

export interface PrestigeLossRequested {
  readonly kind: "PrestigeLossRequested";
  readonly nationId: string;
  readonly areaId: string;
  readonly shortfallTons: SafeInt;
}

export interface RevoltPressureRequested {
  readonly kind: "RevoltPressureRequested";
  readonly nationId: string;
  readonly areaId: string;
  readonly shortfallTons: SafeInt;
}

export interface ShipDetachedToFleet {
  readonly kind: "ShipDetachedToFleet";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromFleetId: string;
  readonly toFleetId: string;
  readonly areaId: string;
}

export interface ShipRemovedFromDivision {
  readonly kind: "ShipRemovedFromDivision";
  readonly nationId: string;
  readonly shipId: string;
  readonly divisionId: string;
  readonly divisionDissolved: boolean;
  readonly reason: Reason;
}

export interface ForeignStationShipMoved {
  readonly kind: "ForeignStationShipMoved";
  readonly nationId: string;
  readonly shipId: string;
  readonly fleetId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
  readonly targetAreaId: string;
}

export interface ForeignStationNoRoute {
  readonly kind: "ForeignStationNoRoute";
  readonly nationId: string;
  readonly shipId: string;
  readonly areaId: string;
  readonly targetAreaId: string;
}

export interface BattleOfferAnswered {
  readonly kind: "BattleOfferAnswered";
  readonly nationId: string;
  readonly battleId: string;
  readonly missionType: string;
  readonly response: "accept" | "delegate";
  readonly resolutionMode: "AUTO_RESOLVE";
}

type BattleDeclineSummary = Pick<
  DeclinedBattleRecord,
  "nationId" | "battleId" | "missionType" | "areaId" | "victoryPointCost" | "opponentCredit"
>;

export interface BattleDeclined extends BattleDeclineSummary {
  readonly kind: "BattleDeclined";
  readonly declineCount: number;
  readonly reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES";
}

export interface DeclineThresholdReached {
  readonly kind: "DeclineThresholdReached";
  readonly nationId: string;
  readonly battleId: string;
  readonly count: number;
  readonly threshold: number;
  readonly scope: "WAR" | "NATION" | "CAMPAIGN";
  readonly rulesetVersion: string;
}

export interface EnemyDeclinedBattle {
  readonly kind: "EnemyDeclinedBattle";
  readonly nationId: string;
  readonly enemyNationId: string;
  readonly battleId: string;
  readonly missionType: string;
  readonly areaId: string;
  readonly enemyVictoryPointCost: number;
  readonly reasonCode: "ENEMY_DECLINED_BATTLE";
}

export interface PrestigeChanged {
  readonly kind: "PrestigeChanged";
  readonly nationId: string;
  readonly reasonCode: "UNPAID_FUNDS" | "BATTLE_LOST" | "BATTLE_WON" | "DECLINED_BATTLE";
  readonly ruleKind: "PROPORTIONAL_LOSS" | "FIXED_GAIN" | "FIXED_LOSS";
  readonly before: SafeInt;
  readonly after: SafeInt;
  readonly delta: SafeInt;
  readonly rulesetVersion: string;
}

export interface DivisionExperienceChanged {
  readonly kind: "DivisionExperienceChanged";
  readonly nationId: string;
  readonly divisionId: string;
  readonly sourceId: string;
  readonly reasonCode: "BATTLE_PARTICIPATION";
  readonly before: SafeInt;
  readonly after: SafeInt;
  readonly delta: SafeInt;
}

export type DomainEventBody =
  | NationBudgetChanged
  | ConstructionProgressed
  | ConstructionDelayed
  | ShipRebuilt
  | ConstructionProjectCancelled
  | ResearchProgressed
  | BattleInitiated
  | BattleResolved
  | TechnologyDiscovered
  | ShipReadinessChanged
  | ShipStationAssignmentChanged
  | PresenceShortfall
  | PrestigeLossRequested
  | RevoltPressureRequested
  | ShipDetachedToFleet
  | ShipRemovedFromDivision
  | ForeignStationShipMoved
  | ForeignStationNoRoute
  | BattleOfferAnswered
  | BattleDeclined
  | DeclineThresholdReached
  | EnemyDeclinedBattle
  | PrestigeChanged
  | DivisionExperienceChanged;

export interface DomainEventEnvelope<TBody extends DomainEventBody = DomainEventBody> {
  readonly eventId: string;
  readonly version: EventVersion;
  readonly aggregateType: AggregateType;
  readonly aggregateId: AggregateId;
  readonly eventType: TBody["kind"];
  readonly timestamp: string;
  readonly body: TBody;
  readonly sequenceNumber: SafeInt;
}
