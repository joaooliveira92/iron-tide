import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Result, Schema } from "effect";
import { playerVisibleMessages, projectTurnMessages, TurnMessageSchema } from "@bluewave/messages";
import type {
  ReadTurnSummariesResult,
  TurnSummaryEntry,
  TurnSummaries,
} from "../shared/campaign-command-contract.js";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { SessionIdPayloadSchema } from "./campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { withSchema } from "./runtime/commandProgram.js";
import { TurnSummariesStore } from "./runtime/sidecarStores.js";

/**
 * The per-campaign turn-summary history sidecar (spec: `turn-summaries.json`).
 * Main appends one `TurnSummaryEntry` per resolved turn/per successful
 * `commitMonth`, pruning to the most recent {@link TURN_SUMMARIES_LIMIT}. It is
 * **never authoritative**: a sibling of the campaign's save ids (not inside a
 * `SaveStore` save id), never part of the envelope/hash, never read by
 * `MonthExecutor`. Missing/corrupt reads as empty; a save with no sidecar loads
 * normally. Missing summaries are rebuildable by replay.
 */
export const TURN_SUMMARIES_FILENAME = "turn-summaries.json";

/** The most recent turn summaries kept (mirrors the monthly-report window). */
export const TURN_SUMMARIES_LIMIT = 12;

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const TurnSummaryEntrySchema = Schema.Struct({
  turnId: nonEmpty,
  projectionVersion: nonEmpty,
  occurredAt: nonEmpty,
  rulesetVersion: nonEmpty,
  contentVersion: nonEmpty,
  messages: Schema.Array(TurnMessageSchema),
});

const TurnSummariesSchema = Schema.Struct({
  summaries: Schema.Array(TurnSummaryEntrySchema),
});

function createAbortError(): Error {
  const error = new Error("Turn-summary write was cancelled");
  error.name = "AbortError";
  return error;
}

export function emptyTurnSummaries(): TurnSummaries {
  return { summaries: [] };
}

/** Tolerant read: missing/corrupt -> empty, never crashes. */
export function loadTurnSummaries(saveDir: string): TurnSummaries {
  const path = join(saveDir, TURN_SUMMARIES_FILENAME);
  if (!existsSync(path)) return emptyTurnSummaries();
  try {
    const parsed = Schema.decodeUnknownResult(TurnSummariesSchema)(
      JSON.parse(readFileSync(path, "utf8")),
    );
    if (Result.isFailure(parsed)) return emptyTurnSummaries();
    return parsed.success;
  } catch {
    return emptyTurnSummaries();
  }
}

/** Atomic write (tmp file -> rename); a failed write removes the tmp artifact. */
export function saveTurnSummaries(
  saveDir: string,
  data: TurnSummaries,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) throw createAbortError();
  const path = join(saveDir, TURN_SUMMARIES_FILENAME);
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

/** Prepend the newest summary and prune to the limit. */
export function appendTurnSummary(data: TurnSummaries, summary: TurnSummaryEntry): TurnSummaries {
  const withoutDuplicate = data.summaries.filter((entry) => entry.turnId !== summary.turnId);
  return { summaries: [summary, ...withoutDuplicate].slice(0, TURN_SUMMARIES_LIMIT) };
}

/**
 * Project a resolved turn's authoritative domain events into a player-visible
 * summary entry (a pure post-turn function, never an authoritative phase).
 */
export function buildTurnSummary(input: {
  readonly turnId: string;
  readonly events: readonly DomainEventEnvelope[];
  readonly snapshot: CampaignSnapshot;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
}): TurnSummaryEntry {
  const messages = playerVisibleMessages(
    projectTurnMessages({
      turnId: input.turnId,
      events: input.events,
      snapshot: input.snapshot,
      rulesetVersion: input.rulesetVersion,
      contentVersion: input.contentVersion,
    }),
  );
  const first = messages[0];
  return {
    turnId: input.turnId,
    projectionVersion: first?.debugMetadata?.projectionVersion ?? "1.0.0",
    occurredAt: first?.occurredAt ?? "",
    rulesetVersion: input.rulesetVersion,
    contentVersion: input.contentVersion,
    messages,
  };
}

/**
 * `readTurnSummaries(sessionId) -> { summaries }` as an Effect command program
 * (ADR-0159). Reads the session's sidecar through `TurnSummariesStore`,
 * tolerantly. Main is the only writer.
 */
export const readTurnSummariesProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    const store = yield* TurnSummariesStore;
    const data = yield* store.load(record.saveDir);
    const value: ReadTurnSummariesResult = { summaries: data.summaries };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);
