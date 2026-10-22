import { Effect, Result, Schema, SchemaIssue } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  NO_PAYLOAD,
  campaignCommandShapes,
  type CampaignCommandMap,
  type CampaignCommandName,
} from "../../shared/campaign-command-descriptors.js";
import { InvalidCommandPayload, type CommandError } from "./commandError.js";
import type { CommandEnv } from "./desktopMainLayer.js";

export type CommandBodyEffect = Effect.Effect<BridgeResult<unknown>, CommandError, CommandEnv>;

export type CommandHandler<N extends CampaignCommandName> = (
  payload: CampaignCommandMap[N]["payload"],
) => CommandBodyEffect;

export type CommandHandlers = { readonly [N in CampaignCommandName]: CommandHandler<N> };

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

function issueMessages(error: Schema.SchemaError): readonly string[] {
  return formatIssues(error.issue).issues.map((issue) => issue.message);
}

export type CommandProgram = (payload: unknown) => CommandBodyEffect;

export function bindCommandProgram<N extends CampaignCommandName>(
  name: N,
  handler: CommandHandler<N>,
): CommandProgram {
  return (payload) => runCommandHandler(name, handler, payload);
}

type ErasedHandler = (payload: unknown) => CommandBodyEffect;

export function runCommandHandler(
  name: CampaignCommandName,
  handler: (payload: never) => CommandBodyEffect,
  payload: unknown,
): CommandBodyEffect {
  const shape = campaignCommandShapes[name];
  const run = handler as ErasedHandler;
  if (shape.payload === NO_PAYLOAD) {
    return run(undefined);
  }
  const decoded = Schema.decodeUnknownResult(
    shape.payload,
    shape.strict ? { onExcessProperty: "error" } : undefined,
  )(payload);
  if (Result.isFailure(decoded)) {
    return Effect.fail(new InvalidCommandPayload({ issues: issueMessages(decoded.failure) }));
  }
  return run(decoded.success);
}
