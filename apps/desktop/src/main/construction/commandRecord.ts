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

/**
 * The command-record lifecycle for one construction order: build the
 * optimistic-concurrency envelope, walk a fresh `CommandRecord` to ACCEPTED
 * through the machinery's permitted status chain, assign statuses with a
 * deterministic hash, and the campaign month key the record stores.
 *
 * Status transitions deliberately skip the wall-clock stamp: the machinery's
 * `transitionRecord()` helper bakes a non-deterministic
 * `new Date().toISOString()` into every `CommandStatusTransitionRecord`
 * (ENGINEERING-CONTRACT "Determinism"), so transitions here recompute only
 * the deterministic `commandHash` (see `withRecordStatus`) — an
 * accepted/transitioned record is timestamp-free and fully deterministic.
 */

/**
 * The optimistic-concurrency envelope for one work order. `expectedRevision`
 * is checked by the caller against `snapshot.turnNumber` before this runs;
 * it is still recorded on the body so the record hash pins the revision the
 * order was issued against.
 */
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

/** Build + walk a fresh `CommandRecord` to ACCEPTED through the permitted chain. */
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

/** The projected treasury amount a record reserved — read off its canonical
 * payload (written by `acceptConstructionRecord`), never recomputed. */
export function forecastCostOf(record: CommandRecord): number {
  const payload = record.canonicalPayload as { projectedCost?: number } | null;
  return typeof payload?.projectedCost === "number" ? payload.projectedCost : 0;
}

/** The projected capacity units a record reserved — see `forecastCostOf`. */
export function forecastCapacityUnitsOf(record: CommandRecord): number {
  const payload = record.canonicalPayload as { projectedCapacityUnits?: number } | null;
  return typeof payload?.projectedCapacityUnits === "number" ? payload.projectedCapacityUnits : 0;
}

/**
 * Walk SUBMITTED → VALIDATED → AUTHORIZED → RESERVED → ACCEPTED, verifying
 * every hop. Each hop goes through `withRecordStatus` (NOT the machinery's
 * `transitionRecord`, which stamps a wall-clock `new Date().toISOString()`
 * into the transition record) — the walked record stays timestamp-free and
 * whose hash is recomputed deterministically at every step.
 */
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

/**
 * Immutable status assignment + deterministic `commandHash` recomputation.
 * Deliberately no wall-clock timestamp (unlike the machinery's
 * `transitionRecord`), so the resulting record — and its hash — is fully
 * deterministic and timestamp-free.
 */
export function withRecordStatus(record: CommandRecord, status: CommandStatus): CommandRecord {
  const next: CommandRecord = { ...record, status };
  return { ...next, commandHash: hashCommandRecord(next) };
}
