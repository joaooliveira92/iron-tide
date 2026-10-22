import {
  canTransition,
  createCommandRecord,
  hashCommandRecord,
  type CommandBody,
  type CommandEnvelope,
  type CommandRecord,
  type CommandStatus,
} from "@bluewave/commands";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { CONSTRUCTION_COMMAND_DEFINITION } from "./commandDefinition.js";
import type { ConstructionWorkspace } from "./workspaceState.js";

export function toWorkEnvelope(
  workspace: ConstructionWorkspace,
  commandId: string,
  transportRequestId: string,
  expectedRevision: number,
  nationId: string,
  designId: string,
  projectedCost: number,
  projectedCapacityUnits: number,
  snapshotHash: string,
): CommandEnvelope<CommandBody> {
  return {
    commandId,
    version: "0.1.0",
    expectedSnapshotHash: snapshotHash,
    idempotencyKey: transportRequestId,
    timestamp: `${workspace.sessionId}:${commandId}`,
    body: {
      type: "construction_order",
      nationId,
      designId,
      expectedRevision,
      transportRequestId,
      projectedCost,
      projectedCapacityUnits,
    } as unknown as CommandBody,
  };
}

export function acceptConstructionRecord(
  workspace: ConstructionWorkspace,
  record: CampaignSessionRecord,
  commandId: string,
  transportRequestId: string,
  expectedRevision: number,
  designId: string,
  projectedCost: number,
  projectedCapacityUnits: number,
): CommandRecord {
  const snapshot = record.state.snapshot;
  const envelope = toWorkEnvelope(
    workspace,
    commandId,
    transportRequestId,
    expectedRevision,
    record.playerSlotId,
    designId,
    projectedCost,
    projectedCapacityUnits,
    record.state.rawHash,
  );
  const created = createCommandRecord(
    envelope,
    CONSTRUCTION_COMMAND_DEFINITION,
    snapshot.campaignId,
    campaignMonthKey(record),
    "PLAYER",
    record.playerSlotId,
    record.playerSlotId,
    CONSTRUCTION_COMMAND_DEFINITION.submissionPhaseId,
    workspace.nextSubmissionOrdinal(),
    record.state.rawHash,
  );
  return walkToAccepted(created);
}

export function campaignMonthKey(record: CampaignSessionRecord): string {
  return `${String(record.month.year)}-${String(record.month.month).padStart(2, "0")}`;
}

export function forecastCostOf(record: CommandRecord): number {
  const payload = record.canonicalPayload as { projectedCost?: number } | null;
  return typeof payload?.projectedCost === "number" ? payload.projectedCost : 0;
}

export function forecastCapacityUnitsOf(record: CommandRecord): number {
  const payload = record.canonicalPayload as { projectedCapacityUnits?: number } | null;
  return typeof payload?.projectedCapacityUnits === "number" ? payload.projectedCapacityUnits : 0;
}

function walkToAccepted(record: CommandRecord): CommandRecord {
  const chain: CommandStatus[] = ["VALIDATED", "AUTHORIZED", "RESERVED", "ACCEPTED"];
  let current: CommandRecord = record;
  for (const next of chain) {
    if (!canTransition(current.status, next)) {
      throw Object.assign(
        new Error(`INVALID_COMMAND_STATUS_TRANSITION: ${current.status} -> ${next}`),
        { code: "INVALID_COMMAND_STATUS_TRANSITION" },
      );
    }
    current = withRecordStatus(current, next);
  }
  return current;
}

export function withRecordStatus(record: CommandRecord, status: CommandStatus): CommandRecord {
  const next: CommandRecord = { ...record, status };
  return { ...next, commandHash: hashCommandRecord(next) };
}
