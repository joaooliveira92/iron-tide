import { Data, Result, Schema, SchemaIssue } from "effect";

export const REPLAY_FORMAT_VERSION = 2;
export const SUPPORTED_REPLAY_FORMAT_VERSIONS = [1, 2] as const;

const Hash = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const LedgerCheckpoint = Schema.Struct({
  count: Count,
  entryHashes: Schema.Array(Hash),
}).check(
  Schema.makeFilter((ledger) =>
    ledger.count === ledger.entryHashes.length
      ? undefined
      : `count ${String(ledger.count)} must equal the number of entry hashes ${String(ledger.entryHashes.length)}`,
  ),
);

const Id = Schema.NonEmptyString;
const Money = Schema.Int;

const SetBudgetAllocationBody = Schema.Struct({
  type: Schema.Literal("SetBudgetAllocation"),
  nationId: Id,
  appropriationRateBp: Money,
  researchBudget: Money,
});

const SetResearchPriorityBody = Schema.Struct({
  type: Schema.Literal("SetResearchPriority"),
  nationId: Id,
  fieldPriorities: Schema.Record(Schema.String, Money),
  exactTechId: Schema.optional(Id),
});

const OrderConstructionBody = Schema.Struct({
  type: Schema.Literal("OrderConstruction"),
  nationId: Id,
  designVersionId: Id,
  quantity: Schema.Int,
});

const SetShipReadinessBody = Schema.Struct({
  type: Schema.Literal("SetShipReadiness"),
  nationId: Id,
  shipIds: Schema.Array(Id),
  readiness: Schema.Literals(["ACTIVE", "RESERVE", "MOTHBALLED"]),
});

const AssignForeignStationBody = Schema.Struct({
  type: Schema.Literal("AssignForeignStation"),
  nationId: Id,
  shipIds: Schema.Array(Id),
});

const ClearForeignStationBody = Schema.Struct({
  type: Schema.Literal("ClearForeignStation"),
  nationId: Id,
  shipIds: Schema.Array(Id),
});

export const ReplayCommandBodySchema = Schema.Union([
  SetBudgetAllocationBody,
  SetResearchPriorityBody,
  OrderConstructionBody,
  SetShipReadinessBody,
  AssignForeignStationBody,
  ClearForeignStationBody,
]);

export const ReplayCommandEnvelopeSchema = Schema.Struct({
  commandId: Id,
  version: Id,
  expectedSnapshotHash: Hash,
  idempotencyKey: Id,
  timestamp: Schema.String,
  body: ReplayCommandBodySchema,
});

export type ReplayCommandEnvelope = typeof ReplayCommandEnvelopeSchema.Type;

const MonthCheckpoint = Schema.Struct({
  turnNumber: Count,
  commands: Schema.Array(ReplayCommandEnvelopeSchema),
  snapshotHash: Hash,
  ledgers: Schema.Struct({
    command: LedgerCheckpoint,
    event: LedgerCheckpoint,
    financial: LedgerCheckpoint,
    random: LedgerCheckpoint,
  }),
});

export const ReplayFileSchema = Schema.Struct({
  formatVersion: Schema.Literals(SUPPORTED_REPLAY_FORMAT_VERSIONS),
  scenarioId: Schema.String,
  rulesetVersion: Schema.String,
  compatibilityVersion: Schema.String,
  seed: Schema.String,
  contentHash: Hash,
  initial: Schema.Struct({
    kind: Schema.Literal("production-pack"),
    pack: Schema.String,
    snapshotHash: Hash,
  }),
  engineOptions: Schema.Struct({ kind: Schema.Literal("default") }),
  months: Schema.Array(MonthCheckpoint),
});

export type ReplayFile = typeof ReplayFileSchema.Type;
export type LedgerName = keyof ReplayFile["months"][number]["ledgers"];

export class ReplayFileError extends Data.TaggedError("ReplayFileError")<{
  readonly message: string;
}> {}

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
const decodeFile = Schema.decodeUnknownResult(ReplayFileSchema, parseOptions);

export function decodeReplayFile(text: string): Result.Result<ReplayFile, ReplayFileError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Result.fail(new ReplayFileError({ message: "Replay file is not valid JSON" }));
  }
  if (typeof raw === "object" && raw !== null && "formatVersion" in raw) {
    const version = raw.formatVersion;
    if (!(SUPPORTED_REPLAY_FORMAT_VERSIONS as readonly unknown[]).includes(version)) {
      return Result.fail(
        new ReplayFileError({
          message: `Unsupported replay format version ${JSON.stringify(version)}; this build reads versions ${SUPPORTED_REPLAY_FORMAT_VERSIONS.join(", ")}`,
        }),
      );
    }
  }
  const decoded = decodeFile(raw);
  if (Result.isFailure(decoded)) {
    const issues = formatter(decoded.failure.issue).issues.map((issue) => {
      const path = (issue.path ?? []).map(String).join(".");
      return `${path === "" ? "(root)" : path}: ${issue.message}`;
    });
    return Result.fail(
      new ReplayFileError({ message: `Replay file failed validation: ${issues.join("; ")}` }),
    );
  }
  if (
    decoded.success.formatVersion === 1 &&
    decoded.success.months.some((m) => m.commands.length > 0)
  ) {
    return Result.fail(
      new ReplayFileError({
        message:
          "Replay file failed validation: months.commands: format version 1 records no commands",
      }),
    );
  }
  return Result.succeed(decoded.success);
}
