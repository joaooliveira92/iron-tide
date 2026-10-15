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

export type DomainEventBody =
  | NationBudgetChanged
  | ConstructionProgressed
  | ConstructionDelayed
  | ShipRebuilt
  | ConstructionProjectCancelled
  | ResearchProgressed
  | BattleInitiated
  | BattleResolved
  | TechnologyDiscovered;

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
