import type { CampaignSessionRecord } from "../campaignSessions.js";

/**
 * The desktop's shared optimistic-concurrency envelope contract: check
 * `expectedRevision` against the resolved session's snapshot `turnNumber`, and
 * expose the deterministic UTC timestamp every player envelope uses.
 *
 * This is the single source for the `REVISION_MISMATCH` posture shared by every
 * command module (construction, research, fleet, and the queued player commands
 * in `playerCommandSupport.ts`). The session itself is resolved through
 * `CampaignSessionStore` by the caller; a missing session is the store's
 * `SessionNotFound` failure (projected to `SESSION_NOT_FOUND`), never read from
 * the module singleton here.
 */
export type EnvelopeVerification =
  | { outcome: "success"; record: CampaignSessionRecord }
  | {
      outcome: "rejected";
      reason: string;
      diagnostics: readonly string[];
      currentRevision?: number;
    };

export function currentRevision(record: CampaignSessionRecord): number {
  return Number(record.state.snapshot.turnNumber);
}

export function verifyEnvelope(
  record: CampaignSessionRecord,
  expectedRevision: number,
): EnvelopeVerification {
  const current = currentRevision(record);
  if (expectedRevision !== current) {
    return {
      outcome: "rejected",
      reason: "REVISION_MISMATCH",
      diagnostics: [
        `Expected revision ${expectedRevision} but session ${record.sessionId} is at revision ${current}`,
      ],
      currentRevision: current,
    };
  }
  return { outcome: "success", record };
}

/** Pure integer arithmetic (UTC), identical to `AiCommandGenerator`'s
 * deterministic timestamp: turn 0 → 1910-01-01T00:00:00.000Z, one day per
 * turn number (no wall clock, no locale). */
export function deterministicTimestamp(record: CampaignSessionRecord): string {
  const daysOffset = ((Number(record.state.snapshot.turnNumber) % 365) + 365) % 365;
  const ms = Date.UTC(1910, 0, 1) + daysOffset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
