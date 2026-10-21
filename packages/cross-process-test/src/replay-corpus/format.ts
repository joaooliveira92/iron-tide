import { Data, Result, Schema, SchemaIssue } from "effect";

/** The only replay file format this build understands; an unknown version is rejected, never guessed at. */
export const REPLAY_FORMAT_VERSION = 1;

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

const MonthCheckpoint = Schema.Struct({
  turnNumber: Count,
  /** v1 command streams are empty; a non-empty stream needs a format version bump. */
  commands: Schema.Array(Schema.Never),
  snapshotHash: Hash,
  ledgers: Schema.Struct({
    command: LedgerCheckpoint,
    event: LedgerCheckpoint,
    financial: LedgerCheckpoint,
    random: LedgerCheckpoint,
  }),
});

export const ReplayFileSchema = Schema.Struct({
  formatVersion: Schema.Literal(REPLAY_FORMAT_VERSION),
  scenarioId: Schema.String,
  rulesetVersion: Schema.String,
  compatibilityVersion: Schema.String,
  seed: Schema.String,
  /** Body hash of the compiled production bundle; the bundle itself is not embedded. */
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

/** The file is unreadable, foreign, or from a format version this build does not know. */
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
    if (version !== REPLAY_FORMAT_VERSION) {
      return Result.fail(
        new ReplayFileError({
          message: `Unsupported replay format version ${JSON.stringify(version)}; this build reads version ${String(REPLAY_FORMAT_VERSION)}`,
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
  return Result.succeed(decoded.success);
}
