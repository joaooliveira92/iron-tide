import type {
  AuthorizeDockExpansionCommand,
  CancelConstructionProjectCommand,
  HaltConstructionCommand,
  OrderConstructionCommand,
  OrderForeignConstructionCommand,
  ResumeConstructionCommand,
  SetAccelerationCommand,
} from "@bluewave/commands";
import {
  AuthorizeDockExpansionCommandPayloadSchema,
  CancelConstructionProjectPayloadSchema,
  HaltConstructionCommandPayloadSchema,
  OrderConstructionBatchCommandPayloadSchema,
  PlaceForeignConstructionCommandPayloadSchema,
  ResumeConstructionCommandPayloadSchema,
  SetAccelerationCommandPayloadSchema,
} from "../../shared/campaignCommandSchemas.js";
import { withSchema, withStrictSchema } from "../runtime/commandProgram.js";
import { submitPlayerCommand, type PlayerCommandRequest } from "./playerCommandSupport.js";

/**
 * The Construction screen's steering commands (DESIGN-23 sections 3-8; SB3-R5/R8/R11/R16): halt, resume, accelerate,
 * the class-order batch and the dock-expansion authorization — as native `CommandProgram`s (INC-5; ADR-0159).
 *
 * These are the reachability wiring for the engine entry points that previously had no production caller. Each queues
 * a real engine command envelope through the shared `submitPlayerCommand` seam (issue-time validation is the engine's
 * own `CommandLifecycle.validate`), so the engine's `command_collection` phase — not the desktop — is the sole
 * mutator of authoritative state. `commitMonth` drains the queue and applies the commands. Each program decodes its
 * own wire payload and resolves `CampaignSessionStore`/`CommandQueueStore` through the Layer (via
 * `submitPlayerCommand`), never the module singletons.
 */

export const haltConstructionCommandProgram = withSchema(
  HaltConstructionCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<HaltConstructionCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "HaltConstruction",
          nationId: record.playerSlotId,
          projectId: payload.projectId,
        },
        discriminator: payload.projectId,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const resumeConstructionCommandProgram = withSchema(
  ResumeConstructionCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<ResumeConstructionCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "ResumeConstruction",
          nationId: record.playerSlotId,
          projectId: payload.projectId,
        },
        discriminator: payload.projectId,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const setAccelerationCommandProgram = withSchema(
  SetAccelerationCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<SetAccelerationCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "SetAcceleration",
          nationId: record.playerSlotId,
          projectId: payload.projectId,
          accelerated: payload.accelerated,
        },
        discriminator: `${payload.projectId}:${String(payload.accelerated)}`,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const cancelConstructionProjectCommandProgram = withSchema(
  CancelConstructionProjectPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<CancelConstructionProjectCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "CancelConstructionProject",
          nationId: record.playerSlotId,
          projectId: payload.projectId,
        },
        discriminator: payload.projectId,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const orderConstructionBatchCommandProgram = withSchema(
  OrderConstructionBatchCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<OrderConstructionCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "OrderConstruction",
          nationId: record.playerSlotId,
          designVersionId: payload.designVersionId,
          quantity: payload.quantity,
        },
        discriminator: `${payload.designVersionId}:${String(payload.quantity)}`,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const authorizeDockExpansionCommandProgram = withSchema(
  AuthorizeDockExpansionCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<AuthorizeDockExpansionCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "AuthorizeDockExpansion",
          nationId: record.playerSlotId,
          possessionId: payload.possessionId,
        },
        discriminator: payload.possessionId,
      }),
    };
    return submitPlayerCommand(request);
  },
);

export const placeForeignConstructionCommandProgram = withStrictSchema(
  PlaceForeignConstructionCommandPayloadSchema,
  (payload) => {
    const request: PlayerCommandRequest<OrderForeignConstructionCommand> = {
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => ({
        body: {
          type: "OrderForeignConstruction",
          nationId: record.playerSlotId,
          designVersionId: payload.designVersionId,
          builderNationId: payload.builderNationId,
          quantity: payload.quantity,
          ...(payload.plannedDeliveryMonth === undefined
            ? {}
            : { plannedDeliveryMonth: payload.plannedDeliveryMonth }),
        },
        discriminator: `${payload.designVersionId}:${payload.builderNationId}`,
      }),
    };
    return submitPlayerCommand(request);
  },
);
