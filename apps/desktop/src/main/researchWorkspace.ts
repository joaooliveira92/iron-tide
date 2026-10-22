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

export interface PendingResearchCommand {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<SetResearchPriorityCommand>;
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

export function researchEnvelopesForExecution(
  sessionId: string,
  snapshot: CampaignSnapshot,
): CommandEnvelope<SetResearchPriorityCommand>[] {
  return pendingEnvelopesForExecution(
    sessionId,
    snapshot,
  ) as CommandEnvelope<SetResearchPriorityCommand>[];
}

export function clearResearchEnvelopes(sessionId: string): void {
  clearPendingEnvelopes(sessionId);
}

export function clearResearchWorkspacesForTest(): void {
  clearPendingWorkspacesForTest();
}

export function deleteQueuedResearchCommand(sessionId: string, transportRequestId: string): void {
  deletePendingEnvelope(sessionId, transportRequestId);
}
