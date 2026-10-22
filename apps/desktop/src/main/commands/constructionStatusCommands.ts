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
