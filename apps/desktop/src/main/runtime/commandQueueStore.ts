import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { Context, Effect, Layer } from "effect";
import {
  clearPendingEnvelopes,
  deletePendingEnvelope,
  fingerprintOfBody,
  lookupPendingEnvelope,
  pendingEntries,
  pendingEnvelopesForExecution,
  queuePendingEnvelope,
  restorePendingQueue,
  type PendingCommandEntry,
} from "../pendingCommands.js";

export class CommandQueueStore extends Context.Service<
  CommandQueueStore,
  {
    readonly fingerprintOfBody: (body: CommandBody) => string;
    readonly queue: (sessionId: string, entry: PendingCommandEntry) => Effect.Effect<void>;
    readonly lookup: (
      sessionId: string,
      transportRequestId: string,
    ) => Effect.Effect<PendingCommandEntry | undefined>;
    readonly entries: (sessionId: string) => Effect.Effect<readonly PendingCommandEntry[]>;
    readonly forExecution: (
      sessionId: string,
      snapshot: CampaignSnapshot,
    ) => Effect.Effect<readonly CommandEnvelope<CommandBody>[]>;
    readonly clear: (sessionId: string) => Effect.Effect<void>;
    readonly delete: (sessionId: string, transportRequestId: string) => Effect.Effect<void>;
    readonly restore: (sessionId: string) => Effect.Effect<number>;
  }
>()("bluewave/desktop/CommandQueueStore") {}

export function commandQueueStoreLayer(): Layer.Layer<CommandQueueStore> {
  return Layer.succeed(CommandQueueStore, {
    fingerprintOfBody: (body) => fingerprintOfBody(body),
    queue: (sessionId, entry) => Effect.sync(() => queuePendingEnvelope(sessionId, entry)),
    lookup: (sessionId, transportRequestId) =>
      Effect.succeed(lookupPendingEnvelope(sessionId, transportRequestId)),
    entries: (sessionId) => Effect.succeed(pendingEntries(sessionId)),
    forExecution: (sessionId, snapshot) =>
      Effect.succeed(pendingEnvelopesForExecution(sessionId, snapshot)),
    clear: (sessionId) => Effect.sync(() => clearPendingEnvelopes(sessionId)),
    delete: (sessionId, transportRequestId) =>
      Effect.sync(() => deletePendingEnvelope(sessionId, transportRequestId)),
    restore: (sessionId) => Effect.sync(() => restorePendingQueue(sessionId)),
  });
}
