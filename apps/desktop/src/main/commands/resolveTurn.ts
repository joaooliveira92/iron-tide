import { Effect, Schema } from "effect";
import {
  computeOrderedInputsHash,
  computeTurnId,
  makeRecordedInput,
  type BattleResultInput,
  type DecisionAnswer,
  type InterruptionRequest,
  type RecordedInput,
} from "@bluewave/messages";
import type {
  AbandonPendingTurnResult,
  InterruptionRequestDto,
  PendingTurnDto,
  ResolveTurnResult,
} from "../../shared/campaign-command-contract.js";
import { CommandEnvelopePayloadSchema, SessionIdPayloadSchema } from "../campaignCommandSchemas.js";
import {
  clearPendingTurn,
  isPendingTurnValid,
  loadPendingTurn,
  savePendingTurn,
  type PendingTurnRecord,
} from "../pendingTurn.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { runTurnTransaction } from "./turnTransaction.js";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const AnswerDecisionPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  interruptionId: nonEmpty,
  decisionId: nonEmpty,
  optionId: nonEmpty,
});

const SubmitBattleResultPayloadSchema = Schema.Struct({
  ...CommandEnvelopePayloadSchema.fields,
  interruptionId: nonEmpty,
  battleId: nonEmpty,
  winnerId: Schema.NullOr(nonEmpty),
  loserId: Schema.NullOr(nonEmpty),
  attackerLosses: Schema.Array(nonEmpty),
  defenderLosses: Schema.Array(nonEmpty),
  damageReport: Schema.Record(Schema.String, Schema.Number),
});

function toPendingTurnDto(record: PendingTurnRecord): PendingTurnDto {
  return {
    turnId: record.turnId,
    campaignId: record.campaignId,
    playerNationId: record.playerNationId,
    startingRevision: record.startingRevision,
    nextInterruptionOrdinal: record.nextInterruptionOrdinal,
    recordedInputCount: record.recordedInputs.length,
    createdAt: record.createdAt,
  };
}

function toRequestDto(request: InterruptionRequest): InterruptionRequestDto {
  if (request.kind === "decision") {
    return {
      kind: "decision",
      turnId: request.turnId,
      interruptionId: request.interruptionId,
      ordinal: request.ordinal,
      phase: request.phase,
      titleKey: request.titleKey,
      bodyKey: request.bodyKey,
      interpolation: request.interpolation,
      decisionId: request.decisionId,
      options: request.options,
    };
  }
  return {
    kind: "battle",
    turnId: request.turnId,
    interruptionId: request.interruptionId,
    ordinal: request.ordinal,
    phase: request.phase,
    titleKey: request.titleKey,
    bodyKey: request.bodyKey,
    interpolation: request.interpolation,
    battleId: request.battleId,
    attackerId: request.attackerId,
    defenderId: request.defenderId,
    areaId: request.areaId,
  };
}

/**
 * Validate a stored pending turn against the already-verified save. Recomputes
 * the `turnId` from the record's own hash inputs and compares; a mismatch is
 * never migrated — the caller reports resumption unavailable and leaves the
 * authoritative state untouched.
 */
function validatePending(
  pending: PendingTurnRecord,
  session: {
    rawHash: string;
    snapshot: {
      campaignId: string;
      turnNumber: number;
      rulesetVersion: string;
      compatibilityVersion: string;
    };
  },
): readonly RecordedInput[] | null {
  const expectedTurnId = computeTurnId({
    campaignId: session.snapshot.campaignId,
    startingRevision: Number(session.snapshot.turnNumber),
    committedOrderHash: pending.committedOrderHash,
    orderedInputsHash: computeOrderedInputsHash(pending.recordedInputs),
  });
  const valid =
    expectedTurnId === pending.turnId &&
    pending.contentHashes.contentArtifact === session.rawHash &&
    isPendingTurnValid(pending, {
      campaignId: session.snapshot.campaignId,
      startingRevision: Number(session.snapshot.turnNumber),
      rulesetVersion: session.snapshot.rulesetVersion,
      compatibilityVersion: session.snapshot.compatibilityVersion,
      turnId: expectedTurnId,
    });
  return valid ? pending.recordedInputs : null;
}

/**
 * Resume-or-start a turn transaction. Returns a `completed` summary, a
 * `suspended` interruption request (persisted to `pending-turn.json`), or
 * `unavailable` when a stored pending turn cannot be trusted.
 */
export const resolveTurnProgram = withSchema(CommandEnvelopePayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);

    const pending = loadPendingTurn(record.saveDir);
    let recordedInputs: readonly RecordedInput[] = [];
    if (pending !== null) {
      const validated = validatePending(pending, record.state);
      if (validated === null) {
        const unavailable: ResolveTurnResult = { status: "unavailable" };
        return { outcome: "success" as const, value: unavailable, diagnostics: [] };
      }
      recordedInputs = validated;
    }

    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs,
    });
  }),
);

const finishTransaction = (input: {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly recordedInputs: readonly RecordedInput[];
}) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(input.sessionId);
    const outcome = yield* runTurnTransaction({
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      recordedInputs: input.recordedInputs,
      allowInterruptions: true,
    });

    switch (outcome.kind) {
      case "completed": {
        const value: ResolveTurnResult = { status: "completed", summary: outcome.summary };
        return { outcome: "success" as const, value, diagnostics: [...outcome.diagnostics] };
      }
      case "suspended": {
        yield* Effect.try({
          try: () => savePendingTurn(record.saveDir, outcome.pendingTurn),
          catch: (error) =>
            new CommandFailed({
              reason: "PENDING_TURN_WRITE_FAILED",
              diagnostics: [error instanceof Error ? error.message : String(error)],
            }),
        });
        const value: ResolveTurnResult = {
          status: "suspended",
          request: outcome.request === null ? null : toRequestDto(outcome.request),
          pendingTurn: toPendingTurnDto(outcome.pendingTurn),
        };
        return { outcome: "success" as const, value, diagnostics: [...outcome.diagnostics] };
      }
      case "unavailable": {
        const value: ResolveTurnResult = { status: "unavailable" };
        return { outcome: "success" as const, value, diagnostics: [...outcome.diagnostics] };
      }
      case "rejected":
        return {
          outcome: "rejected" as const,
          reason: outcome.reason,
          diagnostics: [...outcome.diagnostics],
          ...(outcome.currentRevision !== undefined
            ? { currentRevision: outcome.currentRevision }
            : {}),
        };
      case "error":
        return {
          outcome: "error" as const,
          reason: outcome.reason,
          diagnostics: [...outcome.diagnostics],
        };
    }
  });

/**
 * Record a decision answer at the next interruption ordinal and resume the
 * suspended turn. The answer is validated at this boundary and never reaches the
 * renderer as engine state.
 */
export const answerDecisionProgram = withSchema(AnswerDecisionPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const pending = loadPendingTurn(record.saveDir);
    if (pending === null) {
      return {
        outcome: "error" as const,
        reason: "NO_PENDING_TURN",
        diagnostics: [`No pending turn for session ${payload.sessionId}`],
      };
    }
    const ordinal = pending.nextInterruptionOrdinal;
    const answer: DecisionAnswer = {
      interruptionId: payload.interruptionId,
      decisionId: payload.decisionId,
      optionId: payload.optionId,
    };
    const recorded = makeRecordedInput({
      ordinal,
      kind: "decision",
      interruptionId: payload.interruptionId,
      payload: answer,
    });
    yield* recordInput(record.saveDir, pending, recorded);
    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs: [...pending.recordedInputs, recorded],
    });
  }),
);

/** Record a player-resolved battle result at the next ordinal and resume. */
export const submitBattleResultProgram = withSchema(SubmitBattleResultPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const pending = loadPendingTurn(record.saveDir);
    if (pending === null) {
      return {
        outcome: "error" as const,
        reason: "NO_PENDING_TURN",
        diagnostics: [`No pending turn for session ${payload.sessionId}`],
      };
    }
    const ordinal = pending.nextInterruptionOrdinal;
    const result: BattleResultInput = {
      interruptionId: payload.interruptionId,
      battleId: payload.battleId,
      winnerId: payload.winnerId,
      loserId: payload.loserId,
      attackerLosses: payload.attackerLosses,
      defenderLosses: payload.defenderLosses,
      damageReport: payload.damageReport,
    };
    const recorded = makeRecordedInput({
      ordinal,
      kind: "battle",
      interruptionId: payload.interruptionId,
      payload: result,
    });
    yield* recordInput(record.saveDir, pending, recorded);
    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs: [...pending.recordedInputs, recorded],
    });
  }),
);

/** Append a recorded input to the pending sidecar and advance its ordinal. */
const recordInput = (
  saveDir: string,
  pending: PendingTurnRecord,
  input: RecordedInput,
): Effect.Effect<void, CommandFailed> =>
  Effect.try({
    try: () =>
      savePendingTurn(saveDir, {
        ...pending,
        recordedInputs: [...pending.recordedInputs, input],
        nextInterruptionOrdinal: input.ordinal + 1,
      }),
    catch: (error) =>
      new CommandFailed({
        reason: "PENDING_TURN_WRITE_FAILED",
        diagnostics: [error instanceof Error ? error.message : String(error)],
      }),
  });

/**
 * `abandonPendingTurn(sessionId)` clears only the non-authoritative pending-turn
 * sidecar — no authoritative save, pointer, envelope or compatibility version
 * changes.
 */
export const abandonPendingTurnProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    const value: AbandonPendingTurnResult = { abandoned: true };
    yield* Effect.try({
      try: () => {
        clearPendingTurn(record.saveDir);
      },
      catch: (error) =>
        new CommandFailed({
          reason: "PENDING_TURN_CLEAR_FAILED",
          diagnostics: [error instanceof Error ? error.message : String(error)],
        }),
    });
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);
