import type { DomainEventBody } from "./validation.js";

export type {
  BattleDeclined,
  BattleInitiated,
  BattleOfferAnswered,
  BattleResolved,
  ConstructionDelayed,
  ConstructionProgressed,
  ConstructionProjectCancelled,
  DeclineThresholdReached,
  DivisionExperienceChanged,
  DomainEventBody,
  DomainEventEnvelope,
  EnemyDeclinedBattle,
  ForeignStationNoRoute,
  ForeignStationShipMoved,
  NationBudgetChanged,
  PresenceShortfall,
  PrestigeChanged,
  PrestigeLossRequested,
  ResearchProgressed,
  RevoltPressureRequested,
  ShipDetachedToFleet,
  ShipReadinessChanged,
  ShipRebuilt,
  ShipRemovedFromDivision,
  ShipStationAssignmentChanged,
  TechnologyDiscovered,
} from "./validation.js";

export type EventVersion = string;
export type AggregateType = string;
export type AggregateId = string;
export type EventType = DomainEventBody["kind"];
export type Reason = string;
