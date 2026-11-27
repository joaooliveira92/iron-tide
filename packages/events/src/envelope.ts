import type { DomainEventBody } from "./validation.js";

export type {
  BattleDeclined,
  BattleInitiated,
  BattleOfferAnswered,
  BattleResolved,
  ConstructionDelayed,
  ConstructionOverrun,
  ConstructionProgressed,
  ConstructionProjectCancelled,
  DeclineThresholdReached,
  DivisionExperienceChanged,
  DomainEventBody,
  DomainEventEnvelope,
  EnemyDeclinedBattle,
  ExerciseTensionRaised,
  FleetExerciseCompleted,
  FleetExerciseScheduled,
  ForeignStationNoRoute,
  ForeignStationShipMoved,
  MerchantLossSuffered,
  RaiderEngaged,
  RaiderInterned,
  RaiderReleased,
  NeutralWarEntered,
  SubmarineWarshipAttacked,
  NationBudgetChanged,
  PossessionTransferred,
  PresenceShortfall,
  PrestigeChanged,
  UnrestChanged,
  UnrestConsequence,
  PrestigeLossRequested,
  ResearchProgressed,
  RevoltPressureRequested,
  ShipDelivered,
  ShipDetachedToFleet,
  ShipReadinessChanged,
  ShipRebuilt,
  ShipRemovedFromDivision,
  ShipStationAssignmentChanged,
  TechnologyDiscovered,
  TradeProtectionAssessed,
} from "./validation.js";

export type EventVersion = string;
export type AggregateType = string;
export type AggregateId = string;
export type EventType = DomainEventBody["kind"];
export type Reason = string;
