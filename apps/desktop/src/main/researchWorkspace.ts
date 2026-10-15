import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandEnvelope, SetResearchPriorityCommand } from "@bluewave/commands";
import {
  clearPendingEnvelopes,
  clearPendingWorkspacesForTest,
  deletePendingEnvelope,
  fingerprintOfBody,
  lookupPendingEnvelope,
  pendingEnvelopesForExecution,
  queuePendingEnvelope,
} from "./pendingCommands.js";

/**
 * Research-priority facade over the shared per-session command queue
 * (desktop-diplomacy-war INC-2). The queue itself moved to
 * `pendingCommands.ts` (research + diplomacy now drain through ONE seam in
 * `commitMonth`); this module keeps the research slice's public API names and
 * behavior EXACTLY so the research tests pass unchanged where meaning
 * unchanged:
 *
 * - `queueResearchEnvelope` — `transportRequestId`-keyed enqueue; the payload
 *   fingerprint (canonical SHA-256 of the envelope body) is computed here,
 *   freeing the caller from per-family payload equality,
 * - `lookupQueuedResearchCommand` / `researchEnvelopesForExecution` /
 *   `clearResearchEnvelopes` / `clearResearchWorkspacesForTest` — unchanged
 *   semantics (replay vs `IDEMPOTENCY_CONFLICT`, drain-time hash refresh,
 *   post-success clear).
 *
 * Authority (spec D1) is unchanged: the desktop ONLY queues a real engine
 * envelope; `MonthExecutor`'s command_collection applies it at the next
 * `commitMonth`.
 */
export interface PendingResearchCommand {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<SetResearchPriorityCommand>;
  /** Canonical SHA-256 of `envelope.body` — the shared idempotency identity. */
  readonly payloadFingerprint: string;
}

export function queueResearchEnvelope(
  sessionId: string,
  pending: {
    readonly transportRequestId: string;
    readonly envelope: CommandEnvelope<SetResearchPriorityCommand>;
  },
): void {
  queuePendingEnvelope(sessionId, {
    transportRequestId: pending.transportRequestId,
    envelope: pending.envelope,
    payloadFingerprint: fingerprintOfBody(pending.envelope.body),
  });
}

export function lookupQueuedResearchCommand(
  sessionId: string,
  transportRequestId: string,
): PendingResearchCommand | undefined {
  const entry = lookupPendingEnvelope(sessionId, transportRequestId);
  if (entry === undefined) return undefined;
  return {
    transportRequestId: entry.transportRequestId,
    envelope: entry.envelope as CommandEnvelope<SetResearchPriorityCommand>,
    payloadFingerprint: entry.payloadFingerprint,
  };
}

/** The pending research envelopes for `sessionId` in issue order, with
 * `expectedSnapshotHash` refreshed against the snapshot the month will
 * execute on. Returns `[]` when nothing is queued (byte-identical to the
 * pre-queue pipeline; hashes unchanged). */
export function researchEnvelopesForExecution(
  sessionId: string,
  snapshot: CampaignSnapshot,
): CommandEnvelope<SetResearchPriorityCommand>[] {
  return pendingEnvelopesForExecution(
    sessionId,
    snapshot,
  ) as CommandEnvelope<SetResearchPriorityCommand>[];
}

/** Drop every drained envelope for `sessionId` — called by `commitMonth` only
 * AFTER a successful execute + save. */
export function clearResearchEnvelopes(sessionId: string): void {
  clearPendingEnvelopes(sessionId);
}

/** Test-only: clears every session's queue so test files don't leak state. */
export function clearResearchWorkspacesForTest(): void {
  clearPendingWorkspacesForTest();
}

export function deleteQueuedResearchCommand(sessionId: string, transportRequestId: string): void {
  deletePendingEnvelope(sessionId, transportRequestId);
}
