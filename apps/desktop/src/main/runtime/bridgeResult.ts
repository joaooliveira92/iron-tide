import { Cause, Exit } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CommandError } from "./commandError.js";

const COMMAND_ERROR_TAGS: ReadonlySet<string> = new Set([
  "UnknownCommand",
  "NotImplemented",
  "InvalidCommandPayload",
  "CommandRejected",
  "CommandFailed",
  "SessionNotFound",
]);

export function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    typeof value._tag === "string" &&
    COMMAND_ERROR_TAGS.has(value._tag)
  );
}

export function projectCommandError<A>(error: CommandError): BridgeResult<A> {
  switch (error._tag) {
    case "UnknownCommand":
      return {
        outcome: "error",
        reason: "UNKNOWN_COMMAND",
        diagnostics: [`No such campaign command: ${error.command}`],
      };
    case "NotImplemented":
      return {
        outcome: "error",
        reason: "NOT_IMPLEMENTED",
        diagnostics: [`${error.command} is not implemented yet (desktop-mvp ticket 11 scaffold).`],
      };
    case "InvalidCommandPayload":
      return { outcome: "error", reason: "INVALID_PAYLOAD", diagnostics: error.issues };
    case "CommandRejected":
      return { outcome: "rejected", reason: error.reason, diagnostics: error.diagnostics };
    case "CommandFailed":
      return { outcome: "error", reason: error.reason, diagnostics: error.diagnostics };
    case "SessionNotFound":
      return {
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
        diagnostics: [`No active campaign session ${error.sessionId}`],
      };
  }
}

export function projectCommandExit<A>(
  exit: Exit.Exit<BridgeResult<A>, CommandError>,
): BridgeResult<A> {
  if (Exit.isSuccess(exit)) return exit.value;
  const error = Cause.squash(exit.cause);
  if (isCommandError(error)) return projectCommandError<A>(error);
  return { outcome: "error", reason: "INTERNAL", diagnostics: [String(error)] };
}
