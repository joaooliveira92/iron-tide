import { buildDiplomacyScreenProjection } from "@bluewave/campaign-engine";
import type { CommandBody } from "@bluewave/commands";
import { Effect } from "effect";
import type {
  DiplomacyCommandBody,
  DiplomacyScreenProjection,
} from "../../shared/diplomacy-contract.js";
import {
  SessionIdPayloadSchema,
  SubmitDiplomacyCommandPayloadSchema,
} from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { currentRevision, submitPlayerCommand } from "./playerCommandSupport.js";

/**
 * The Diplomacy & War screen's two bridge commands
 * (desktop-diplomacy-war INC-1/INC-2), as native `CommandProgram`s (INC-5;
 * ADR-0159). Session lookup (`SESSION_NOT_FOUND`), `expectedRevision` against
 * `snapshot.turnNumber` (`REVISION_MISMATCH` with the session untouched),
 * deterministic envelope construction, and `transportRequestId` idempotency —
 * the same conventions every player-command family follows.
 *
 * Authority (spec D1): the desktop ONLY queues a real engine envelope
 * through the shared per-session command queue (`CommandQueueStore`, drained
 * by `commitMonth`); the engine (`MonthExecutor` command_collection, order
 * 6.5 diplomacy phase) is the sole mutator of politics/wars/blockades.
 * Issue-time validity is the ENGINE's own `CommandLifecycle.validate()` —
 * never a hand-mirror — so an invalid request surfaces the engine's stable
 * code + message verbatim (e.g. `ALREADY_AT_WAR`, `DECLARE_WAR_INVALID_TARGET`,
 * `BLOCKADE_NOT_AT_WAR`) and leaves the session/queue untouched.
 */
export const inspectDiplomacyScreenProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
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
  }),
);

export const submitDiplomacyCommandProgram = withSchema(
  SubmitDiplomacyCommandPayloadSchema,
  (payload) =>
    submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => planDiplomacyCommand(payload.command, record.playerSlotId),
    }),
);

interface DiplomacyCommandPlan {
  readonly body: Extract<CommandBody, { type: DiplomacyCommandBody["type"] }>;
  readonly discriminator: string;
}

/**
 * The per-command descriptor: its idempotency discriminator (the nontrivial
 * operand — target / partner / war / area) and its engine body. Keeping BOTH in
 * one entry (rather than two switches over the same union) means a new
 * diplomacy command is a single addition — the two can no longer drift apart.
 */
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

/**
 * Adapts a descriptor for one union member into a uniform planner. The table is
 * keyed by the discriminant and only ever entered via {@link planDiplomacyCommand}'s
 * `command.type` lookup, so asserting that `command` is member `T` is sound;
 * TypeScript cannot express that correlation across an indexed lookup (same
 * registry discipline as `campaignBridge.ts`).
 */
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

/** One entry per wire command: its engine body and idempotency discriminator.
 * `nationId` is always the session's player slot, never on the wire. */
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

/** Maps the wire command onto the engine's own `CommandBody` and its
 * idempotency discriminator; `nationId` is always the session's player slot. */
function planDiplomacyCommand(
  command: DiplomacyCommandBody,
  playerSlotId: string,
): DiplomacyCommandPlan {
  return DIPLOMACY_COMMANDS[command.type](command, playerSlotId);
}
