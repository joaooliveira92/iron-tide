import { prioritySeveritySchema, strategicPriorityTypeSchema } from "@bluewave/campaign-engine";
import type { ExplanationTree } from "@bluewave/events";
import { Schema } from "effect";
import { int, nonEmptyString, nonNegativeInt } from "./schema-primitives.js";

const ReportMonthSchema = Schema.Struct({
  year: nonNegativeInt,
  month: nonNegativeInt,
});

const ExplanationSourceSchema = Schema.Struct({
  kind: Schema.Literals(["ruleset", "content", "manual", "code"]),
  ref: nonEmptyString,
});

export const ExplanationTreeSchema: Schema.Codec<ExplanationTree> = Schema.Struct({
  formulaId: nonEmptyString,
  formulaVersion: nonEmptyString,
  inputs: Schema.Record(Schema.String, Schema.Union([Schema.Finite, Schema.String])),
  intermediate: Schema.Record(Schema.String, Schema.Finite),
  result: Schema.Finite,
  unit: Schema.optional(nonEmptyString),
  operation: Schema.optional(
    Schema.Literals(["identity", "add", "subtract", "multiply", "divide", "round", "clamp"]),
  ),
  source: Schema.optional(ExplanationSourceSchema),
  children: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Codec<ExplanationTree> => ExplanationTreeSchema)),
  ),
});

const MonthlyReportLedgerRowSchema = Schema.Struct({
  id: nonEmptyString,
  description: Schema.String,
  phase: Schema.String,
  amount: int,
  runningBalance: int,
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
  treasuryExplanation: Schema.optional(ExplanationTreeSchema),
});

const MonthlyReportShipSchema = Schema.Struct({
  shipId: nonEmptyString,
  name: Schema.String,
});

const MonthlyReportConstructionSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({
      projectId: nonEmptyString,
      previousWork: int,
      newWork: int,
    }),
  ),
  completedShips: Schema.Array(MonthlyReportShipSchema),
  newlyActiveProjectIds: Schema.Array(nonEmptyString),
});

const MonthlyReportResearchSchema = Schema.Struct({
  progress: Schema.Array(
    Schema.Struct({
      techId: nonEmptyString,
      previousPoints: int,
      newPoints: int,
    }),
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

const MonthlyReportPresenceSchema = Schema.Struct({
  shortfalls: Schema.Array(
    Schema.Struct({
      areaId: nonEmptyString,
      requiredTons: nonNegativeInt,
      presentTons: nonNegativeInt,
      shortfallTons: nonNegativeInt,
    }),
  ),
  prestigeDelta: Schema.optional(int),
});

const ExerciseMonthSchema = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/));

const MonthlyReportFleetExerciseSchema = Schema.Struct({
  scheduled: Schema.optional(
    Schema.Struct({ month: ExerciseMonthSchema, shipIds: Schema.Array(nonEmptyString) }),
  ),
  completed: Schema.optional(
    Schema.Struct({
      month: ExerciseMonthSchema,
      shipIds: Schema.Array(nonEmptyString),
      experienceGained: nonNegativeInt,
    }),
  ),
  tension: Schema.Array(
    Schema.Struct({
      otherNationId: nonEmptyString,
      before: nonNegativeInt,
      after: nonNegativeInt,
    }),
  ),
});

const MonthlyReportTradeProtectionSchema = Schema.Struct({
  quota: nonNegativeInt,
  assigned: nonNegativeInt,
  shortfall: nonNegativeInt,
  shortfallBp: nonNegativeInt,
  loss: Schema.optional(
    Schema.Struct({
      raiderHits: nonNegativeInt,
      submarineHits: Schema.optional(nonNegativeInt),
      pressureHit: Schema.Boolean,
      lossBp: nonNegativeInt,
      poolBefore: nonNegativeInt,
      poolAfter: nonNegativeInt,
    }),
  ),
  raiders: Schema.optional(
    Schema.Array(
      Schema.Struct({
        shipId: nonEmptyString,
        shipName: Schema.optional(nonEmptyString),
        event: Schema.Literals(["ENGAGED", "INTERNED", "RELEASED"]),
        encounter: Schema.optional(Schema.Literals(["INTERCEPTION", "BREAKOUT"])),
        victimNationId: Schema.optional(nonEmptyString),
        outcome: Schema.optional(Schema.Literals(["SURVIVED", "SUNK", "SCUTTLED", "INTERNED"])),
        cause: Schema.optional(Schema.Literals(["FUEL_EXHAUSTION", "BREAKDOWN", "DAMAGE"])),
      }),
    ),
  ),
});

const MonthlyReportUnrestSchema = Schema.Struct({
  before: nonNegativeInt,
  after: nonNegativeInt,
  changes: Schema.Array(Schema.Struct({ reasonCode: nonEmptyString, delta: int })),
  consequences: Schema.Array(
    Schema.Struct({
      consequence: Schema.Literals(["STRIKE", "REVOLUTION"]),
      careerEnded: Schema.Boolean,
    }),
  ),
});

const StrategicPrioritySchema = Schema.Struct({
  id: nonEmptyString,
  type: strategicPriorityTypeSchema,
  severity: prioritySeveritySchema,
  title: Schema.String,
  summary: Schema.String,
  advice: Schema.optional(Schema.String),
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
  presence: Schema.optional(MonthlyReportPresenceSchema),
  fleetExercise: Schema.optional(MonthlyReportFleetExerciseSchema),
  tradeProtection: Schema.optional(MonthlyReportTradeProtectionSchema),
  unrest: Schema.optional(MonthlyReportUnrestSchema),
});

export const MonthlyReportsSchema = Schema.Struct({
  reports: Schema.Array(MonthlyReportEntrySchema),
});
