import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Result, Schema } from "effect";
import { getCampaignSession } from "./campaignSessions.js";

/**
 * Session-scoped queue of pending player command envelopes
 * (desktop-diplomacy-war INC-2). The desktop never mutates authoritative
 * snapshot state directly; every command family (research priorities,
 * diplomacy, future families) builds ONE real deterministic engine envelope
 * and queues it here, and the next `commitMonth` hands EVERY queued envelope
 * to `MonthExecutor.execute(snapshot, [...], seed)` where the engine's
 * command_collection phase applies them authoritatively (spec D1).
 *
 * Generalizes the research slice's `researchWorkspace.ts` (which is now a
 * thin facade over this module) so research + diplomacy share one drain seam.
 *
 * Conventions (identical to the research/construction slice):
 * - envelopes are keyed by the client's `transportRequestId`; re-issuing the
 *   same id with the same payload (same canonical body fingerprint) replays
 *   the prior outcome (no double-enqueue), while a different payload under
 *   the same id is an `IDEMPOTENCY_CONFLICT`;
 * - `expectedSnapshotHash` is pinned at issue time to the session snapshot;
 *   at drain time the hash is refreshed against the snapshot the month is
 *   about to execute on, so an interleaved persist (e.g. construction) cannot
 *   silently stale-out a queued command — the engine's `validate()` still
 *   demands the exact current hash (lifecycle.ts), and the refreshed envelope
 *   satisfies it.
 *
 * The queue is mirrored to `pending-commands.json` in the campaign's save
 * directory on every change, stamped with the turn it was issued for, so a
 * command the player was told is queued survives a restart: `loadCampaign`
 * restores it while that turn is still current (`restorePendingQueue`). A
 * file from an already-executed turn is discarded, never re-applied. Like
 * `ui-state.json` it sits outside the save envelope and hash; the engine
 * validates every restored envelope again when the month runs.
 */
export interface PendingCommandEntry {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<CommandBody>;
  /**
   * Deterministic identity of the queued payload — `sha256Hex` over
   * `canonicalSerialize(envelope.body)`. Used by the idempotency comparison
   * (same id + same fingerprint → replay; different payload → conflict) so
   * every command family shares one comparison instead of hand-rolling
   * per-family payload equality.
   */
  readonly payloadFingerprint: string;
}

const pendingBySession = new Map<string, Map<string, PendingCommandEntry>>();

function pendingFor(sessionId: string): Map<string, PendingCommandEntry> {
  const existing = pendingBySession.get(sessionId);
  if (existing) return existing;
  const created = new Map<string, PendingCommandEntry>();
  pendingBySession.set(sessionId, created);
  return created;
}

/** Deterministic fingerprint of an envelope body for idempotency comparison. */
export function fingerprintOfBody(body: CommandBody): string {
  return sha256Hex(canonicalSerialize(body));
}

export const PENDING_COMMANDS_FILENAME = "pending-commands.json";

const StoredQueueSchema = Schema.Struct({
  schema: Schema.Literal("pending_commands_v1"),
  turnNumber: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  entries: Schema.Array(
    Schema.Struct({
      transportRequestId: Schema.String.check(Schema.isMinLength(1)),
      envelope: Schema.Record(Schema.String, Schema.Unknown),
      payloadFingerprint: Schema.String.check(Schema.isMinLength(1)),
    }),
  ).check(Schema.isMaxLength(1000)),
});

/** Mirrors the session's queue to disk (removes the file when empty). A failed write never blocks the command. */
function persistQueue(sessionId: string): void {
  const record = getCampaignSession(sessionId);
  if (!record) return;
  const path = join(record.saveDir, PENDING_COMMANDS_FILENAME);
  const entries = [...(pendingBySession.get(sessionId)?.values() ?? [])];
  try {
    if (entries.length === 0) {
      rmSync(path, { force: true });
      return;
    }
    const tmp = `${path}.tmp`;
    writeFileSync(
      tmp,
      canonicalSerialize({
        schema: "pending_commands_v1",
        turnNumber: Number(record.state.snapshot.turnNumber),
        entries,
      }),
      "utf8",
    );
    renameSync(tmp, path);
  } catch {
    // The in-memory queue is still authoritative for this run; only restart durability is lost.
  }
}

/**
 * Puts back the commands queued for this campaign before a restart, if they were issued for the session's current
 * turn; a stale or malformed file is removed. Returns how many were restored.
 */
export function restorePendingQueue(sessionId: string): number {
  const record = getCampaignSession(sessionId);
  if (!record) return 0;
  const path = join(record.saveDir, PENDING_COMMANDS_FILENAME);
  if (!existsSync(path)) return 0;
  let parsed: typeof StoredQueueSchema.Type | null = null;
  try {
    const r = Schema.decodeUnknownResult(StoredQueueSchema)(JSON.parse(readFileSync(path, "utf8")));
    parsed = Result.isSuccess(r) ? r.success : null;
  } catch {
    parsed = null;
  }
  if (parsed === null || parsed.turnNumber !== Number(record.state.snapshot.turnNumber)) {
    try {
      rmSync(path, { force: true });
    } catch {
      // A read-only package cannot be cleaned up; the stale file is ignored again on the next open.
    }
    return 0;
  }
  const queue = pendingFor(sessionId);
  for (const e of parsed.entries)
    queue.set(e.transportRequestId, {
      transportRequestId: e.transportRequestId,
      // Accepted narrowing (ticket INC-3): `StoredQueueSchema` models the
      // envelope as `Record<string, unknown>`; the engine re-validates every
      // restored envelope at drain, so this nominal assertion is the boundary
      // seam, not a trust decision.
      envelope: e.envelope as unknown as CommandEnvelope<CommandBody>,
      payloadFingerprint: e.payloadFingerprint,
    });
  return parsed.entries.length;
}

export function queuePendingEnvelope(sessionId: string, entry: PendingCommandEntry): void {
  pendingFor(sessionId).set(entry.transportRequestId, entry);
  persistQueue(sessionId);
}

export function lookupPendingEnvelope(
  sessionId: string,
  transportRequestId: string,
): PendingCommandEntry | undefined {
  return pendingBySession.get(sessionId)?.get(transportRequestId);
}

/**
 * The pending envelopes for `sessionId` in issue order (Map insertion order —
 * deterministic FIFO, regardless of command family), with
 * `expectedSnapshotHash` refreshed against the snapshot the month will
 * execute on. Returns `[]` when nothing is queued, so a campaign that never
 * issues commands behaves byte-identically to the pre-queue pipeline (same
 * hashes).
 */
export function pendingEnvelopesForExecution(
  sessionId: string,
  snapshot: CampaignSnapshot,
): CommandEnvelope<CommandBody>[] {
  const pending = pendingBySession.get(sessionId);
  if (pending === undefined || pending.size === 0) return [];
  const executionHash = sha256Hex(canonicalSerialize(snapshot));
  return [...pending.values()].map((queued) => ({
    ...queued.envelope,
    expectedSnapshotHash: executionHash,
  }));
}

/** The queued entries for `sessionId` in issue order (no hash refresh; for listing/removal). */
export function pendingEntries(sessionId: string): PendingCommandEntry[] {
  return [...(pendingBySession.get(sessionId)?.values() ?? [])];
}

/** Drop every drained envelope for `sessionId` — called by `commitMonth` only
 * AFTER a successful execute + save (never on `MONTH_EXECUTION_FAILED` or
 * `SAVE_FAILED`; those leave the queue intact so a retry re-delivers). */
export function clearPendingEnvelopes(sessionId: string): void {
  pendingBySession.delete(sessionId);
  persistQueue(sessionId);
}

/** Remove a single queued envelope by transportRequestId — used to roll back
 * an autosave failure (INC-5: domain command not successful until persistence
 * succeeds). */
export function deletePendingEnvelope(sessionId: string, transportRequestId: string): void {
  const sessionQueue = pendingBySession.get(sessionId);
  if (!sessionQueue) return;
  sessionQueue.delete(transportRequestId);
  if (sessionQueue.size === 0) pendingBySession.delete(sessionId);
  persistQueue(sessionId);
}

/** Test-only: clears every session's queue so test files don't leak state. */
export function clearPendingWorkspacesForTest(): void {
  pendingBySession.clear();
}
