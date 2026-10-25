import { buildFleetScreenView, type MovementCommand } from "@bluewave/campaign-engine";
import {
  isTrainingProficient,
  TRAINING_DORMANT,
  TRAINING_SUBJECTS,
  trainingRefusal,
} from "@bluewave/campaign";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  FleetScreenProjection,
  FleetTrainingProjection,
  MovementCommandOutcome,
  ShipReadinessOutcome,
  SpecialTrainingOutcome,
  StationAssignmentOutcome,
} from "../../shared/fleet-contract.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed, CommandRejected, type CommandError } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { CommandQueue, type PendingCommandEntry } from "../runtime/commandQueue.js";
import { currentRevision, submitPlayerCommand, verifyEnvelope } from "./playerCommandSupport.js";

interface MovementRequest {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly divisionId: string;
  readonly toAreaId: string;
}

function queuedMovementCommands(
  record: CampaignSessionRecord,
  entries: readonly PendingCommandEntry[],
): MovementCommand[] {
  const snapshot = record.state.snapshot;
  const commands: MovementCommand[] = [];
  for (const entry of entries) {
    const body = entry.envelope.body;
    if (body.type !== "MoveFleet") continue;
    const fleet = snapshot.nations
      .get(record.playerSlotId)
      ?.fleets.find((candidate) => candidate.id === body.fleetId);
    commands.push({
      commandId: entry.envelope.commandId,
      divisionId: body.fleetId,
      fromAreaId: fleet?.locationAreaId ?? "",
      toAreaId: body.toAreaId,
      status: "submitted",
      submittedAtRevision: currentRevision(record),
    });
  }
  return commands;
}

function movementSuccess(
  record: CampaignSessionRecord,
  entries: readonly PendingCommandEntry[],
  commandId: string,
  status: "submitted" | "cancelled",
): BridgeResult<MovementCommandOutcome> {
  return {
    outcome: "success",
    value: {
      workspace: { movementCommands: queuedMovementCommands(record, entries) },
      command: { commandId, status },
    },
    diagnostics: [],
  };
}

function submitMovement(
  request: MovementRequest,
): Effect.Effect<
  BridgeResult<MovementCommandOutcome>,
  CommandError,
  CampaignSessionStore | CommandQueue
> {
  return Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueue;
    const record = yield* sessions.get(request.sessionId);

    const result = yield* submitPlayerCommand({
      sessionId: request.sessionId,
      expectedRevision: request.expectedRevision,
      transportRequestId: request.transportRequestId,
      build: (sessionRecord) => ({
        body: {
          type: "MoveFleet",
          nationId: sessionRecord.playerSlotId,
          fleetId: request.divisionId,
          toAreaId: request.toAreaId,
        },
        discriminator: request.divisionId,
      }),
    });
    if (result.outcome !== "success") return result;

    for (const entry of yield* queue.entries(request.sessionId)) {
      if (
        entry.envelope.commandId === result.value.commandId &&
        entry.transportRequestId !== request.transportRequestId
      ) {
        yield* queue.delete(request.sessionId, entry.transportRequestId);
      }
    }
    return movementSuccess(
      record,
      yield* queue.entries(request.sessionId),
      result.value.commandId,
      "submitted",
    );
  });
}

export const inspectFleetScreenProgram: CommandHandler<"inspectFleetScreen"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueue;
    const record = yield* sessions.get(sessionId);

    const nation = record.state.snapshot.nations.get(record.playerSlotId);
    if (!nation) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    const contentArtifact = yield* ContentArtifact;
    const shipBuilding = yield* contentArtifact.loadShipBuildingContent();
    const view = buildFleetScreenView(
      record.state.snapshot,
      record.playerSlotId,
      shipBuilding.presence === undefined
        ? undefined
        : { month: record.month, rules: shipBuilding.presence },
    );
    const fleetManagement = yield* contentArtifact.loadFleetManagementRules();
    const training: FleetTrainingProjection | undefined =
      fleetManagement === undefined
        ? undefined
        : {
            maxSubjects: fleetManagement.training.maxSubjects,
            proficiencyMonths: fleetManagement.training.proficiencyMonths,
            subjects: TRAINING_SUBJECTS.map((subject) => {
              const entry = nation.specialTraining?.find((e) => e.subject === subject);
              return {
                subject,
                maintenanceAdderBp: fleetManagement.training.subjects[subject].maintenanceAdderBp,
                funded: entry !== undefined,
                fundedMonths: entry?.fundedMonths ?? 0,
                proficient:
                  entry !== undefined &&
                  isTrainingProficient(entry, fleetManagement.training.proficiencyMonths),
              };
            }),
          };
    const projection: FleetScreenProjection = {
      revision: Number(record.state.snapshot.turnNumber),
      month: record.month,
      playerNationId: record.playerSlotId,
      divisions: view.divisions,
      areas: view.areas,
      areaEdges: view.areaEdges,
      ports: view.ports,
      movementCommands: queuedMovementCommands(record, yield* queue.entries(record.sessionId)),
      presence: view.presence,
      overBaseShips: view.overBaseShips,
      ...(training === undefined ? {} : { training }),
    };

    return { outcome: "success" as const, value: projection, diagnostics: [] };
  });

export const submitMovementCommandProgram: CommandHandler<"submitMovementCommand"> = (payload) =>
  submitMovement(payload);

export const replaceMovementCommandProgram: CommandHandler<"replaceMovementCommand"> = (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueue;
    const record = yield* sessions.get(payload.sessionId);

    const verified = verifyEnvelope(record, payload.expectedRevision);
    if (verified.outcome !== "success") return verified;

    const existing = (yield* queue.entries(payload.sessionId)).some(
      (entry) => entry.envelope.commandId === payload.commandId,
    );
    if (!existing) {
      return yield* new CommandRejected({
        reason: "COMMAND_NOT_FOUND",
        diagnostics: [`No pending movement command ${payload.commandId}`],
      });
    }
    return yield* submitMovement(payload);
  });

export const cancelMovementCommandProgram: CommandHandler<"cancelMovementCommand"> = (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueue;
    const record = yield* sessions.get(payload.sessionId);

    const verified = verifyEnvelope(record, payload.expectedRevision);
    if (verified.outcome !== "success") return verified;

    const matches = (yield* queue.entries(payload.sessionId)).filter(
      (entry) =>
        entry.envelope.commandId === payload.commandId && entry.envelope.body.type === "MoveFleet",
    );
    if (matches.length === 0) {
      return yield* new CommandRejected({
        reason: "COMMAND_NOT_FOUND",
        diagnostics: [`No pending movement command ${payload.commandId}`],
      });
    }
    for (const entry of matches) {
      yield* queue.delete(payload.sessionId, entry.transportRequestId);
    }
    return movementSuccess(
      record,
      yield* queue.entries(payload.sessionId),
      payload.commandId,
      "cancelled",
    );
  });

export const submitStationAssignmentProgram: CommandHandler<"submitStationAssignment"> = (
  payload,
) =>
  Effect.map(
    submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => {
        const shipIds = [...payload.shipIds];
        return {
          body:
            payload.intent === "assign"
              ? { type: "AssignForeignStation" as const, nationId: record.playerSlotId, shipIds }
              : { type: "ClearForeignStation" as const, nationId: record.playerSlotId, shipIds },
          discriminator: [...shipIds].sort().join("\u0000"),
        };
      },
    }),
    (result): BridgeResult<StationAssignmentOutcome> =>
      result.outcome === "success"
        ? {
            ...result,
            value: {
              commandId: result.value.commandId,
              intent: payload.intent,
              shipCount: payload.shipIds.length,
              appliedOnNextTurn: true,
            },
          }
        : result,
  );

export const submitShipReadinessProgram: CommandHandler<"submitShipReadiness"> = (payload) =>
  Effect.map(
    submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => {
        const shipIds = [...payload.shipIds];
        return {
          body: {
            type: "SetShipReadiness" as const,
            nationId: record.playerSlotId,
            shipIds,
            readiness: payload.readiness,
          },
          discriminator: `${payload.readiness}\u0000${[...shipIds].sort().join("\u0000")}`,
        };
      },
    }),
    (result): BridgeResult<ShipReadinessOutcome> =>
      result.outcome === "success"
        ? {
            ...result,
            value: {
              commandId: result.value.commandId,
              readiness: payload.readiness,
              shipCount: payload.shipIds.length,
              appliedOnNextTurn: true,
            },
          }
        : result,
  );

export const submitSpecialTrainingProgram: CommandHandler<"submitSpecialTraining"> = (payload) =>
  Effect.gen(function* () {
    const contentArtifact = yield* ContentArtifact;
    const rules = (yield* contentArtifact.loadFleetManagementRules())?.training;
    if (rules === undefined) {
      return {
        outcome: "rejected" as const,
        reason: TRAINING_DORMANT,
        diagnostics: ["Special training is not available in this campaign"],
      };
    }
    const refusal = trainingRefusal(payload.subjects, rules);
    if (refusal !== null) {
      return {
        outcome: "rejected" as const,
        reason: refusal,
        diagnostics: [`At most ${rules.maxSubjects} subjects can be funded at once`],
      };
    }
    const queued = yield* submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => {
        const subjects = [...payload.subjects];
        return {
          body: {
            type: "SetSpecialTraining" as const,
            nationId: record.playerSlotId,
            subjects,
          },
          discriminator: [...subjects].sort().join("\u0000"),
        };
      },
    });
    const result: BridgeResult<SpecialTrainingOutcome> =
      queued.outcome === "success"
        ? {
            ...queued,
            value: {
              commandId: queued.value.commandId,
              subjects: payload.subjects,
              appliedOnNextTurn: true,
            },
          }
        : queued;
    return result;
  });
