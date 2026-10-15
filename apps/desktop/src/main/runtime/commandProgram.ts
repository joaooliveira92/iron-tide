// The command-program adapters (INC-5; ADR-0159). A `CommandProgram` is the
// Effect-native replacement for a legacy `CampaignCommandHandler`: it decodes the
// wire payload against a strict schema, then runs a typed `Effect` program whose
// error channel is the `CommandError` union and whose environment is the desktop
// service graph. There is no legacy lift.
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

/** Adapts a typed program to a `CommandProgram`, decoding the payload first. */
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

/** Like {@link withSchema} but rejects excess keys (`onExcessProperty: "error"`). */
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

/** A program whose payload is intentionally `undefined`. */
export function payloadless(run: () => CommandBodyEffect): CommandProgram {
  return () => run();
}
