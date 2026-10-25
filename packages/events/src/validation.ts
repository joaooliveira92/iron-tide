import { SafeInt } from "@bluewave/contracts";
import { Schema } from "effect";

const parseOptions = { onExcessProperty: "error" } as const;

const nonEmptyString = Schema.Trim.check(Schema.isMinLength(1));

const safeInt: Schema.declare<SafeInt> = Schema.declare<SafeInt>(
  (value): value is SafeInt => typeof value === "number" && SafeInt.isSafeInt(value),
  { expected: "SafeInt" },
);

const nonNegativeSafeInt = safeInt.check(Schema.isGreaterThanOrEqualTo(0));

const positiveSafeInt = safeInt.check(Schema.isGreaterThanOrEqualTo(1));

const DATETIME_OFFSET_RE =
  /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|([+-](?:[01]\d|2[0-3]):[0-5]\d)))$/;

const discoveryMonth = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Expected YYYY-MM" }),
);

export const NationBudgetChangedSchema = Schema.Struct({
  kind: Schema.Literal("NationBudgetChanged"),
  nationId: nonEmptyString,
  previousTreasury: safeInt,
  newTreasury: safeInt,
  delta: safeInt,
  reason: nonEmptyString,
});

export const ConstructionProgressedSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionProgressed"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  previousWork: nonNegativeSafeInt,
  newWork: nonNegativeSafeInt,
  workAdded: nonNegativeSafeInt,
});

export const ConstructionDelayedSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionDelayed"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  reason: nonEmptyString,
  delayMonth: discoveryMonth,
});

export const ShipRebuiltSchema = Schema.Struct({
  kind: Schema.Literal("ShipRebuilt"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromDesignVersionId: nonEmptyString,
  toDesignVersionId: nonEmptyString,
});

export const ConstructionProjectCancelledSchema = Schema.Struct({
  kind: Schema.Literal("ConstructionProjectCancelled"),
  projectId: nonEmptyString,
  nationId: nonEmptyString,
  projectType: nonEmptyString,
  consumedWork: nonNegativeSafeInt,
  refundedAmount: nonNegativeSafeInt,
  lostAmount: nonNegativeSafeInt,
  salvageableAmount: nonNegativeSafeInt,
  reason: nonEmptyString,
});

export const ResearchProgressedSchema = Schema.Struct({
  kind: Schema.Literal("ResearchProgressed"),
  nationId: nonEmptyString,
  techId: nonEmptyString,
  previousPoints: nonNegativeSafeInt,
  newPoints: nonNegativeSafeInt,
});

export const BattleInitiatedSchema = Schema.Struct({
  kind: Schema.Literal("BattleInitiated"),
  battleId: nonEmptyString,
  attackerId: nonEmptyString,
  defenderId: nonEmptyString,
  areaId: nonEmptyString,
});

export const BattleResolvedSchema = Schema.Struct({
  kind: Schema.Literal("BattleResolved"),
  battleId: nonEmptyString,
  winnerId: nonEmptyString,
  loserId: nonEmptyString,
});

export const TechnologyDiscoveredSchema = Schema.Struct({
  kind: Schema.Literal("TechnologyDiscovered"),
  nationId: nonEmptyString,
  techId: nonEmptyString,
  researchFieldId: nonEmptyString,
  discoveryMonth,
  cost: nonNegativeSafeInt,
});

export const ShipReadinessChangedSchema = Schema.Struct({
  kind: Schema.Literal("ShipReadinessChanged"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromReadiness: nonEmptyString,
  toReadiness: nonEmptyString,
  reason: nonEmptyString,
  crewQuality: nonNegativeSafeInt,
});

export const ShipStationAssignmentChangedSchema = Schema.Struct({
  kind: Schema.Literal("ShipStationAssignmentChanged"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromAssignment: nonEmptyString,
  toAssignment: nonEmptyString,
  reason: nonEmptyString,
});

export const PresenceShortfallSchema = Schema.Struct({
  kind: Schema.Literal("PresenceShortfall"),
  nationId: nonEmptyString,
  areaId: nonEmptyString,
  requiredTons: nonNegativeSafeInt,
  presentTons: nonNegativeSafeInt,
  shortfallTons: nonNegativeSafeInt.check(Schema.isGreaterThan(0)),
});

export const BattleOfferAnsweredSchema = Schema.Struct({
  kind: Schema.Literal("BattleOfferAnswered"),
  nationId: nonEmptyString,
  battleId: nonEmptyString,
  missionType: nonEmptyString,
  response: Schema.Literals(["accept", "delegate"]),
  resolutionMode: Schema.Literal("AUTO_RESOLVE"),
});

export const BattleDeclinedSchema = Schema.Struct({
  kind: Schema.Literal("BattleDeclined"),
  nationId: nonEmptyString,
  battleId: nonEmptyString,
  missionType: nonEmptyString,
  areaId: nonEmptyString,
  victoryPointCost: nonNegativeSafeInt,
  opponentCredit: nonNegativeSafeInt,
  declineCount: positiveSafeInt,
  reasonCode: Schema.Literal("BATTLE_DECLINED_WITH_CONSEQUENCES"),
});

export const DeclineThresholdReachedSchema = Schema.Struct({
  kind: Schema.Literal("DeclineThresholdReached"),
  nationId: nonEmptyString,
  battleId: nonEmptyString,
  count: positiveSafeInt,
  threshold: positiveSafeInt,
  scope: Schema.Literals(["WAR", "NATION", "CAMPAIGN"]),
  rulesetVersion: nonEmptyString,
});

export const EnemyDeclinedBattleSchema = Schema.Struct({
  kind: Schema.Literal("EnemyDeclinedBattle"),
  nationId: nonEmptyString,
  enemyNationId: nonEmptyString,
  battleId: nonEmptyString,
  missionType: nonEmptyString,
  areaId: nonEmptyString,
  enemyVictoryPointCost: nonNegativeSafeInt,
  reasonCode: Schema.Literal("ENEMY_DECLINED_BATTLE"),
});

export const PrestigeChangedSchema = Schema.Struct({
  kind: Schema.Literal("PrestigeChanged"),
  nationId: nonEmptyString,
  reasonCode: Schema.Literals(["UNPAID_FUNDS", "BATTLE_LOST", "BATTLE_WON", "DECLINED_BATTLE"]),
  ruleKind: Schema.Literals(["PROPORTIONAL_LOSS", "FIXED_GAIN", "FIXED_LOSS"]),
  before: nonNegativeSafeInt,
  after: nonNegativeSafeInt,
  delta: safeInt,
  rulesetVersion: nonEmptyString,
});

export const DivisionExperienceChangedSchema = Schema.Struct({
  kind: Schema.Literal("DivisionExperienceChanged"),
  nationId: nonEmptyString,
  divisionId: nonEmptyString,
  sourceId: nonEmptyString,
  reasonCode: Schema.Literals(["BATTLE_PARTICIPATION"]),
  before: nonNegativeSafeInt,
  after: nonNegativeSafeInt,
  delta: nonNegativeSafeInt,
});

export const PrestigeLossRequestedSchema = Schema.Struct({
  kind: Schema.Literal("PrestigeLossRequested"),
  nationId: nonEmptyString,
  areaId: nonEmptyString,
  shortfallTons: nonNegativeSafeInt.check(Schema.isGreaterThan(0)),
});

export const RevoltPressureRequestedSchema = Schema.Struct({
  kind: Schema.Literal("RevoltPressureRequested"),
  nationId: nonEmptyString,
  areaId: nonEmptyString,
  shortfallTons: nonNegativeSafeInt.check(Schema.isGreaterThan(0)),
});

export const ShipDetachedToFleetSchema = Schema.Struct({
  kind: Schema.Literal("ShipDetachedToFleet"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fromFleetId: nonEmptyString,
  toFleetId: nonEmptyString,
  areaId: nonEmptyString,
});

export const ShipRemovedFromDivisionSchema = Schema.Struct({
  kind: Schema.Literal("ShipRemovedFromDivision"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  divisionId: nonEmptyString,
  divisionDissolved: Schema.Boolean,
  reason: nonEmptyString,
});

export const ForeignStationShipMovedSchema = Schema.Struct({
  kind: Schema.Literal("ForeignStationShipMoved"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  fleetId: nonEmptyString,
  fromAreaId: nonEmptyString,
  toAreaId: nonEmptyString,
  targetAreaId: nonEmptyString,
});

export const ForeignStationNoRouteSchema = Schema.Struct({
  kind: Schema.Literal("ForeignStationNoRoute"),
  nationId: nonEmptyString,
  shipId: nonEmptyString,
  areaId: nonEmptyString,
  targetAreaId: nonEmptyString,
});

export const DomainEventBodySchema = Schema.Union([
  NationBudgetChangedSchema,
  ConstructionProgressedSchema,
  ConstructionDelayedSchema,
  ShipRebuiltSchema,
  ConstructionProjectCancelledSchema,
  ResearchProgressedSchema,
  BattleInitiatedSchema,
  BattleResolvedSchema,
  TechnologyDiscoveredSchema,
  ShipReadinessChangedSchema,
  ShipStationAssignmentChangedSchema,
  PresenceShortfallSchema,
  PrestigeLossRequestedSchema,
  RevoltPressureRequestedSchema,
  ShipDetachedToFleetSchema,
  ShipRemovedFromDivisionSchema,
  ForeignStationShipMovedSchema,
  ForeignStationNoRouteSchema,
  BattleOfferAnsweredSchema,
  BattleDeclinedSchema,
  DeclineThresholdReachedSchema,
  EnemyDeclinedBattleSchema,
  PrestigeChangedSchema,
  DivisionExperienceChangedSchema,
]);

const eventKindList = [
  "NationBudgetChanged",
  "ConstructionProgressed",
  "ConstructionDelayed",
  "ShipRebuilt",
  "ConstructionProjectCancelled",
  "ResearchProgressed",
  "BattleInitiated",
  "BattleResolved",
  "TechnologyDiscovered",
  "ShipReadinessChanged",
  "ShipStationAssignmentChanged",
  "PresenceShortfall",
  "PrestigeLossRequested",
  "RevoltPressureRequested",
  "ShipDetachedToFleet",
  "ShipRemovedFromDivision",
  "ForeignStationShipMoved",
  "ForeignStationNoRoute",
  "BattleOfferAnswered",
  "BattleDeclined",
  "DeclineThresholdReached",
  "EnemyDeclinedBattle",
  "PrestigeChanged",
  "DivisionExperienceChanged",
] as const;

export const DomainEventEnvelopeSchema = Schema.Struct({
  eventId: nonEmptyString,
  version: nonEmptyString,
  aggregateType: nonEmptyString,
  aggregateId: nonEmptyString,
  eventType: Schema.Literals(eventKindList),
  timestamp: Schema.String.check(Schema.isPattern(DATETIME_OFFSET_RE)),
  body: DomainEventBodySchema,
  sequenceNumber: nonNegativeSafeInt,
}).check(
  Schema.makeFilter((event) =>
    event.eventType === event.body.kind
      ? undefined
      : `eventType must match body.kind (${event.body.kind})`,
  ),
);

export type NationBudgetChanged = Schema.Schema.Type<typeof NationBudgetChangedSchema>;
export type ConstructionProgressed = Schema.Schema.Type<typeof ConstructionProgressedSchema>;
export type ConstructionDelayed = Schema.Schema.Type<typeof ConstructionDelayedSchema>;
export type ShipRebuilt = Schema.Schema.Type<typeof ShipRebuiltSchema>;
export type ConstructionProjectCancelled = Schema.Schema.Type<
  typeof ConstructionProjectCancelledSchema
>;
export type ResearchProgressed = Schema.Schema.Type<typeof ResearchProgressedSchema>;
export type BattleInitiated = Schema.Schema.Type<typeof BattleInitiatedSchema>;
export type BattleResolved = Schema.Schema.Type<typeof BattleResolvedSchema>;
export type TechnologyDiscovered = Schema.Schema.Type<typeof TechnologyDiscoveredSchema>;
export type ShipReadinessChanged = Schema.Schema.Type<typeof ShipReadinessChangedSchema>;
export type ShipStationAssignmentChanged = Schema.Schema.Type<
  typeof ShipStationAssignmentChangedSchema
>;
export type PresenceShortfall = Schema.Schema.Type<typeof PresenceShortfallSchema>;
export type BattleOfferAnswered = Schema.Schema.Type<typeof BattleOfferAnsweredSchema>;
export type BattleDeclined = Schema.Schema.Type<typeof BattleDeclinedSchema>;
export type DeclineThresholdReached = Schema.Schema.Type<typeof DeclineThresholdReachedSchema>;
export type EnemyDeclinedBattle = Schema.Schema.Type<typeof EnemyDeclinedBattleSchema>;
export type PrestigeChanged = Schema.Schema.Type<typeof PrestigeChangedSchema>;
export type DivisionExperienceChanged = Schema.Schema.Type<typeof DivisionExperienceChangedSchema>;
export type PrestigeLossRequested = Schema.Schema.Type<typeof PrestigeLossRequestedSchema>;
export type RevoltPressureRequested = Schema.Schema.Type<typeof RevoltPressureRequestedSchema>;
export type ShipDetachedToFleet = Schema.Schema.Type<typeof ShipDetachedToFleetSchema>;
export type ShipRemovedFromDivision = Schema.Schema.Type<typeof ShipRemovedFromDivisionSchema>;
export type ForeignStationShipMoved = Schema.Schema.Type<typeof ForeignStationShipMovedSchema>;
export type ForeignStationNoRoute = Schema.Schema.Type<typeof ForeignStationNoRouteSchema>;
export type DomainEventBody = Schema.Schema.Type<typeof DomainEventBodySchema>;

type EnvelopeShell = Omit<
  Schema.Schema.Type<typeof DomainEventEnvelopeSchema>,
  "body" | "eventType"
>;

export type DomainEventEnvelope<TBody extends DomainEventBody = DomainEventBody> = EnvelopeShell & {
  readonly eventType: TBody["kind"];
  readonly body: TBody;
};

export function parseDomainEventBody(input: unknown): DomainEventBody {
  return Schema.decodeUnknownSync(DomainEventBodySchema, parseOptions)(input);
}

export function parseDomainEventEnvelope(input: unknown): DomainEventEnvelope {
  return Schema.decodeUnknownSync(DomainEventEnvelopeSchema, parseOptions)(input);
}
