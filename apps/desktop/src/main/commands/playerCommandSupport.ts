import { CommandLifecycle, type CommandBody, type CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandQueue } from "../runtime/commandQueue.js";
import type { CommandError } from "../runtime/commandError.js";
import { deterministicTimestamp, verifyEnvelope } from "./commandEnvelope.js";

export { currentRevision, verifyEnvelope, type EnvelopeVerification } from "./commandEnvelope.js";

const PLAYER_ENVELOPE_VERSION = "0.1.0" as const;

export interface QueuedCommandOutcome<Type extends string> {
  readonly commandId: string;
  readonly bodyType: Type;
  readonly appliedOnNextTurn: true;
}

export function buildPlayerEnvelope<Body extends CommandBody>(
  record: CampaignSessionRecord,
  body: Body,
  discriminator: string,
): CommandEnvelope<Body> {
  const snapshot = record.state.snapshot;
  const idempotencyKey = [
    encodeURIComponent(snapshot.campaignId),
    String(Number(snapshot.turnNumber)),
    encodeURIComponent(record.playerSlotId),
    body.type,
    encodeURIComponent(discriminator),
  ].join("/");
  const commandId = `player-${sha256Hex(`v0:${idempotencyKey}`).slice(0, 40)}`;

  return {
    commandId,
    version: PLAYER_ENVELOPE_VERSION,
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey,
    timestamp: deterministicTimestamp(record),
    body,
    issuerClass: "PLAYER",
    issuerParticipantId: record.playerSlotId,
  };
}

export interface PlayerCommandRequest<Body extends CommandBody> {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly build: (record: CampaignSessionRecord) => {
    readonly body: Body;
    readonly discriminator: string;
  };
}

export function submitPlayerCommand<Body extends CommandBody>(
  request: PlayerCommandRequest<Body>,
): Effect.Effect<
  BridgeResult<QueuedCommandOutcome<Body["type"]>>,
  CommandError,
  CampaignSessionStore | CommandQueue
> {
  return Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueue;
    const record = yield* sessions.get(request.sessionId);

    const verified = verifyEnvelope(record, request.expectedRevision);
    if (verified.outcome !== "success") return verified;

    const { body, discriminator } = request.build(record);
    const envelope = buildPlayerEnvelope(record, body, discriminator);
    const outcome: QueuedCommandOutcome<Body["type"]> = {
      commandId: envelope.commandId,
      bodyType: body.type,
      appliedOnNextTurn: true,
    };

    const queued = yield* queue.queueOrReplay(
      request.sessionId,
      { transportRequestId: request.transportRequestId, envelope },
      () => {
        const validation = new CommandLifecycle().validate(envelope, record.state.snapshot);
        if (validation.ok) return undefined;
        if (validation.outcome.type === "rejected") {
          return {
            reason: validation.outcome.diagnostic.code,
            diagnostics: [validation.outcome.diagnostic.message],
          };
        }
        return {
          reason: "COMMAND_REJECTED",
          diagnostics: [`Engine rejected command ${envelope.commandId}`],
        };
      },
    );
    if (queued.kind === "replayed") {
      return {
        outcome: "success",
        value: { ...outcome, commandId: queued.prior.envelope.commandId },
        diagnostics: [],
      };
    }
    if (queued.kind !== "queued") return { outcome: "rejected", ...queued.refusal };

    return { outcome: "success", value: outcome, diagnostics: [] };
  });
}
