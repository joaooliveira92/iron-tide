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

/**
 * The transition record of a completed rebuild (ADR-0078, DESIGN-23 section 22): the ship changed from one compiled design
 * version to another. The old version stays persisted; this event is the ship-specific record of the change.
 */
export interface ShipRebuilt {
  readonly kind: "ShipRebuilt";
  readonly projectId: string;
  readonly nationId: string;
  readonly shipId: string;
  readonly fromDesignVersionId: string;
  readonly toDesignVersionId: string;
}

/**
 * The explicit record of a cancelled dockyard project (DESIGN-23 section 23; DESIGN-11 settlement contract). Work already
 * completed and paid is `consumedWork` and is not refunded (`refundedAmount` is 0 in the shipped policy); `lostAmount` is
 * the value the nation forfeits by stopping, and `salvageableAmount` is the value recoverable from the partial work —
 * explicit, never silent. `reason` is the stable settlement reason code.
 */
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

/**
 * The one explicit record of a delayed construction month (DESIGN-23 section 7): the project advanced no work and
 * paid no ordinary charge this month. `reason` is the stable reason code the resolving contract names
 * (`PROJECT_DELAYED_ZERO_WORK`, or a specific pressure reason such as `ACCELERATION_CAPACITY_PRESSURE_DELAY`).
 */
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

/**
 * S-1: a ship changed readiness state. Recorded when the monthly crew ramp
 * promotes a working-up ship to active, or when a repair countdown releases a
 * ship. `reason` is a stable code (`WORKING_UP_COMPLETE`, `REPAIR_COMPLETE`);
 * `crewQuality` is the ship's crew quality at the transition.
 */
export interface ShipReadinessChanged {
  readonly kind: "ShipReadinessChanged";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromReadiness: string;
  readonly toReadiness: string;
  readonly reason: Reason;
  readonly crewQuality: SafeInt;
}

/**
 * S-5: a ship's foreign-station assignment changed (spec #73 R1/R2). `reason` is a stable code: `ASSIGNED`,
 * `CLEARED_BY_COMMAND`, or `READINESS_LEFT_ACTIVE` when a readiness change away from ACTIVE removed it.
 * `fromAssignment`/`toAssignment` are the assignment names, or `NONE` when absent.
 */
export interface ShipStationAssignmentChanged {
  readonly kind: "ShipStationAssignmentChanged";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromAssignment: string;
  readonly toAssignment: string;
  readonly reason: Reason;
}

/**
 * S-5 (spec #73 R8, ADR-0247): a nation is short of its required presence in an area this month. Integer whole tons;
 * `shortfallTons` is `requiredTons - presentTons` and always positive (an area with no shortfall emits nothing). The event
 * is a typed request for S-2/S-3 to consume; S-5 mutates no prestige or unrest state.
 */
export interface PresenceShortfall {
  readonly kind: "PresenceShortfall";
  readonly nationId: string;
  readonly areaId: string;
  readonly requiredTons: SafeInt;
  readonly presentTons: SafeInt;
  readonly shortfallTons: SafeInt;
}

/**
 * S-5 (spec #73 R8, ADR-0248): a typed request that S-2 reduce the nation's prestige for a presence shortfall in an area.
 * It names the shortfall only; the magnitude is S-2's to resolve (decision request 0023). S-5 mutates no prestige.
 */
export interface PrestigeLossRequested {
  readonly kind: "PrestigeLossRequested";
  readonly nationId: string;
  readonly areaId: string;
  readonly shortfallTons: SafeInt;
}

/** S-5 (spec #73 R8, ADR-0248): a typed request that S-3 raise revolt pressure in the area; magnitude and trigger are S-3's. */
export interface RevoltPressureRequested {
  readonly kind: "RevoltPressureRequested";
  readonly nationId: string;
  readonly areaId: string;
  readonly shortfallTons: SafeInt;
}

/**
 * S-5 (spec #73 R9, ADR-0249): a foreign-station ship was detached from a multi-ship fleet into a single-ship fleet so it
 * can move alone. Not emitted when the ship already sailed alone.
 */
export interface ShipDetachedToFleet {
  readonly kind: "ShipDetachedToFleet";
  readonly nationId: string;
  readonly shipId: string;
  readonly fromFleetId: string;
  readonly toFleetId: string;
  readonly areaId: string;
}

/**
 * S-5 (spec #73 R9, ADR-0249): a foreign-station ship left its permanent division so it could be routed alone.
 * `divisionDissolved` is true when it was the division's only ship (removing a final ship dissolves the division).
 */
export interface ShipRemovedFromDivision {
  readonly kind: "ShipRemovedFromDivision";
  readonly nationId: string;
  readonly shipId: string;
  readonly divisionId: string;
  readonly divisionDissolved: boolean;
  readonly reason: Reason;
}

/** S-5 (spec #73 R9, ADR-0249): a foreign-station ship sailed one route hop toward the area with the largest shortfall. */
export interface ForeignStationShipMoved {
  readonly kind: "ForeignStationShipMoved";
  readonly nationId: string;
  readonly shipId: string;
  readonly fleetId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
  readonly targetAreaId: string;
}

/** S-5 (spec #73 R9, ADR-0249): no sea route connects a foreign-station ship to its target area; the ship stays put. */
export interface ForeignStationNoRoute {
  readonly kind: "ForeignStationNoRoute";
  readonly nationId: string;
  readonly shipId: string;
  readonly areaId: string;
  readonly targetAreaId: string;
}

/**
 * T-1 03 (spec #109 R7, ticket #112): the player answered a battle offer by accepting it or delegating it to staff. Both
 * resolve through the unchanged auto-resolution path, so the delegate intent is recorded here rather than in campaign
 * state (an accepted or delegated battle leaves the same state as a non-offered one). Declines are a later ticket's.
 */
export interface BattleOfferAnswered {
  readonly kind: "BattleOfferAnswered";
  readonly nationId: string;
  readonly battleId: string;
  readonly missionType: string;
  readonly response: "accept" | "delegate";
  readonly resolutionMode: "AUTO_RESOLVE";
}

/**
 * T-1 04 (spec #109 R8, ticket #113): the player declined a battle offer. The battle is never resolved or fought; the
 * decliner's war score fell by `victoryPointCost` through the war-score seam and the opponent was credited
 * `opponentCredit` (0 unless the ruleset's credit shape says so). `reasonCode` is the stable decline reason.
 */
export interface BattleDeclined {
  readonly kind: "BattleDeclined";
  readonly nationId: string;
  readonly battleId: string;
  readonly missionType: string;
  readonly areaId: string;
  readonly victoryPointCost: number;
  readonly opponentCredit: number;
  readonly reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES";
}

/**
 * T-1 05 (spec #109 R9, ticket #114): a decline made the player's declined-battle count reach the ruleset threshold. It
 * has no effect of its own; the prestige ticket (T-1 06) maps it to a loss through the S-2 seam. `count` is the count
 * after the decline that raised the event, `scope` the ruleset-declared counter scope, `rulesetVersion` the snapshot's.
 */
export interface DeclineThresholdReached {
  readonly kind: "DeclineThresholdReached";
  readonly nationId: string;
  readonly battleId: string;
  readonly count: number;
  readonly threshold: number;
  readonly scope: "WAR" | "NATION" | "CAMPAIGN";
  readonly rulesetVersion: string;
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
  | DeclineThresholdReached;

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
