import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { Effect, type ManagedRuntime } from "effect";
import type { CampaignCommandName } from "../shared/campaign-command-descriptors.js";
import { commandHandlers } from "./campaignBridge.js";
import { CommandQueue } from "./runtime/commandQueue.js";
import type { CommandEnv } from "./runtime/desktopMainLayer.js";
import {
  runCommandHandler,
  type CommandBodyEffect,
  type CommandProgram,
} from "./runtime/commandProgram.js";

export type AnyCommandHandler = (payload: never) => CommandBodyEffect;

export function programFor(handler: AnyCommandHandler): CommandProgram {
  const entry = (
    Object.entries(commandHandlers) as [CampaignCommandName, AnyCommandHandler][]
  ).find(([, registered]) => registered === handler);
  if (entry === undefined) {
    throw new Error("handler is not registered in commandHandlers");
  }
  return (payload) => runCommandHandler(entry[0], handler, payload);
}

export function queuedEnvelopes<Body extends CommandBody = CommandBody>(
  runtime: ManagedRuntime.ManagedRuntime<CommandEnv, never>,
  sessionId: string,
  snapshot: CampaignSnapshot,
): CommandEnvelope<Body>[] {
  return [
    ...runtime.runSync(
      Effect.gen(function* () {
        const queue = yield* CommandQueue;
        return yield* queue.forExecution(sessionId, snapshot);
      }),
    ),
  ] as CommandEnvelope<Body>[];
}
