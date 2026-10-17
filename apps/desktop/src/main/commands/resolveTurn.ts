import { Effect, Schema } from "effect";
import {
  computeInterruptionId,
  computeOrderedInputsHash,
  computeTurnId,
  makeRecordedInput,
  type BattleResultInput,
  type DecisionAnswer,
  type InterruptionRequest,
  type PendingDecision,
  type RecordedInput,
} from "@bluewave/messages";
import type {
  AbandonPendingTurnResult,
  InterruptionRequestDto,
  PendingTurnDto,
  ReadPendingTurnResult,
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
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { DecisionSource } from "../runtime/decisionSource.js";
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
  contentHashes: { readonly shipBuilding: string; readonly armament: string },
): readonly RecordedInput[] | null {
  // Turn identity is fixed before any interruption is answered, so the inputs
  // accumulated while suspended must NOT enter it: doing so would change every
  // interruption's id on resume (D-12 "stable identity under re-execution").
  const expectedTurnId = computeTurnId({
    campaignId: session.snapshot.campaignId,
    startingRevision: Number(session.snapshot.turnNumber),
    committedOrderHash: pending.committedOrderHash,
    orderedInputsHash: computeOrderedInputsHash([]),
  });
  const valid =
    expectedTurnId === pending.turnId &&
    pending.contentHashes.contentArtifact === session.rawHash &&
    pending.contentHashes.shipBuilding === contentHashes.shipBuilding &&
    pending.contentHashes.armament === contentHashes.armament &&
    isPendingTurnValid(pending, {
      campaignId: session.snapshot.campaignId,
      startingRevision: Number(session.snapshot.turnNumber),
      rulesetVersion: session.snapshot.rulesetVersion,
      compatibilityVersion: session.snapshot.compatibilityVersion,
      turnId: expectedTurnId,
    });
  return valid ? pending.recordedInputs : null;
}

/** Load the content identities a pending record's hashes must match to be trusted. */
const expectedContentHashes = (): Effect.Effect<
  { readonly shipBuilding: string; readonly armament: string },
  CommandFailed,
  ContentArtifact
> =>
  Effect.gen(function* () {
    const contentArtifact = yield* ContentArtifact;
    return {
      shipBuilding: yield* contentArtifact.shipBuildingContentHash(),
      armament: yield* contentArtifact.armamentContentHash(),
    };
  });

/**
 * The outstanding interruption the pending sidecar is waiting on, recomputed
 * from its (load-validated) `turnId` and stored phase/ordinal/subjectKey. `null`
 * when the record carries no outstanding request (e.g. a trailing-input
 * suspension). The command boundary matches an answer/submission against this so
 * a mismatched `interruptionId` is rejected before it is recorded (T7).
 */
function outstandingInterruption(
  pending: PendingTurnRecord,
): { readonly kind: "decision" | "battle"; readonly interruptionId: string } | null {
  const outstanding = pending.outstanding;
  if (outstanding === undefined) return null;
  return {
    kind: outstanding.kind,
    interruptionId: computeInterruptionId({
      turnId: pending.turnId,
      phase: outstanding.phase,
      ordinal: outstanding.ordinal,
      subjectKey: outstanding.subjectKey,
    }),
  };
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
      const hashes = yield* expectedContentHashes();
      const validated = validatePending(pending, record.state, hashes);
      if (validated === null) {
        const unavailable: ResolveTurnResult = { status: "unavailable" };
        return { outcome: "success" as const, value: unavailable, diagnostics: [] };
      }
      recordedInputs = validated;
    }

    const decisionSource = yield* DecisionSource;
    const pendingDecisions = yield* decisionSource.pendingDecisions(payload.sessionId);
    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs,
      pendingDecisions,
    });
  }),
);

const finishTransaction = (input: {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly recordedInputs: readonly RecordedInput[];
  readonly pendingDecisions: readonly PendingDecision[];
}) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(input.sessionId);
    const outcome = yield* runTurnTransaction({
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      recordedInputs: input.recordedInputs,
      pendingDecisions: input.pendingDecisions,
      allowInterruptions: true,
    });

    switch (outcome.kind) {
      case "completed": {
        // The turn is finished; a leftover pending-turn sidecar must never
        // survive to prompt a resume of the already-resolved month. Clearing is
        // best-effort — the authoritative save is already committed.
        yield* Effect.try({
          try: () => clearPendingTurn(record.saveDir),
          catch: (error) =>
            new CommandFailed({
              reason: "PENDING_TURN_CLEAR_FAILED",
              diagnostics: [error instanceof Error ? error.message : String(error)],
            }),
        }).pipe(Effect.catchTag("CommandFailed", () => Effect.void));
        const value: ResolveTurnResult = {
          status: "completed",
          summary: outcome.summary,
          closing: {
            revision: outcome.response.closingSnapshot.revision,
            month: outcome.response.closingSnapshot.month,
            closingTreasury: outcome.response.report.closingTreasury,
          },
        };
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
    const outstanding = outstandingInterruption(pending);
    if (outstanding === null || outstanding.kind !== "decision") {
      return {
        outcome: "error" as const,
        reason: "NO_OUTSTANDING_DECISION",
        diagnostics: [`Session ${payload.sessionId} is not awaiting a decision`],
      };
    }
    if (payload.interruptionId !== outstanding.interruptionId) {
      return {
        outcome: "error" as const,
        reason: "INTERRUPTION_ID_MISMATCH",
        diagnostics: [
          `Decision answer for session ${payload.sessionId} does not match the outstanding interruption`,
        ],
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
    const decisionSource = yield* DecisionSource;
    const pendingDecisions = yield* decisionSource.pendingDecisions(payload.sessionId);
    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs: [...pending.recordedInputs, recorded],
      pendingDecisions,
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
    const outstanding = outstandingInterruption(pending);
    if (outstanding === null || outstanding.kind !== "battle") {
      return {
        outcome: "error" as const,
        reason: "NO_OUTSTANDING_BATTLE",
        diagnostics: [`Session ${payload.sessionId} is not awaiting a battle result`],
      };
    }
    if (payload.interruptionId !== outstanding.interruptionId) {
      return {
        outcome: "error" as const,
        reason: "INTERRUPTION_ID_MISMATCH",
        diagnostics: [
          `Battle result for session ${payload.sessionId} does not match the outstanding interruption`,
        ],
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
    const decisionSource = yield* DecisionSource;
    const pendingDecisions = yield* decisionSource.pendingDecisions(payload.sessionId);
    return yield* finishTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      recordedInputs: [...pending.recordedInputs, recorded],
      pendingDecisions,
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
 * `readPendingTurn(sessionId) -> { pending }` reports whether a suspended turn
 * exists for the campaign, without touching it. The renderer uses it on load to
 * prompt the player to resume.
 */
export const readPendingTurnProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    const pending = loadPendingTurn(record.saveDir);
    if (pending === null) {
      const value: ReadPendingTurnResult = { pending: null, valid: false };
      return { outcome: "success" as const, value, diagnostics: [] };
    }
    const hashes = yield* expectedContentHashes();
    const value: ReadPendingTurnResult = {
      pending: toPendingTurnDto(pending),
      valid: validatePending(pending, record.state, hashes) !== null,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);

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
