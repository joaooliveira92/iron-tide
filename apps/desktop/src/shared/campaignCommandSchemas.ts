import { CANONICAL_SCENARIO_IDS, FLEET_SIZE_IDS, RESEARCH_IDS } from "@bluewave/campaign";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/campaign-engine";
import { Schema } from "effect";
import {
  boundedString,
  int,
  nonEmptyString,
  nonNegativeInt,
  positiveInt,
} from "./schema-primitives.js";

export const CampaignConfigurationPayloadSchema = Schema.Struct({
  scenarioId: Schema.Literals(CANONICAL_SCENARIO_IDS),
  playerSlotId: nonEmptyString,
  continuityModeId: Schema.Literals(["historical", "alternate_continuity_v1"]),
  fleetSizeSettingId: Schema.Literals(FLEET_SIZE_IDS),
  researchSpeedSettingId: Schema.Literals(RESEARCH_IDS),
  technologyVariationSettingId: Schema.Literals(["none", "some", "considerable"]),
  historicalBudgetOptionId: nonEmptyString,
  legacyFleetModeId: nonEmptyString,
  tacticalRealismModeId: nonEmptyString,
  difficultyProfileId: nonEmptyString,
  campaignSeed: nonEmptyString,
  configurationSchemaVersion: nonEmptyString,
  archetype: Schema.optional(Schema.String),
});

export const SessionIdPayloadSchema = nonEmptyString;

export const CommandEnvelopePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  expectedRevision: nonNegativeInt,
  transportRequestId: nonEmptyString,
});

export const ConstructionOrderPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  designId: nonEmptyString,
});

export const ReplaceConstructionOrderPayloadSchema = Schema.Struct({
  ...ConstructionOrderPayloadSchema.fields,
  commandId: nonEmptyString,
});

export const CancelConstructionOrderPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  commandId: nonEmptyString,
});

export const HaltConstructionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
});

export const ResumeConstructionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
});

export const SetAccelerationCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
  accelerated: Schema.Boolean,
});

export const CancelConstructionProjectPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
});

export const OrderConstructionBatchCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
});

export const PreviewConstructionBatchCommandPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
});

export const AuthorizeDockExpansionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  possessionId: nonEmptyString,
});

const monthString = Schema.String.check(
  Schema.isMinLength(7),
  Schema.isMaxLength(7),
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/),
);

export const PlaceForeignConstructionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  designVersionId: nonEmptyString,
  builderNationId: nonEmptyString,
  quantity: positiveInt,
  plannedDeliveryMonth: Schema.optional(monthString),
});

export const PreviewForeignConstructionCommandPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
  builderNationId: Schema.optional(nonEmptyString),
  plannedDeliveryMonth: Schema.optional(monthString),
});

export const SetResearchPriorityCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  fieldPriorities: Schema.Record(Schema.String, nonNegativeInt).check(
    Schema.makeFilter((record) =>
      Object.keys(record).every((key) => key.length > 0)
        ? undefined
        : "fieldPriorities keys must be non-empty",
    ),
    Schema.makeFilter((record) =>
      Object.keys(record).length <= CANONICAL_RESEARCH_FIELD_IDS.length
        ? undefined
        : "fieldPriorities cannot exceed the canonical research field set",
    ),
  ),
  exactTechId: Schema.optional(nonEmptyString),
});

export const DiplomacyCommandBodySchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("DeclareWar"),
    targetNationId: nonEmptyString,
    warGoalsId: Schema.optional(nonEmptyString),
  }),
  Schema.Struct({ type: Schema.Literal("AcceptPeace"), warId: nonEmptyString }),
  Schema.Struct({
    type: Schema.Literal("FormAlliance"),
    partnerNationId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("BreakAlliance"),
    partnerNationId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("FormNonAggressionPact"),
    partnerNationId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("BreakNonAggressionPact"),
    partnerNationId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("DeclareBlockade"),
    targetNationId: nonEmptyString,
    areaId: nonEmptyString,
  }),
]);

export const SubmitDiplomacyCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  command: DiplomacyCommandBodySchema,
});

export const DivisionCommandBodySchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("CreateDivision"),
    flagshipShipId: nonEmptyString,
    role: nonEmptyString,
    formation: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("AddShipToDivision"),
    divisionId: nonEmptyString,
    shipId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("RemoveShipFromDivision"),
    divisionId: nonEmptyString,
    shipId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("ChangeDivisionFlagship"),
    divisionId: nonEmptyString,
    newFlagshipShipId: nonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("ReorderDivisionShips"),
    divisionId: nonEmptyString,
    shipOrder: Schema.Array(nonEmptyString).check(Schema.isMinLength(1), Schema.isMaxLength(6)),
  }),
  Schema.Struct({
    type: Schema.Literal("DissolveDivision"),
    divisionId: nonEmptyString,
  }),
]);

export const SubmitMovementCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  divisionId: nonEmptyString,
  fromAreaId: Schema.String,
  toAreaId: nonEmptyString,
});
export const ReplaceMovementCommandPayloadSchema = Schema.Struct({
  ...SubmitMovementCommandPayloadSchema.fields,
  commandId: nonEmptyString,
});
export const CancelMovementCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  commandId: nonEmptyString,
});

const DraftObjectSchema = Schema.declare<Record<string, unknown>>(
  (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
  { expected: "object" },
);

export const SubmitDesignCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  className: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  draft: DraftObjectSchema,
});

export const ReviseProjectCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
  draft: DraftObjectSchema,
});

export const LoadShipDraftPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  shipId: nonEmptyString,
});

export const RebuildCheckPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  shipId: nonEmptyString,
  draft: DraftObjectSchema,
  rebuildKind: Schema.optional(Schema.Literals(["BULGE"])),
});

export const StartRebuildCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  shipId: nonEmptyString,
  draft: DraftObjectSchema,
  rebuildKind: Schema.optional(Schema.Literals(["BULGE"])),
});

export const LoadProjectDraftPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  projectId: nonEmptyString,
});

export const SubmitBudgetAllocationPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  appropriationRateBp: int,
  researchBudget: int,
});

export const SubmitStationAssignmentPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  intent: Schema.Literals(["assign", "clear"]),
  shipIds: Schema.Array(nonEmptyString).check(Schema.isMinLength(1), Schema.isMaxLength(256)),
});

export const SubmitShipReadinessPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  readiness: Schema.Literals(["ACTIVE", "RESERVE", "MOTHBALLED"]),
  shipIds: Schema.Array(nonEmptyString).check(Schema.isMinLength(1), Schema.isMaxLength(256)),
});

export const SubmitDivisionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  command: DivisionCommandBodySchema,
});

export const GenerateBattlePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  warId: Schema.optional(nonEmptyString),
  areaId: Schema.optional(nonEmptyString),
  strengthScale: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 })),
  ),
});

export const BattleIdPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  battleId: nonEmptyString,
});

export const SeedCampaignBattleDrillPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  warId: Schema.optional(nonEmptyString),
});

export const ResolveTacticalBattlePayloadSchema = Schema.Struct({
  ...BattleIdPayloadSchema.fields,
  turnCount: positiveInt,
  scriptedOrders: Schema.Array(Schema.Unknown),
});

export const RecentPackagePayloadSchema = Schema.Struct({
  packagePath: Schema.NonEmptyString,
});

export const AnswerDecisionPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  interruptionId: nonEmptyString,
  decisionId: nonEmptyString,
  optionId: nonEmptyString,
});

export const SubmitBattleResultPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  interruptionId: nonEmptyString,
  battleId: nonEmptyString,
  winnerId: Schema.NullOr(nonEmptyString),
  loserId: Schema.NullOr(nonEmptyString),
  attackerLosses: Schema.Array(nonEmptyString),
  defenderLosses: Schema.Array(nonEmptyString),
  damageReport: Schema.Record(Schema.String, Schema.Number),
});

export const SubmitOfferResponsePayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  interruptionId: nonEmptyString,
  battleId: nonEmptyString,
  response: Schema.Literals(["accept", "decline", "delegate"]),
});

export const MAX_DRAWING_BOARD_LOG_CHARS = 4_000_000;

export const WriteDrawingBoardDraftPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  draft: Schema.NullOr(
    Schema.Struct({
      presetId: boundedString(1, 200),
      log: boundedString(1, MAX_DRAWING_BOARD_LOG_CHARS),
    }),
  ),
});
