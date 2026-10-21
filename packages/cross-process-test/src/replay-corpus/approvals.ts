import { canonicalSerialize, hashWithContext } from "@bluewave/deterministic";
import { readsAsBroadApproval } from "@bluewave/ship-design";
import { Data, Result, Schema, SchemaIssue } from "effect";

import { decodeReplayFile, type ReplayFile } from "./format.js";

/**
 * Hash-bound approvals for intended replay-corpus change (ADR-0246 decision 5).
 *
 * An entry binds one replay and month to the exact old and new checkpoint hashes. It is
 * consumed by the change it was written for: the file is append-only, so an entry already
 * present on the base side can never cover a later delta, and an entry that covers no delta
 * is orphaned. Prior art: the ship-part approved-diffs gate, whose "reads as a broad
 * approval" test is shared rather than copied.
 */
export const REPLAY_APPROVALS_SCHEMA = "replay-approvals/1";

/** Stands for a month that does not exist on one side of a diff. */
const ABSENT = "absent";

const CHECKPOINT_CONTEXT = "bluewave/replay-corpus/month-checkpoint/v1";

const Hash = Schema.String.check(Schema.isPattern(/^(?:[0-9a-f]{64}|absent)$/));

const Text = Schema.String.check(
  Schema.makeFilter((text) =>
    text.trim() === ""
      ? "must not be empty"
      : readsAsBroadApproval(text)
        ? "reads as a broad approval or pattern"
        : undefined,
  ),
);

const ApprovalEntrySchema = Schema.Struct({
  id: Text,
  replayId: Text,
  month: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  oldHash: Hash,
  newHash: Hash,
  cause: Text,
  migrationAssessment: Text,
}).check(
  Schema.makeFilter((entry) =>
    entry.oldHash === entry.newHash ? "oldHash and newHash must differ" : undefined,
  ),
);

const ApprovalsFileSchema = Schema.Struct({
  schema: Schema.Literal(REPLAY_APPROVALS_SCHEMA),
  entries: Schema.Array(ApprovalEntrySchema),
}).check(
  Schema.makeFilter((file) => {
    const ids = new Set<string>();
    for (const entry of file.entries) {
      if (ids.has(entry.id)) return `duplicate approval id ${entry.id}`;
      ids.add(entry.id);
    }
    return undefined;
  }),
);

export type ApprovalEntry = typeof ApprovalEntrySchema.Type;
export type ApprovalsFile = typeof ApprovalsFileSchema.Type;

/** The approvals file or a replay file in the corpus could not be read. */
export class ApprovalsError extends Data.TaggedError("ApprovalsError")<{
  readonly message: string;
}> {}

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
const decodeApprovalsFile = Schema.decodeUnknownResult(ApprovalsFileSchema, parseOptions);

function decodeApprovals(text: string | undefined): Result.Result<ApprovalsFile, ApprovalsError> {
  if (text === undefined) return Result.succeed({ schema: REPLAY_APPROVALS_SCHEMA, entries: [] });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Result.fail(new ApprovalsError({ message: "Replay approvals file is not valid JSON" }));
  }
  const decoded = decodeApprovalsFile(raw);
  if (Result.isFailure(decoded)) {
    const issues = formatter(decoded.failure.issue).issues.map((issue) => {
      const path = (issue.path ?? []).map(String).join(".");
      return `${path === "" ? "(root)" : path}: ${issue.message}`;
    });
    return Result.fail(
      new ApprovalsError({
        message: `Replay approvals file failed validation: ${issues.join("; ")}`,
      }),
    );
  }
  return Result.succeed(decoded.success);
}

/** The committed corpus on one side of a diff: replay file text by file name, and the approvals text. */
export interface CorpusState {
  readonly replays: ReadonlyMap<string, string>;
  readonly approvals?: string;
}

/** Hash of one month's whole checkpoint: snapshot and every ledger entry. */
export function checkpointHash(month: ReplayFile["months"][number]): string {
  return hashWithContext(canonicalSerialize(month), CHECKPOINT_CONTEXT);
}

function decodeCorpus(
  state: CorpusState,
  side: string,
): Result.Result<ReadonlyMap<string, ReplayFile>, ApprovalsError> {
  const files = new Map<string, ReplayFile>();
  for (const [name, text] of [...state.replays].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const decoded = decodeReplayFile(text);
    if (Result.isFailure(decoded)) {
      return Result.fail(
        new ApprovalsError({ message: `${side} replay ${name}: ${decoded.failure.message}` }),
      );
    }
    if (files.has(decoded.success.scenarioId)) {
      return Result.fail(
        new ApprovalsError({
          message: `${side} replay ${name}: duplicate scenario id ${decoded.success.scenarioId}`,
        }),
      );
    }
    files.set(decoded.success.scenarioId, decoded.success);
  }
  return Result.succeed(files);
}

interface Delta {
  readonly replayId: string;
  readonly month: number;
  readonly oldHash: string;
  readonly newHash: string;
}

/**
 * Months of a base replay whose checkpoint changed or vanished. A replay or month that only
 * exists on the head side is an addition, proven by `verifyReplay` rather than approved here.
 */
function corpusDeltas(
  base: ReadonlyMap<string, ReplayFile>,
  head: ReadonlyMap<string, ReplayFile>,
): Delta[] {
  const deltas: Delta[] = [];
  for (const [replayId, before] of base) {
    const after = head.get(replayId);
    for (const [index, month] of before.months.entries()) {
      const oldHash = checkpointHash(month);
      const next = after?.months[index];
      const newHash = next === undefined ? ABSENT : checkpointHash(next);
      if (oldHash !== newHash) deltas.push({ replayId, month: index + 1, oldHash, newHash });
    }
  }
  return deltas;
}

const keyOf = (e: Pick<ApprovalEntry, "replayId" | "month" | "oldHash" | "newHash">): string =>
  `${e.replayId}\u0000${String(e.month)}\u0000${e.oldHash}\u0000${e.newHash}`;

export type ApprovalFailure = {
  readonly _tag:
    | "UnapprovedDelta"
    | "HashMismatch"
    | "OrphanedApproval"
    | "ReusedApproval"
    | "RewrittenApproval";
  readonly replayId: string;
  readonly month: number;
  readonly detail: string;
};

export interface ApprovalCheck {
  readonly ok: boolean;
  readonly failures: readonly ApprovalFailure[];
}

/** Render failures as stable LF text with no paths or timestamps. */
export function formatApprovalFailures(failures: readonly ApprovalFailure[]): string {
  return failures
    .map((f) => `${f._tag} ${f.replayId} month ${String(f.month)}: ${f.detail}\n`)
    .join("");
}

const short = (hash: string): string => hash.slice(0, 12);

/**
 * Judge the corpus delta from `base` to `head` against the head approvals file. Pure: the
 * caller supplies both sides, so CI only verifies and never writes.
 */
export function checkReplayApprovals(
  base: CorpusState,
  head: CorpusState,
): Result.Result<ApprovalCheck, ApprovalsError> {
  const baseCorpus = decodeCorpus(base, "base");
  if (Result.isFailure(baseCorpus)) return Result.fail(baseCorpus.failure);
  const headCorpus = decodeCorpus(head, "head");
  if (Result.isFailure(headCorpus)) return Result.fail(headCorpus.failure);
  const baseApprovals = decodeApprovals(base.approvals);
  if (Result.isFailure(baseApprovals)) return Result.fail(baseApprovals.failure);
  const headApprovals = decodeApprovals(head.approvals);
  if (Result.isFailure(headApprovals)) return Result.fail(headApprovals.failure);

  const failures: ApprovalFailure[] = [];
  const headById = new Map(headApprovals.success.entries.map((e) => [e.id, e]));
  const consumedKeys = new Set<string>();
  for (const entry of baseApprovals.success.entries) {
    consumedKeys.add(keyOf(entry));
    const now = headById.get(entry.id);
    if (now === undefined || canonicalSerialize(now) !== canonicalSerialize(entry)) {
      failures.push({
        _tag: "RewrittenApproval",
        replayId: entry.replayId,
        month: entry.month,
        detail: `consumed approval ${entry.id} was ${now === undefined ? "removed" : "edited"}; approvals are append-only`,
      });
    }
  }

  const baseIds = new Set(baseApprovals.success.entries.map((e) => e.id));
  const fresh = headApprovals.success.entries.filter((e) => !baseIds.has(e.id));
  const seen = new Set(consumedKeys);
  const candidates: ApprovalEntry[] = [];
  const handled = new Set<string>();
  for (const entry of fresh) {
    const key = keyOf(entry);
    if (seen.has(key)) {
      failures.push({
        _tag: "ReusedApproval",
        replayId: entry.replayId,
        month: entry.month,
        detail: `${entry.id} repeats the hashes of an approval that is already consumed`,
      });
      handled.add(key);
      continue;
    }
    seen.add(key);
    candidates.push(entry);
  }

  const used = new Set<ApprovalEntry>();
  const deltas = corpusDeltas(baseCorpus.success, headCorpus.success);
  for (const delta of deltas) {
    const key = keyOf(delta);
    const exact = candidates.find((e) => keyOf(e) === key);
    if (exact !== undefined) {
      used.add(exact);
      continue;
    }
    if (handled.has(key)) continue;
    if (consumedKeys.has(key)) {
      failures.push({
        _tag: "ReusedApproval",
        replayId: delta.replayId,
        month: delta.month,
        detail: `${short(delta.oldHash)} -> ${short(delta.newHash)} was approved before and that approval is consumed`,
      });
      continue;
    }
    const near = candidates.filter((e) => e.replayId === delta.replayId && e.month === delta.month);
    if (near.length > 0) {
      for (const entry of near) used.add(entry);
      failures.push({
        _tag: "HashMismatch",
        replayId: delta.replayId,
        month: delta.month,
        detail: `actual ${short(delta.oldHash)} -> ${short(delta.newHash)}, approval ${near.map((e) => `${e.id} says ${short(e.oldHash)} -> ${short(e.newHash)}`).join("; ")}`,
      });
      continue;
    }
    failures.push({
      _tag: "UnapprovedDelta",
      replayId: delta.replayId,
      month: delta.month,
      detail: `checkpoint moved ${short(delta.oldHash)} -> ${short(delta.newHash)} without an approval`,
    });
  }
  for (const entry of candidates) {
    if (used.has(entry)) continue;
    failures.push({
      _tag: "OrphanedApproval",
      replayId: entry.replayId,
      month: entry.month,
      detail: `${entry.id} matches no corpus delta`,
    });
  }
  return Result.succeed({ ok: failures.length === 0, failures });
}

export interface ProposalInput {
  readonly cause: string;
  readonly migrationAssessment: string;
}

/**
 * Local tool: the head approvals text with one new entry per delta that has none yet, built
 * from the actual diff. The result is validated through the same strict decode as the guard.
 */
export function proposeApprovals(
  base: CorpusState,
  head: CorpusState,
  input: ProposalInput,
): Result.Result<string, ApprovalsError> {
  const baseCorpus = decodeCorpus(base, "base");
  if (Result.isFailure(baseCorpus)) return Result.fail(baseCorpus.failure);
  const headCorpus = decodeCorpus(head, "head");
  if (Result.isFailure(headCorpus)) return Result.fail(headCorpus.failure);
  const existing = decodeApprovals(head.approvals);
  if (Result.isFailure(existing)) return Result.fail(existing.failure);
  const covered = new Set(existing.success.entries.map(keyOf));
  const added: ApprovalEntry[] = corpusDeltas(baseCorpus.success, headCorpus.success)
    .filter((delta) => !covered.has(keyOf(delta)))
    .map((delta) => ({
      id: `${delta.replayId}:m${String(delta.month)}:${short(delta.oldHash)}->${short(delta.newHash)}`,
      ...delta,
      cause: input.cause,
      migrationAssessment: input.migrationAssessment,
    }));
  const text = `${canonicalSerialize({
    schema: REPLAY_APPROVALS_SCHEMA,
    entries: [...existing.success.entries, ...added],
  })}\n`;
  const checked = decodeApprovals(text);
  return Result.isFailure(checked) ? Result.fail(checked.failure) : Result.succeed(text);
}
