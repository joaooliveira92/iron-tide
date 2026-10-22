import {
  buildConstructionDesignCatalog,
  type ConstructionCommandStatus,
} from "@bluewave/campaign-engine";
import {
  constructionProjectQueueWithReadouts,
  previewConstructionBatch,
  previewForeignConstruction,
} from "@bluewave/phase-engine";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  ConstructionBatchPreviewOutcome,
  ConstructionCommandOutcome,
  ConstructionScreenProjection,
  ForeignConstructionPreviewOutcome,
} from "../../shared/construction-contract.js";
import { CONSTRUCTION_SETTLEMENT_BRANCH_ID } from "../construction/commandDefinition.js";
import { constructionEconomy } from "../construction/economy.js";
import {
  acceptConstructionRecord,
  campaignMonthKey,
  forecastCostOf,
  withRecordStatus,
} from "../construction/commandRecord.js";
import { settleAndRelease } from "../construction/settlement.js";
import { workspaceView } from "../construction/view.js";
import type { ConstructionWorkspace } from "../construction/workspaceState.js";
import {
  CancelConstructionOrderPayloadSchema,
  ConstructionOrderPayloadSchema,
  PreviewConstructionBatchCommandPayloadSchema,
  PreviewForeignConstructionCommandPayloadSchema,
  ReplaceConstructionOrderPayloadSchema,
  SessionIdPayloadSchema,
} from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { verifyEnvelope } from "./commandEnvelope.js";
import { deriveConstructionCommandId } from "./construction/command-id.js";
import { isTerminal, uiStatusFor } from "./construction/command-status.js";
import { resolveUiDesign, toUiCommand } from "./construction/command-view.js";
import { placeOrderFor } from "./construction/design-validation.js";
import { replayIdempotent } from "./construction/idempotency.js";
import {
  canReserveReplacement,
  reserveForOrder,
  restoreInFlight,
} from "./construction/reservations.js";
import { removeProjectForCommand } from "./construction/snapshot-mutations.js";

export const inspectConstructionScreenProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const contentArtifact = yield* ContentArtifact;
    const record = yield* sessions.get(sessionId);
    const workspace = yield* sessions.getConstructionWorkspace(record);
    const content = yield* contentArtifact.loadShipBuildingContent();

    const projection: ConstructionScreenProjection = {
      revision: Number(record.state.snapshot.turnNumber),
      month: record.month,
      economy: constructionEconomy(record),
      designs: buildConstructionDesignCatalog(
        record.state.snapshot,
        record.playerSlotId,
        record.month.year,
      ),
      projects: constructionProjectQueueWithReadouts(
        record.state.snapshot,
        record.playerSlotId,
        content,
        campaignMonthKey(record),
      ),
      workspace: workspaceView(workspace),
    };

    return { outcome: "success" as const, value: projection, diagnostics: [] };
  }),
);

export const previewConstructionBatchCommandProgram = withSchema(
  PreviewConstructionBatchCommandPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const contentArtifact = yield* ContentArtifact;
      const record = yield* sessions.get(payload.sessionId);
      const content = yield* contentArtifact.loadShipBuildingContent();
      const value: ConstructionBatchPreviewOutcome = previewConstructionBatch(
        record.state.snapshot,
        record.playerSlotId,
        payload.designVersionId,
        payload.quantity,
        content,
        campaignMonthKey(record),
      );
      return { outcome: "success" as const, value, diagnostics: [] };
    }),
);

export const previewForeignConstructionCommandProgram = withSchema(
  PreviewForeignConstructionCommandPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const contentArtifact = yield* ContentArtifact;
      const record = yield* sessions.get(payload.sessionId);
      const content = yield* contentArtifact.loadShipBuildingContent();
      const value: ForeignConstructionPreviewOutcome = previewForeignConstruction(
        record.state.snapshot,
        record.playerSlotId,
        payload.designVersionId,
        payload.quantity,
        content,
        campaignMonthKey(record),
        {
          ...(payload.builderNationId === undefined
            ? {}
            : { builderNationId: payload.builderNationId }),
          ...(payload.plannedDeliveryMonth === undefined
            ? {}
            : { plannedDeliveryMonth: payload.plannedDeliveryMonth }),
        },
      );
      return { outcome: "success" as const, value, diagnostics: [] };
    }),
);

export const submitConstructionCommandProgram = withSchema(
  ConstructionOrderPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const projects = yield* ProjectStore;
      const contentArtifact = yield* ContentArtifact;
      const record = yield* sessions.get(payload.sessionId);

      const verified = verifyEnvelope(record, payload.expectedRevision);
      if (verified.outcome !== "success") return verified;

      const workspace = yield* sessions.getConstructionWorkspace(record);
      const commandId = deriveConstructionCommandId(
        payload.transportRequestId,
        payload.designId,
        payload.expectedRevision,
      );

      const replayed = replayIdempotent(workspace, payload.transportRequestId, commandId);
      if (replayed) return replayed;

      const content = yield* contentArtifact.loadShipBuildingContent();
      const placed = placeOrderFor(record, commandId, payload.designId, content);
      if (!placed.ok) return placed.result;
      const costs = placed.costs;

      const recordCreated = acceptConstructionRecord(
        workspace,
        record,
        commandId,
        payload.transportRequestId,
        payload.expectedRevision,
        payload.designId,
        costs.projectedCost,
        costs.projectedCapacityUnits,
      );

      const reserved = reserveForOrder(workspace, record, recordCreated, costs);
      if (!reserved.ok) {
        return {
          outcome: "rejected" as const,
          reason: reserved.reasonCode,
          diagnostics: reserved.diagnostics,
        };
      }

      const accepted = { ...recordCreated, reservationRecordIds: reserved.recordIds };
      const uiDesign = resolveUiDesign(record, payload.designId);

      const nextState = yield* projects
        .persistConstructionSnapshot(record, () => placed.snapshot)
        .pipe(Effect.tapError(() => Effect.sync(() => workspace.release(commandId))));
      yield* sessions.register({ ...record, state: nextState });

      workspace.putRecord(accepted);
      workspace.rememberIdempotent(accepted);
      workspace.appendCommand(
        toUiCommand({
          recordRef: accepted,
          designId: payload.designId,
          design: uiDesign,
          projectedCost: costs.projectedCost,
          projectedCapacityUnits: costs.projectedCapacityUnits,
          submittedAtRevision: Number(record.state.snapshot.turnNumber),
        }),
      );
      workspace.appendLedger({
        type: "success",
        commandId,
        snapshotHash: record.state.rawHash,
        result: { status: accepted.status, designId: payload.designId },
      });

      return commandSuccess(workspace, commandId, uiStatusFor(accepted));
    }),
);

export const replaceConstructionCommandProgram = withSchema(
  ReplaceConstructionOrderPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const projects = yield* ProjectStore;
      const contentArtifact = yield* ContentArtifact;
      const record = yield* sessions.get(payload.sessionId);

      const verified = verifyEnvelope(record, payload.expectedRevision);
      if (verified.outcome !== "success") return verified;

      const workspace = yield* sessions.getConstructionWorkspace(record);
      const newCommandId = deriveConstructionCommandId(
        payload.transportRequestId,
        payload.designId,
        payload.expectedRevision,
      );

      const replaceReplay = replayIdempotent(workspace, payload.transportRequestId, newCommandId);
      if (replaceReplay) return replaceReplay;

      const target = workspace.getRecord(payload.commandId);
      if (!target) {
        return {
          outcome: "rejected" as const,
          reason: "COMMAND_NOT_FOUND",
          diagnostics: [`No command ${payload.commandId} in session ${payload.sessionId}`],
        };
      }
      if (isTerminal(target)) {
        return {
          outcome: "rejected" as const,
          reason: "COMMAND_NOT_IN_FLIGHT",
          diagnostics: [
            `Command ${payload.commandId} is ${target.status}; only in-flight commands can be replaced`,
          ],
        };
      }

      const content = yield* contentArtifact.loadShipBuildingContent();
      const placed = placeOrderFor(
        record,
        newCommandId,
        payload.designId,
        content,
        payload.commandId,
      );
      if (!placed.ok) return placed.result;
      const costs = placed.costs;

      const affordable = canReserveReplacement(workspace, record, payload.commandId, costs);
      if (!affordable.ok) {
        return {
          outcome: "rejected" as const,
          reason: affordable.reasonCode,
          diagnostics: affordable.diagnostics,
        };
      }

      const superseded = withRecordStatus(target, "SUPERSEDED");
      const settlement = settleAndRelease(
        workspace,
        superseded,
        "supersession",
        forecastCostOf(superseded),
      );
      const supersededRecord = {
        ...superseded,
        settlementRecord: settlement,
        supersededByCommandId: newCommandId,
      };
      workspace.putRecord(supersededRecord);
      workspace.setCommandStatus(payload.commandId, "superseded");

      const recordCreated = acceptConstructionRecord(
        workspace,
        record,
        newCommandId,
        payload.transportRequestId,
        payload.expectedRevision,
        payload.designId,
        costs.projectedCost,
        costs.projectedCapacityUnits,
      );
      const reserved = reserveForOrder(workspace, record, recordCreated, costs);
      if (!reserved.ok) {
        restoreInFlight(workspace, target);
        return {
          outcome: "rejected" as const,
          reason: reserved.reasonCode,
          diagnostics: reserved.diagnostics,
        };
      }
      const accepted = { ...recordCreated, reservationRecordIds: reserved.recordIds };
      const uiDesign = resolveUiDesign(record, payload.designId);

      const nextState = yield* projects
        .persistConstructionSnapshot(record, () => placed.snapshot)
        .pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              restoreInFlight(workspace, target);
              workspace.release(newCommandId);
            }),
          ),
        );
      yield* sessions.register({ ...record, state: nextState });

      workspace.putRecord(accepted);
      workspace.rememberIdempotent(accepted);
      workspace.appendCommand(
        toUiCommand({
          recordRef: accepted,
          designId: payload.designId,
          design: uiDesign,
          projectedCost: costs.projectedCost,
          projectedCapacityUnits: costs.projectedCapacityUnits,
          submittedAtRevision: Number(record.state.snapshot.turnNumber),
        }),
      );
      workspace.appendLedger({
        type: "success",
        commandId: payload.commandId,
        snapshotHash: record.state.rawHash,
        result: { status: "SUPERSEDED", supersededBy: newCommandId },
      });
      workspace.appendLedger({
        type: "success",
        commandId: newCommandId,
        snapshotHash: record.state.rawHash,
        result: { status: accepted.status, designId: payload.designId },
      });

      return commandSuccess(workspace, newCommandId, uiStatusFor(accepted));
    }),
);

export const cancelConstructionCommandProgram = withSchema(
  CancelConstructionOrderPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const projects = yield* ProjectStore;
      const record = yield* sessions.get(payload.sessionId);

      const verified = verifyEnvelope(record, payload.expectedRevision);
      if (verified.outcome !== "success") return verified;

      const workspace = yield* sessions.getConstructionWorkspace(record);

      const cancelReplay = replayIdempotent(
        workspace,
        payload.transportRequestId,
        payload.commandId,
      );
      if (cancelReplay) return cancelReplay;

      const target = workspace.getRecord(payload.commandId);
      if (!target) {
        return {
          outcome: "rejected" as const,
          reason: "COMMAND_NOT_FOUND",
          diagnostics: [`No command ${payload.commandId} in session ${payload.sessionId}`],
        };
      }
      if (isTerminal(target)) {
        return {
          outcome: "rejected" as const,
          reason: "COMMAND_NOT_IN_FLIGHT",
          diagnostics: [
            `Command ${payload.commandId} is already ${target.status}; only in-flight commands can be cancelled`,
          ],
        };
      }

      const cancelled = withRecordStatus(target, "CANCELLED");
      const settlement = settleAndRelease(
        workspace,
        cancelled,
        CONSTRUCTION_SETTLEMENT_BRANCH_ID,
        forecastCostOf(cancelled),
      );
      const cancelledRecord = { ...cancelled, settlementRecord: settlement };
      workspace.putRecord(cancelledRecord);
      workspace.setCommandStatus(payload.commandId, "cancelled");

      const nextState = yield* projects
        .persistConstructionSnapshot(record, (snapshot) =>
          removeProjectForCommand(snapshot, record.playerSlotId, payload.commandId),
        )
        .pipe(Effect.tapError(() => Effect.sync(() => restoreInFlight(workspace, target))));
      yield* sessions.register({ ...record, state: nextState });

      workspace.rememberIdempotent(cancelledRecord);
      workspace.appendLedger({
        type: "success",
        commandId: payload.commandId,
        snapshotHash: record.state.rawHash,
        result: { status: "CANCELLED" },
      });

      return commandSuccess(workspace, payload.commandId, "cancelled");
    }),
);

function commandSuccess(
  workspace: ConstructionWorkspace,
  commandId: string,
  status: ConstructionCommandStatus,
): BridgeResult<ConstructionCommandOutcome> {
  return {
    outcome: "success",
    value: {
      command: { commandId, status },
      workspace: workspaceView(workspace),
    },
    diagnostics: [],
  };
}
