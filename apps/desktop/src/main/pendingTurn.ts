import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";
import { RecordedInputSchema, TurnPhaseSchema, type RecordedInput } from "@bluewave/messages";

export const PENDING_TURN_FILENAME = "pending-turn.json";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const ContentHashesSchema = Schema.Struct({
  shipBuilding: nonEmpty,
  armament: nonEmpty,
  contentArtifact: nonEmpty,
});

export const OutstandingRequestSchema = Schema.Struct({
  kind: Schema.Literals(["decision", "battle", "offer"]),
  phase: TurnPhaseSchema,
  ordinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  subjectKey: nonEmpty,
  acceptanceClass: Schema.optional(nonEmpty),
});

export const PendingTurnSchema = Schema.Struct({
  schemaVersion: nonEmpty,
  projectionVersion: nonEmpty,
  turnId: nonEmpty,
  campaignId: nonEmpty,
  playerNationId: nonEmpty,
  startingRevision: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  rulesetVersion: nonEmpty,
  compatibilityVersion: nonEmpty,
  contentHashes: ContentHashesSchema,
  committedOrderHash: nonEmpty,
  recordedInputs: Schema.Array(RecordedInputSchema),
  nextInterruptionOrdinal: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  createdAt: nonEmpty,
  outstanding: Schema.optional(OutstandingRequestSchema),
});
export type PendingTurnRecord = typeof PendingTurnSchema.Type;

function createAbortError(): Error {
  const error = new Error("Pending-turn write was cancelled");
  error.name = "AbortError";
  return error;
}

export function loadPendingTurn(saveDir: string): PendingTurnRecord | null {
  const path = join(saveDir, PENDING_TURN_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed = Schema.decodeUnknownResult(PendingTurnSchema, {
      onExcessProperty: "error",
    })(JSON.parse(readFileSync(path, "utf8")));
    if (Result.isFailure(parsed)) return null;
    return parsed.success;
  } catch {
    return null;
  }
}

export function savePendingTurn(
  saveDir: string,
  record: PendingTurnRecord,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) throw createAbortError();
  const path = join(saveDir, PENDING_TURN_FILENAME);
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

export function clearPendingTurn(saveDir: string): void {
  rmSync(join(saveDir, PENDING_TURN_FILENAME), { force: true });
}

export function isPendingTurnValid(
  record: PendingTurnRecord,
  expected: {
    readonly campaignId: string;
    readonly startingRevision: number;
    readonly rulesetVersion: string;
    readonly compatibilityVersion: string;
    readonly turnId: string;
  },
): boolean {
  return (
    record.campaignId === expected.campaignId &&
    record.startingRevision === expected.startingRevision &&
    record.rulesetVersion === expected.rulesetVersion &&
    record.compatibilityVersion === expected.compatibilityVersion &&
    record.turnId === expected.turnId
  );
}

export function buildPendingTurn(input: {
  readonly projectionVersion: string;
  readonly turnId: string;
  readonly campaignId: string;
  readonly playerNationId: string;
  readonly startingRevision: number;
  readonly rulesetVersion: string;
  readonly compatibilityVersion: string;
  readonly contentHashes: PendingTurnRecord["contentHashes"];
  readonly committedOrderHash: string;
  readonly recordedInputs: readonly RecordedInput[];
  readonly nextInterruptionOrdinal: number;
  readonly createdAt: string;
  readonly outstanding?: PendingTurnRecord["outstanding"];
}): PendingTurnRecord {
  return { schemaVersion: "1.0.0", ...input };
}
