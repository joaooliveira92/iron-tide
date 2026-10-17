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
} from "../campaignCommandSchemas.js";
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

/**
 * The Construction screen's four real commands (desktop-mvp ticket 14), as
 * native `CommandProgram`s (INC-5; ADR-0159).
 *
 * This module is deliberately thin: it owns only the command FLOW — session
 * envelope verification, the F2 ordering of validate/reserve/persist/bookkeep,
 * and the per-command supersession/cancellation semantics. Every supporting
 * concern lives in `commands/construction/`:
 * - `command-id`          deterministic per-payload command ids
 * - `idempotency`         transportRequestId replay / conflict
 * - `design-validation`   design-exists-and-belongs-to-player
 * - `reservations`        treasury/capacity holds, replace preflight, rollback
 * - `command-view`        UI-facing command rows and status mapping
 * - `snapshot-mutations`  pure queued-project add/remove edits
 *
 * Each program resolves its services from the Layer (`CampaignSessionStore`,
 * `ProjectStore`) rather than importing module singletons, follows the exact
 * `commitMonth`/`inspectCampaign` conventions: session lookup,
 * `expectedRevision` against `snapshot.turnNumber` (a mismatch returns
 * REVISION_MISMATCH with the session untouched), and envelope recomputation +
 * `toSaveableState` + `SaveStore.save` + session re-registration on every
 * authoritative mutation (behind `ProjectStore.persistConstructionSnapshot`).
 */

export const inspectConstructionScreenProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const contentArtifact = yield* ContentArtifact;
    const record = yield* sessions.get(sessionId);
    // Resolution through the store re-points the reservation pools at the
    // session's current numbers (the former `syncReservationPools` call).
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

/**
 * The read-only preview for the build dialog (SB3-R30/R33): resolves the session's snapshot, the compiled
 * ship-building content and the campaign month, then asks the engine's `previewConstructionBatch` for the names, the
 * dock ceiling and the fit. It mutates nothing and reserves nothing — a refused quantity comes back as the engine's
 * own `reason` (e.g. `CONSTRUCTION_BATCH_LIMIT_EXCEEDED`), never a desktop-invented code.
 */
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

/**
 * The read-only preview for the foreign-order dialog (SB3-R20/R23/R34; INC-9b): resolves the session's snapshot, the
 * compiled ship-building content and the campaign month, then asks the engine's `previewForeignConstruction` for the
 * candidate builders (dock ceiling, free capacity, capability verdict, impoundment risk, delivery guarantee) and, when a
 * builder is chosen, the contract terms. It mutates nothing and reserves nothing — a refused quantity comes back as
 * the engine's own `reason` (e.g. `FOREIGN_CONSTRUCTION_QUANTITY_INVALID`), never a desktop-invented code.
 */
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

      // Idempotent retry: the same transportRequestId was already processed —
      // replay its outcome instead of double-ordering.
      const replayed = replayIdempotent(workspace, payload.transportRequestId, commandId);
      if (replayed) return replayed;

      // The engine-side policy decides (ownership, revalidation, auxiliary limits) and builds the project; this layer
      // only orchestrates reservations and persistence around it (ADR-0088).
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
        // Rejected before any snapshot mutation, reservation, or ledger entry —
        // the workspace is untouched.
        return {
          outcome: "rejected" as const,
          reason: reserved.reasonCode,
          diagnostics: reserved.diagnostics,
        };
      }

      const accepted = { ...recordCreated, reservationRecordIds: reserved.recordIds };
      const uiDesign = resolveUiDesign(record, payload.designId);

      // Authoritative mutation first, THEN the in-memory bookkeeping: if the
      // persist fails, the workspace has only the (rolled-back) pool reservation
      // and the command reports SAVE_FAILED with no record/command/idempotency
      // entry — no partial in-memory state is persisted under a failure (F2).
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

      // Idempotent retry of the replace itself — the replacement command (created
      // below) is stored under the replace's transportRequestId.
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

      // F2 — failure-atomic replace: BOTH rejectable conditions of the
      // replacement (unknown/foreign design, unaffordable reservation) are
      // checked BEFORE the original is superseded, so a rejected replace leaves
      // the original exactly as it was (in-flight, project queued, no extra
      // save). The single snapshot persist below then removes the original's
      // project AND queues the replacement's in ONE SaveStore.save.
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

      // In-memory supersession of the original (nothing persisted yet).
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

      // In-memory acceptance of the replacement (reservation confirmed by the
      // preflight above; the original's release already freed its hold).
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
        // Defensive only — the preflight made this unreachable. Restore the
        // original to in-flight before reporting the rejection.
        restoreInFlight(workspace, target);
        return {
          outcome: "rejected" as const,
          reason: reserved.reasonCode,
          diagnostics: reserved.diagnostics,
        };
      }
      const accepted = { ...recordCreated, reservationRecordIds: reserved.recordIds };
      const uiDesign = resolveUiDesign(record, payload.designId);

      // The ONE authoritative persist: original's project out, replacement's in.
      const nextState = yield* projects
        .persistConstructionSnapshot(record, () => placed.snapshot)
        .pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              // Roll the whole supersession back: the original is in-flight
              // again with its reservation re-held, the replacement leaves no
              // trace, and the session is exactly as it was (nothing was
              // persisted).
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

      // Idempotent retry: the cancelled record itself is stored under the cancel
      // request's transportRequestId.
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

      // Authoritative mutation first (F2): if the persist fails, the in-memory
      // cancellation is rolled back — the record is in-flight again with its
      // reservation re-held — so the workspace can never report a cancellation
      // the package doesn't reflect. Idempotency/ledger entries are written only
      // after the save succeeded.
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

// flow helpers

/** The one success shape every mutating command returns. */
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
