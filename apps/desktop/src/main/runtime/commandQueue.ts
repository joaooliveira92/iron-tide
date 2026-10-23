import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Context, Effect, Layer, Schema } from "effect";
import { CampaignSessionStore } from "./campaignSessionStore.js";
import { CommandFailed } from "./commandError.js";
import { defineSidecar } from "./sidecar.js";

export interface PendingCommandEntry {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<CommandBody>;
  readonly payloadFingerprint: string;
}

export interface PendingSubmission<Body extends CommandBody> {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<Body>;
}

export interface QueueRefusal {
  readonly reason: string;
  readonly diagnostics: readonly string[];
}

export type QueueOutcome =
  | { readonly kind: "queued" }
  | { readonly kind: "replayed"; readonly prior: PendingCommandEntry }
  | {
      readonly kind: "conflict";
      readonly prior: PendingCommandEntry;
      readonly refusal: QueueRefusal;
    }
  | { readonly kind: "refused"; readonly refusal: QueueRefusal };

export const PENDING_COMMANDS_FILENAME = "pending-commands.json";
const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";

export function fingerprintOfBody(body: CommandBody): string {
  return sha256Hex(canonicalSerialize(body));
}

function isEnvelope(value: unknown): value is CommandEnvelope<CommandBody> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const StoredQueueSchema = Schema.Struct({
  schema: Schema.Literal("pending_commands_v1"),
  turnNumber: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  entries: Schema.Array(
    Schema.Struct({
      transportRequestId: Schema.String.check(Schema.isMinLength(1)),
      envelope: Schema.declare(isEnvelope),
      payloadFingerprint: Schema.String.check(Schema.isMinLength(1)),
    }),
  ).check(Schema.isMaxLength(1000)),
});

type StoredQueue = typeof StoredQueueSchema.Type;

const queueSidecar = defineSidecar<StoredQueue, StoredQueue>({
  filename: PENDING_COMMANDS_FILENAME,
  schema: StoredQueueSchema,
  empty: () => ({ schema: "pending_commands_v1", turnNumber: 0, entries: [] }),
  resolve: (stored) => stored,
});

export class CommandQueue extends Context.Service<
  CommandQueue,
  {
    readonly queueOrReplay: <Body extends CommandBody>(
      sessionId: string,
      submission: PendingSubmission<Body>,
      admit?: () => QueueRefusal | undefined,
    ) => Effect.Effect<QueueOutcome, CommandFailed>;
    readonly entries: (sessionId: string) => Effect.Effect<readonly PendingCommandEntry[]>;
    readonly forExecution: (
      sessionId: string,
      snapshot: CampaignSnapshot,
    ) => Effect.Effect<readonly CommandEnvelope<CommandBody>[]>;
    readonly clear: (sessionId: string) => Effect.Effect<void, CommandFailed>;
    readonly delete: (
      sessionId: string,
      transportRequestId: string,
    ) => Effect.Effect<void, CommandFailed>;
    readonly restore: (sessionId: string) => Effect.Effect<number>;
  }
>()("bluewave/desktop/CommandQueue") {}

interface QueuePersistence {
  readonly save: (
    sessionId: string,
    entries: readonly PendingCommandEntry[],
  ) => Effect.Effect<void, CommandFailed>;
  readonly load: (sessionId: string) => Effect.Effect<readonly PendingCommandEntry[]>;
}

function makeCommandQueue(
  persistence: QueuePersistence,
): Context.Service.Shape<typeof CommandQueue> {
  const bySession = new Map<string, Map<string, PendingCommandEntry>>();
  const entriesOf = (sessionId: string): PendingCommandEntry[] => [
    ...(bySession.get(sessionId)?.values() ?? []),
  ];
  const persist = (sessionId: string) => persistence.save(sessionId, entriesOf(sessionId));

  return {
    queueOrReplay: (sessionId, submission, admit) =>
      Effect.gen(function* () {
        const payloadFingerprint = fingerprintOfBody(submission.envelope.body);
        const prior = bySession.get(sessionId)?.get(submission.transportRequestId);
        if (prior !== undefined) {
          if (prior.payloadFingerprint === payloadFingerprint) {
            return { kind: "replayed", prior } satisfies QueueOutcome;
          }
          return {
            kind: "conflict",
            prior,
            refusal: {
              reason: IDEMPOTENCY_CONFLICT,
              diagnostics: [
                `transportRequestId ${submission.transportRequestId} was already used by command ${prior.envelope.commandId}`,
              ],
            },
          } satisfies QueueOutcome;
        }
        const refusal = admit?.();
        if (refusal !== undefined) return { kind: "refused", refusal } satisfies QueueOutcome;

        const queue = bySession.get(sessionId) ?? new Map<string, PendingCommandEntry>();
        queue.set(submission.transportRequestId, {
          transportRequestId: submission.transportRequestId,
          envelope: submission.envelope,
          payloadFingerprint,
        });
        bySession.set(sessionId, queue);
        yield* persist(sessionId).pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              queue.delete(submission.transportRequestId);
              if (queue.size === 0) bySession.delete(sessionId);
            }),
          ),
        );
        return { kind: "queued" } satisfies QueueOutcome;
      }),
    entries: (sessionId) => Effect.sync(() => entriesOf(sessionId)),
    forExecution: (sessionId, snapshot) =>
      Effect.sync(() => {
        const pending = entriesOf(sessionId);
        if (pending.length === 0) return [];
        const expectedSnapshotHash = sha256Hex(canonicalSerialize(snapshot));
        return pending.map((queued) => ({ ...queued.envelope, expectedSnapshotHash }));
      }),
    clear: (sessionId) =>
      Effect.suspend(() => {
        bySession.delete(sessionId);
        return persist(sessionId);
      }),
    delete: (sessionId, transportRequestId) =>
      Effect.suspend(() => {
        const queue = bySession.get(sessionId);
        if (queue === undefined) return Effect.void;
        queue.delete(transportRequestId);
        if (queue.size === 0) bySession.delete(sessionId);
        return persist(sessionId);
      }),
    restore: (sessionId) =>
      Effect.gen(function* () {
        const restored = yield* persistence.load(sessionId);
        const queue = bySession.get(sessionId) ?? new Map<string, PendingCommandEntry>();
        for (const entry of restored) queue.set(entry.transportRequestId, entry);
        bySession.set(sessionId, queue);
        return restored.length;
      }),
  };
}

export function commandQueueLayer(): Layer.Layer<CommandQueue, never, CampaignSessionStore> {
  return Layer.effect(
    CommandQueue,
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const locate = (sessionId: string) =>
        sessions
          .get(sessionId)
          .pipe(Effect.catchTag("SessionNotFound", () => Effect.succeed(undefined)));
      return makeCommandQueue({
        save: (sessionId, entries) =>
          Effect.gen(function* () {
            const record = yield* locate(sessionId);
            if (record === undefined) return;
            yield* Effect.try({
              try: () => {
                if (entries.length === 0) {
                  queueSidecar.remove(record.saveDir);
                  return;
                }
                queueSidecar.write(record.saveDir, {
                  schema: "pending_commands_v1",
                  turnNumber: Number(record.state.snapshot.turnNumber),
                  entries,
                });
              },
              catch: (error) =>
                new CommandFailed({
                  reason: "PENDING_COMMANDS_WRITE_FAILED",
                  diagnostics: [error instanceof Error ? error.message : String(error)],
                }),
            });
          }),
        load: (sessionId) =>
          Effect.gen(function* () {
            const record = yield* locate(sessionId);
            if (record === undefined) return [];
            const reading = queueSidecar.inspect(record.saveDir, undefined);
            if (reading.kind === "missing") return [];
            const current =
              reading.kind === "present" &&
              reading.value.turnNumber === Number(record.state.snapshot.turnNumber);
            if (!current) {
              yield* Effect.try(() => queueSidecar.remove(record.saveDir)).pipe(Effect.ignore);
              return [];
            }
            return reading.value.entries.map((stored): PendingCommandEntry => ({
              transportRequestId: stored.transportRequestId,
              envelope: stored.envelope,
              payloadFingerprint: stored.payloadFingerprint,
            }));
          }),
      });
    }),
  );
}

export function commandQueueMemoryLayer(): Layer.Layer<CommandQueue> {
  return Layer.sync(CommandQueue, () =>
    makeCommandQueue({
      save: () => Effect.void,
      load: () => Effect.succeed([]),
    }),
  );
}
