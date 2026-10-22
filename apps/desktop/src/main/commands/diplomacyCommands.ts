import { buildDiplomacyScreenProjection } from "@bluewave/campaign-engine";
import type { CommandBody } from "@bluewave/commands";
import { Effect } from "effect";
import type {
  DiplomacyCommandBody,
  DiplomacyScreenProjection,
} from "../../shared/diplomacy-contract.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { currentRevision, submitPlayerCommand } from "./playerCommandSupport.js";

export const inspectDiplomacyScreenProgram: CommandHandler<"inspectDiplomacyScreen"> = (
  sessionId,
) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const projection = buildDiplomacyScreenProjection(
      record.state,
      record.playerSlotId,
      record.month,
    );
    if (!projection) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    const value: DiplomacyScreenProjection = {
      ...projection,
      revision: currentRevision(record),
      month: record.month,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  });

export const submitDiplomacyCommandProgram: CommandHandler<"submitDiplomacyCommand"> = (payload) =>
  submitPlayerCommand({
    sessionId: payload.sessionId,
    expectedRevision: payload.expectedRevision,
    transportRequestId: payload.transportRequestId,
    build: (record) => planDiplomacyCommand(payload.command, record.playerSlotId),
  });

interface DiplomacyCommandPlan {
  readonly body: Extract<CommandBody, { type: DiplomacyCommandBody["type"] }>;
  readonly discriminator: string;
}

interface DiplomacyCommandDescriptor<T extends DiplomacyCommandBody> {
  readonly discriminator: (command: T) => string;
  readonly toEngineBody: (
    command: T,
    playerSlotId: string,
  ) => Extract<CommandBody, { type: T["type"] }>;
}

type DiplomacyCommandPlanner = (
  command: DiplomacyCommandBody,
  playerSlotId: string,
) => DiplomacyCommandPlan;

function planWith<T extends DiplomacyCommandBody["type"]>(
  descriptor: DiplomacyCommandDescriptor<Extract<DiplomacyCommandBody, { type: T }>>,
): DiplomacyCommandPlanner {
  return (command, playerSlotId) => {
    const typed = command as Extract<DiplomacyCommandBody, { type: T }>;
    return {
      body: descriptor.toEngineBody(typed, playerSlotId),
      discriminator: descriptor.discriminator(typed),
    };
  };
}

const DIPLOMACY_COMMANDS: {
  readonly [K in DiplomacyCommandBody["type"]]: DiplomacyCommandPlanner;
} = {
  DeclareWar: planWith<"DeclareWar">({
    discriminator: (command) => command.targetNationId,
    toEngineBody: (command, playerSlotId) => ({
      type: "DeclareWar",
      nationId: playerSlotId,
      targetNationId: command.targetNationId,
      ...(command.warGoalsId !== undefined ? { warGoalsId: command.warGoalsId } : {}),
    }),
  }),
  AcceptPeace: planWith<"AcceptPeace">({
    discriminator: (command) => command.warId,
    toEngineBody: (command, playerSlotId) => ({
      type: "AcceptPeace",
      nationId: playerSlotId,
      warId: command.warId,
    }),
  }),
  FormAlliance: planWith<"FormAlliance">({
    discriminator: (command) => command.partnerNationId,
    toEngineBody: (command, playerSlotId) => ({
      type: "FormAlliance",
      nationId: playerSlotId,
      partnerNationId: command.partnerNationId,
    }),
  }),
  BreakAlliance: planWith<"BreakAlliance">({
    discriminator: (command) => command.partnerNationId,
    toEngineBody: (command, playerSlotId) => ({
      type: "BreakAlliance",
      nationId: playerSlotId,
      partnerNationId: command.partnerNationId,
    }),
  }),
  FormNonAggressionPact: planWith<"FormNonAggressionPact">({
    discriminator: (command) => command.partnerNationId,
    toEngineBody: (command, playerSlotId) => ({
      type: "FormNonAggressionPact",
      nationId: playerSlotId,
      partnerNationId: command.partnerNationId,
    }),
  }),
  BreakNonAggressionPact: planWith<"BreakNonAggressionPact">({
    discriminator: (command) => command.partnerNationId,
    toEngineBody: (command, playerSlotId) => ({
      type: "BreakNonAggressionPact",
      nationId: playerSlotId,
      partnerNationId: command.partnerNationId,
    }),
  }),
  DeclareBlockade: planWith<"DeclareBlockade">({
    discriminator: (command) => `${command.targetNationId}\u0000${command.areaId}`,
    toEngineBody: (command, playerSlotId) => ({
      type: "DeclareBlockade",
      nationId: playerSlotId,
      targetNationId: command.targetNationId,
      areaId: command.areaId,
    }),
  }),
};

function planDiplomacyCommand(
  command: DiplomacyCommandBody,
  playerSlotId: string,
): DiplomacyCommandPlan {
  return DIPLOMACY_COMMANDS[command.type](command, playerSlotId);
}
