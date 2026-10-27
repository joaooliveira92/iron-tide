import { buildDivisionScreenView } from "@bluewave/campaign-engine";
import type { CommandBody } from "@bluewave/commands";
import { sha256Hex } from "@bluewave/deterministic";
import { Effect } from "effect";
import type {
  DivisionCommandBody,
  DivisionScreenProjection,
} from "../../shared/division-contract.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { currentRevision, submitPlayerCommand } from "./playerCommandSupport.js";

export const inspectDivisionScreenProgram: CommandHandler<"inspectDivisionScreen"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const contentArtifact = yield* ContentArtifact;
    const fleetManagement = yield* contentArtifact.loadFleetManagementRules();
    const view = buildDivisionScreenView(
      record.state.snapshot,
      record.playerSlotId,
      fleetManagement?.reorganisationPenalty,
    );
    if (!view) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }
    const value: DivisionScreenProjection = {
      ...view,
      revision: currentRevision(record),
      month: record.month,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  });

export const submitDivisionCommandProgram: CommandHandler<"submitDivisionCommand"> = (payload) =>
  submitPlayerCommand({
    sessionId: payload.sessionId,
    expectedRevision: payload.expectedRevision,
    transportRequestId: payload.transportRequestId,
    build: (record) =>
      planDivisionCommand(
        record.playerSlotId,
        Number(record.state.snapshot.turnNumber),
        payload.command,
      ),
  });

export function newDivisionId(nationId: string, turn: number, flagshipShipId: string): string {
  const digest = sha256Hex(`division:${nationId}:${turn}:${flagshipShipId}`);
  return `div_${nationId}_${digest.slice(0, 10)}`;
}

interface DivisionCommandContext {
  readonly nationId: string;
  readonly turn: number;
}

interface DivisionCommandPlan {
  readonly body: Extract<CommandBody, { type: DivisionCommandBody["type"] }>;
  readonly discriminator: string;
}

interface DivisionCommandDescriptor<T extends DivisionCommandBody> {
  readonly discriminator: (command: T, context: DivisionCommandContext) => string;
  readonly toEngineBody: (
    command: T,
    context: DivisionCommandContext,
  ) => Extract<CommandBody, { type: T["type"] }>;
}

type DivisionCommandPlanner = (
  command: DivisionCommandBody,
  context: DivisionCommandContext,
) => DivisionCommandPlan;

function planWith<T extends DivisionCommandBody["type"]>(
  descriptor: DivisionCommandDescriptor<Extract<DivisionCommandBody, { type: T }>>,
): DivisionCommandPlanner {
  return (command, context) => {
    const typed = command as Extract<DivisionCommandBody, { type: T }>;
    return {
      body: descriptor.toEngineBody(typed, context),
      discriminator: descriptor.discriminator(typed, context),
    };
  };
}

const DIVISION_COMMANDS: {
  readonly [K in DivisionCommandBody["type"]]: DivisionCommandPlanner;
} = {
  CreateDivision: planWith<"CreateDivision">({
    discriminator: (command, context) =>
      newDivisionId(context.nationId, context.turn, command.flagshipShipId),
    toEngineBody: (command, context) => ({
      type: "CreateDivision",
      nationId: context.nationId,
      divisionId: newDivisionId(context.nationId, context.turn, command.flagshipShipId),
      shipOrder: [command.flagshipShipId],
      divisionRole: command.role,
      preferredFormation: command.formation,
    }),
  }),
  AddShipToDivision: planWith<"AddShipToDivision">({
    discriminator: (command) => `${command.divisionId}\u0000${command.shipId}`,
    toEngineBody: (command, context) => ({
      type: "AddShipToDivision",
      nationId: context.nationId,
      divisionId: command.divisionId,
      shipId: command.shipId,
    }),
  }),
  RemoveShipFromDivision: planWith<"RemoveShipFromDivision">({
    discriminator: (command) => `${command.divisionId}\u0000${command.shipId}`,
    toEngineBody: (command, context) => ({
      type: "RemoveShipFromDivision",
      nationId: context.nationId,
      divisionId: command.divisionId,
      shipId: command.shipId,
    }),
  }),
  ChangeDivisionFlagship: planWith<"ChangeDivisionFlagship">({
    discriminator: (command) => `${command.divisionId}\u0000${command.newFlagshipShipId}`,
    toEngineBody: (command, context) => ({
      type: "ChangeDivisionFlagship",
      nationId: context.nationId,
      divisionId: command.divisionId,
      newFlagshipShipId: command.newFlagshipShipId,
    }),
  }),
  ReorderDivisionShips: planWith<"ReorderDivisionShips">({
    discriminator: (command) => `${command.divisionId}\u0000${command.shipOrder.join(",")}`,
    toEngineBody: (command, context) => ({
      type: "ReorderDivisionShips",
      nationId: context.nationId,
      divisionId: command.divisionId,
      shipOrder: [...command.shipOrder],
    }),
  }),
  ChangeDivisionDoctrine: planWith<"ChangeDivisionDoctrine">({
    discriminator: (command) =>
      `${command.divisionId}\u0000${command.role ?? ""}\u0000${command.formation ?? ""}`,
    toEngineBody: (command, context) => ({
      type: "ChangeDivisionDoctrine",
      nationId: context.nationId,
      divisionId: command.divisionId,
      ...(command.role === undefined ? {} : { divisionRole: command.role }),
      ...(command.formation === undefined ? {} : { preferredFormation: command.formation }),
    }),
  }),
  AssignOfficer: planWith<"AssignOfficer">({
    discriminator: (command) => `${command.divisionId}\u0000${command.officerId}`,
    toEngineBody: (command, context) => ({
      type: "AssignOfficer",
      nationId: context.nationId,
      divisionId: command.divisionId,
      officerId: command.officerId,
    }),
  }),
  RelieveOfficer: planWith<"RelieveOfficer">({
    discriminator: (command) => command.divisionId,
    toEngineBody: (command, context) => ({
      type: "RelieveOfficer",
      nationId: context.nationId,
      divisionId: command.divisionId,
    }),
  }),
  DissolveDivision: planWith<"DissolveDivision">({
    discriminator: (command) => command.divisionId,
    toEngineBody: (command, context) => ({
      type: "DissolveDivision",
      nationId: context.nationId,
      divisionId: command.divisionId,
    }),
  }),
};

function planDivisionCommand(
  nationId: string,
  turn: number,
  command: DivisionCommandBody,
): DivisionCommandPlan {
  return DIVISION_COMMANDS[command.type](command, { nationId, turn });
}
