import type { CampaignSessionRecord } from "../campaignSessions.js";

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

export function deterministicTimestamp(record: CampaignSessionRecord): string {
  const daysOffset = ((Number(record.state.snapshot.turnNumber) % 365) + 365) % 365;
  const ms = Date.UTC(1910, 0, 1) + daysOffset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
