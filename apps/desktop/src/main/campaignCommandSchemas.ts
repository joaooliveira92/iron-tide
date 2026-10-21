import { CANONICAL_SCENARIO_IDS, FLEET_SIZE_IDS, RESEARCH_IDS } from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  prioritySeveritySchema,
  strategicPriorityTypeSchema,
} from "@bluewave/campaign-engine";
import { Schema } from "effect";
import {
  INSPECTOR_MAX_WIDTH_PX,
  INSPECTOR_MIN_WIDTH_PX,
} from "../shared/campaign-command-contract.js";

/**
 * ENGINEERING-CONTRACT.md's Electron boundary rule requires IPC requests to be
 * validated. This validates the payload's wire shape (fields present, correct
 * primitive types, and — for the fixed-catalog fields — one of the known ids)
 * at the process boundary; deeper semantic validation (does this *combination*
 * of scenario/nation/setting actually exist, e.g. is this fleet-size setting
 * supported by this scenario) stays in `@bluewave/campaign`'s
 * `validateCampaignConfiguration` / `createInitialCampaignState`, matching
 * `campaignSaveSchema.ts`'s existing split between wire-shape validation and
 * domain-code semantics.
 *
 * Migrated from Zod to Effect Schema (ADR-0102). `Schema.Struct` strips
 * unmodeled keys by default, matching Zod's `z.object` default; the wire shape
 * is unchanged.
 */

/** `z.string().min(1)` — non-empty, not trimmed (decode is identity). */
const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

/** `z.number().int().nonnegative()` — finite integer `>= 0`. */
const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/** `z.number().int().positive()` — finite integer `> 0`. */
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));

/** `z.number().int()` — finite integer (any sign). */
const int = Schema.Finite.check(Schema.isInt());

/**
 * A bounded string: `z.string().min(min).max(max)`. Array/string `length` is
 * what `Schema.isMinLength`/`Schema.isMaxLength` inspect.
 */
const boundedString = (min: number, max: number) =>
  Schema.String.check(Schema.isMinLength(min), Schema.isMaxLength(max));

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

/**
 * `CommandEnvelope` (`shared/bridge-contract.ts`) — the
 * `{sessionId, expectedRevision, transportRequestId}` triple shared by every
 * optimistic-concurrency command. `commitMonth` (ticket 13) is the first
 * command wired against it; construction/fleet submit/replace/cancel
 * (ticket 10) reuse this same schema when they land.
 */
export const CommandEnvelopePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  expectedRevision: nonNegativeInt,
  transportRequestId: nonEmptyString,
});

/**
 * Wire shapes for the Construction screen commands (ticket 14) — the
 * `CommandEnvelope` triple plus the command-specific fields. Deeper checks
 * (design exists, design belongs to the player, command in flight) live in
 * `commands/constructionCommands.ts`, matching the wire-shape/semantics split
 * used everywhere else.
 */
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

/**
 * Wire shapes for the construction-status commands (DESIGN-23 sections 7-8; SB3-R5/R8) — halt, resume and the
 * acceleration toggle. Deeper checks (the project exists, belongs to the issuing nation, and the transition is legal)
 * are the engine's own `validatePayloadRules`, run at issue time by `submitPlayerCommand`.
 */
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

/** Cancel a project and settle it (DESIGN-23 section 23); deeper checks are the engine's own issue-time validation. */
export const CancelConstructionProjectPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
});

/** The class-order batch (DESIGN-23 sections 3-5; SB3-R11): a positive integer quantity, capped at the batch limit. */
export const OrderConstructionBatchCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
});

/**
 * The read-only batch preview (SB3-R30/R33): a positive integer quantity. The engine enforces the exact `1..12` bound
 * and returns `CONSTRUCTION_BATCH_LIMIT_EXCEEDED`, so no bound lives here.
 */
export const PreviewConstructionBatchCommandPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
});

/** The dock-expansion authorization (DESIGN-16 sections 5-6; SB3-R16). */
export const AuthorizeDockExpansionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  possessionId: nonEmptyString,
});

/** A `YYYY-MM` month string (`z.string().length(7).regex(...)`). */
const monthString = Schema.String.check(
  Schema.isMinLength(7),
  Schema.isMaxLength(7),
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/),
);

/**
 * The foreign-yard order (DESIGN-16 sections 13.1-13.4; SB3-R20..R22). The payload carries only the player's choices —
 * design, builder, quantity and an optional delivery month. The engine derives the contract `terms` and the builder
 * `capability` from authoritative content; this schema is decoded with `onExcessProperty: "error"` (see
 * `campaignBridge.ts`), so a payload that still carries `terms`/`capability` is rejected at the IPC boundary
 * (`INVALID_PAYLOAD`) rather than trusted.
 */
export const PlaceForeignConstructionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  designVersionId: nonEmptyString,
  builderNationId: nonEmptyString,
  quantity: positiveInt,
  plannedDeliveryMonth: Schema.optional(monthString),
});

/**
 * The read-only foreign-order preview (SB3-R20/R23/R34; INC-9b). Carries the player's choices only; the engine derives
 * the candidate builders, the capability verdict and the contract terms. `builderNationId`/`plannedDeliveryMonth` are
 * optional — the builder list is returned without them.
 */
export const PreviewForeignConstructionCommandPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  designVersionId: nonEmptyString,
  quantity: positiveInt,
  builderNationId: Schema.optional(nonEmptyString),
  plannedDeliveryMonth: Schema.optional(monthString),
});

/**
 * Wire shape for `setResearchPriorityCommand` (desktop-engine-feature-gate
 * INC-2): the `CommandEnvelope` triple plus strict field priorities. The wire
 * boundary enforces integer values and caps the record at the canonical field
 * set (source-size limit per ENGINEERING-CONTRACT "Security"). Deeper checks
 * (field ids valid, all fields present, every weight in the DESIGN-20 scale,
 * 1..MAX high fields) are a desktop-side mirror of
 * `packages/commands/src/lifecycle.ts`'s `validateSetResearchPriority`, kept
 * in `researchCommands.ts` so invalid input is surfaced with the engine's own
 * stable code (`RESEARCH_PRIORITY_CONSTRAINT_VIOLATED`) — see spec D4. (The
 * engine itself does not reject unknown field keys; the desktop mirror is
 * intentionally stricter, recorded in the feature-gate ticket trail.)
 */
export const SetResearchPriorityCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  fieldPriorities: Schema.Record(Schema.String, nonNegativeInt).check(
    // `Schema.Record` selects only matching keys and silently drops the rest, so a
    // key schema of `nonEmptyString` would fail open (an `""` key would vanish). The
    // key schema is therefore `Schema.String` and empty keys are rejected explicitly.
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

/**
 * Wire shape of one of the 7 B10c diplomacy command bodies
 * (desktop-diplomacy-war INC-2). `nationId` is intentionally absent — it is
 * always the session's player slot, filled in by the handler. Deeper checks
 * (target exists, not already at war, …) are the ENGINE's own
 * `CommandLifecycle.validate()` at issue time — never a desktop mirror (spec
 * D1/D2).
 */
export const DiplomacyCommandBodySchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("DeclareWar"),
    targetNationId: nonEmptyString,
    warGoalsId: Schema.optional(nonEmptyString),
  }),
  Schema.Struct({ type: Schema.Literal("AcceptPeace"), warId: nonEmptyString }),
  Schema.Struct({ type: Schema.Literal("FormAlliance"), partnerNationId: nonEmptyString }),
  Schema.Struct({ type: Schema.Literal("BreakAlliance"), partnerNationId: nonEmptyString }),
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

/** Wire shape for `submitDiplomacyCommand` — the `CommandEnvelope` triple plus
 * the discriminated command body. */
export const SubmitDiplomacyCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  command: DiplomacyCommandBodySchema,
});

/**
 * Wire shape of one of the 5 engine division commands. Shape and size bounds only
 * (`z.string().min(1)`);
 * legality — ship-type compatibility, size by type, same location, ownership — is
 * the ENGINE's own `CommandLifecycle.validate()` at issue time, never a desktop mirror.
 */
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
  Schema.Struct({ type: Schema.Literal("DissolveDivision"), divisionId: nonEmptyString }),
]);

/** Wire shapes for the fleet movement commands; legality is the engine's (`MoveFleet`). */
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

/**
 * The `@bluewave/ship-design` draft as JSON. The wire boundary only proves it is a
 * non-null object of unknown values, mirroring the previous
 * `z.custom<Record<string, unknown>>((v) => typeof v === "object" && v !== null)`
 * predicate (which also accepted arrays and other object instances); the engine and
 * the ship-design compiler validate the draft's contents. `Schema.Record` cannot
 * express this: it rejects arrays and silently drops non-string keys, so a
 * `Schema.declare` carrying the exact pre-migration guard is used instead.
 */
const DraftObjectSchema = Schema.declare<Record<string, unknown>>(
  (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
  { expected: "object" },
);

/** Wire shape for `submitDesignCommand`; the draft is validated by the engine (`SubmitDesign`) and the ship-design compiler. */
export const SubmitDesignCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  className: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  draft: DraftObjectSchema,
});

/** Wire shape for `reviseProjectCommand`; the engine and the ship-design compiler validate the draft. */
export const ReviseProjectCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  projectId: nonEmptyString,
  draft: DraftObjectSchema,
});

export const LoadShipDraftPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  shipId: nonEmptyString,
});

/** Wire shape for `checkRebuild`; the ship-design compiler and the rebuild rules validate the draft. */
export const RebuildCheckPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  shipId: nonEmptyString,
  draft: DraftObjectSchema,
  rebuildKind: Schema.optional(Schema.Literals(["BULGE"])),
});

/** Wire shape for `startRebuildCommand`. */
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

/** Wire shape for `submitBudgetAllocation`; bounds are the engine's own (validated at issue). */
export const SubmitBudgetAllocationPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  appropriationRateBp: int,
  researchBudget: int,
});

/** Wire shape for `submitStationAssignment`; ownership, status and eligibility are the engine's (issue-time validation). */
export const SubmitStationAssignmentPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  intent: Schema.Literals(["assign", "clear"]),
  shipIds: Schema.Array(nonEmptyString).check(Schema.isMinLength(1), Schema.isMaxLength(256)),
});

/** Wire shape for `submitDivisionCommand`. */
export const SubmitDivisionCommandPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  command: DivisionCommandBodySchema,
});

/**
 * Renderer-owned UI-state sidecar (`ui-state.json`, spec §7 Dismissal + §8
 * Persistence). Strict boundary schemas per ENGINEERING-CONTRACT "Content":
 * the `status` is a closed enum, `lastCompletedStep` is a bounded integer in
 * the 7-step (0-indexed) range 0..6, and the fingerprints array is
 * source-size capped (64 entries, each ≤ 256 chars). The wire shape validates
 * at this IPC boundary; the file read tolerantly falls back to empty defaults
 * on any mismatch. Never authoritative.
 */
export const FirstMonthInspectionSchema = Schema.Struct({
  status: Schema.Literals(["not_started", "in_progress", "completed", "dismissed"]),
  lastCompletedStep: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 6 }),
  ),
});

/** The shipbuilding inspector layout (ADR-0038): presentation-only pane state, never authoritative. */
export const InspectorLayoutSchema = Schema.Struct({
  widthPx: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: INSPECTOR_MIN_WIDTH_PX, maximum: INSPECTOR_MAX_WIDTH_PX }),
  ),
  collapsed: Schema.Boolean,
});

/** Turn-summary pin/read state: presentation-only, never authoritative (ADR-0038). */
export const TurnMessagesSchema = Schema.Struct({
  pinnedIds: Schema.Array(boundedString(1, 128)).check(Schema.isMaxLength(512)),
  readIds: Schema.Array(boundedString(1, 128)).check(Schema.isMaxLength(512)),
});

/** The full on-disk `ui-state.json` shape (also the read command's result). */
export const UiStateSchema = Schema.Struct({
  turnNumber: nonNegativeInt,
  dismissedFingerprints: Schema.Array(boundedString(1, 256)).check(Schema.isMaxLength(64)),
  firstMonthInspection: Schema.optional(FirstMonthInspectionSchema),
  inspector: Schema.optional(InspectorLayoutSchema),
  turnMessages: Schema.optional(TurnMessagesSchema),
});

/**
 * Write-payload wire shape for `writeUiState`. `turnNumber` is intentionally
 * ABSENT: the handler stamps it from the session's current
 * `state.snapshot.turnNumber`, so the sidecar can never be written against a
 * stale turn (expiry stays honest). `firstMonthInspection` is optional and —
 * when absent — carried forward from the stored sidecar (merge semantics,
 * see `WriteUiStatePayload`); an explicit reset sends
 * `{ status: "not_started", lastCompletedStep: 0 }`. Deeper checks (session
 * exists, save dir writable) live in `uiState.ts`, matching the
 * wire-shape/semantics split.
 */
export const WriteUiStatePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  dismissedFingerprints: Schema.Array(boundedString(1, 256)).check(Schema.isMaxLength(64)),
  firstMonthInspection: Schema.optional(FirstMonthInspectionSchema),
  inspector: Schema.optional(InspectorLayoutSchema),
  turnMessages: Schema.optional(TurnMessagesSchema),
});

/**
 * The `monthly-reports.json` sidecar (spec §16 "Report history"). Strict shape:
 * every section field is required, every enum/type closed. The read tolerantly
 * falls back to empty on any mismatch (see `monthlyReports.ts`); the file is
 * never authoritative. Numbers are plain finite integers (the derived view's
 * own rounding already happened in the engine/main).
 */
const ReportMonthSchema = Schema.Struct({
  year: nonNegativeInt,
  month: nonNegativeInt,
});

const MonthlyReportLedgerRowSchema = Schema.Struct({
  id: nonEmptyString,
  description: Schema.String,
  phase: Schema.String,
  amount: int,
  runningBalance: int,
  // Spec #138: additive, so reports stored before the economy model still decode.
  requested: Schema.optional(int),
  shortfall: Schema.optional(int),
});

const MonthlyReportReconciliationSchema = Schema.Struct({
  opening: int,
  revenue: int,
  construction: int,
  preservation: int,
  maintenance: int,
  obligation: int,
  research: int,
  other: int,
  closing: int,
});

const MonthlyReportTreasurySchema = Schema.Struct({
  openingTreasury: int,
  closingTreasury: int,
  maintenanceCost: int,
  constructionSpending: int,
  researchExpense: int,
  governmentAllocation: int,
  netChange: int,
  ledgerRows: Schema.Array(MonthlyReportLedgerRowSchema),
  obligationExpense: Schema.optional(int),
  reconciliation: Schema.optional(MonthlyReportReconciliationSchema),
});

const MonthlyReportShipSchema = Schema.Struct({
  shipId: nonEmptyString,
  name: Schema.String,
});

const MonthlyReportConstructionSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ projectId: nonEmptyString, previousWork: int, newWork: int }),
  ),
  completedShips: Schema.Array(MonthlyReportShipSchema),
  newlyActiveProjectIds: Schema.Array(nonEmptyString),
});

const MonthlyReportResearchSchema = Schema.Struct({
  progress: Schema.Array(
    Schema.Struct({ techId: nonEmptyString, previousPoints: int, newPoints: int }),
  ),
  discoveries: Schema.Array(
    Schema.Struct({ techId: nonEmptyString, researchFieldId: nonEmptyString }),
  ),
});

const MonthlyReportFleetSchema = Schema.Struct({
  additions: Schema.Array(MonthlyReportShipSchema),
  totalActiveShips: nonNegativeInt,
});

const BattleOutcomeSchema = Schema.Struct({
  battleId: nonEmptyString,
  areaId: Schema.String,
  attackerId: nonEmptyString,
  defenderId: nonEmptyString,
  winnerId: Schema.NullOr(Schema.String),
  loserId: Schema.NullOr(Schema.String),
  warScoreDelta: int,
  attackerLosses: Schema.Array(Schema.String),
  defenderLosses: Schema.Array(Schema.String),
  explanation: Schema.Array(Schema.String),
});

const StrategicPrioritySchema = Schema.Struct({
  id: nonEmptyString,
  type: strategicPriorityTypeSchema,
  severity: prioritySeveritySchema,
  title: Schema.String,
  summary: Schema.String,
  reason: Schema.String,
  destination: Schema.Literals(["overview", "construction", "fleet", "research", "diplomacy"]),
  fingerprint: nonEmptyString,
});

const MonthlyReportEntrySchema = Schema.Struct({
  reportId: nonEmptyString,
  campaignId: nonEmptyString,
  turn: nonNegativeInt,
  period: Schema.Struct({ from: ReportMonthSchema, to: ReportMonthSchema }),
  generatedAt: nonEmptyString,
  treasury: MonthlyReportTreasurySchema,
  construction: MonthlyReportConstructionSchema,
  research: MonthlyReportResearchSchema,
  fleet: MonthlyReportFleetSchema,
  priorities: Schema.Array(StrategicPrioritySchema),
  battleOutcomes: Schema.Array(BattleOutcomeSchema),
});

export const MonthlyReportsSchema = Schema.Struct({
  reports: Schema.Array(MonthlyReportEntrySchema),
});

/** Tactical Sandbox payloads (debug-only; ADR-0057). */
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

/**
 * Campaign Battle Drill payload (debug-only; the desktop E2E acceptance slice).
 * Same wire-shape discipline as the other debug battle commands: a session id
 * plus an optional war id; the handler is the sole authority on war eligibility.
 */
export const SeedCampaignBattleDrillPayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  warId: Schema.optional(nonEmptyString),
});

export const ResolveTacticalBattlePayloadSchema = Schema.Struct({
  ...BattleIdPayloadSchema.fields,
  turnCount: positiveInt,
  scriptedOrders: Schema.Array(Schema.Unknown),
});
