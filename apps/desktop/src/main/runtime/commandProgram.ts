import { Effect, Result, Schema, SchemaIssue } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { InvalidCommandPayload, type CommandError } from "./commandError.js";
import type { CommandEnv } from "./desktopMainLayer.js";

export type CommandProgram = (
  payload: unknown,
) => Effect.Effect<BridgeResult<unknown>, CommandError, CommandEnv>;

export type CommandBodyEffect = Effect.Effect<BridgeResult<unknown>, CommandError, CommandEnv>;

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

function issueMessages(error: Schema.SchemaError): readonly string[] {
  return formatIssues(error.issue).issues.map((issue) => issue.message);
}

export function withSchema<T>(
  schema: Schema.ConstraintDecoder<T, never>,
  run: (payload: T) => CommandBodyEffect,
): CommandProgram {
  return (payload) =>
    Effect.gen(function* () {
      const decoded = Schema.decodeUnknownResult(schema)(payload);
      if (Result.isFailure(decoded)) {
        return yield* new InvalidCommandPayload({ issues: issueMessages(decoded.failure) });
      }
      return yield* run(decoded.success);
    });
}

export function withStrictSchema<T>(
  schema: Schema.ConstraintDecoder<T, never>,
  run: (payload: T) => CommandBodyEffect,
): CommandProgram {
  return (payload) =>
    Effect.gen(function* () {
      const decoded = Schema.decodeUnknownResult(schema, { onExcessProperty: "error" })(payload);
      if (Result.isFailure(decoded)) {
        return yield* new InvalidCommandPayload({ issues: issueMessages(decoded.failure) });
      }
      return yield* run(decoded.success);
    });
}

export function payloadless(run: () => CommandBodyEffect): CommandProgram {
  return () => run();
}
