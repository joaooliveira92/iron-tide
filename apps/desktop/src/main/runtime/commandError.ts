// The desktop main process's command error channel (Effect runtime adoption,
// INC-1; ADR-0159). In-process failures of the `campaign:execute` dispatch flow
// carry a stable `_tag` and are discriminated by `_tag`/`Effect.catchTag`
// (RULES.md §Errors). They are projected to the plain `BridgeResult` envelope at
// the IPC wire boundary, never thrown across it.
import { Data } from "effect";

/** The command name is not in the campaign-command contract. */
export class UnknownCommand extends Data.TaggedError("UnknownCommand")<{
  readonly command: string;
}> {}

/** A known command with no registered handler yet. */
export class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly command: string;
}> {}

/** The wire payload failed the command's strict schema decode. */
export class InvalidCommandPayload extends Data.TaggedError("InvalidCommandPayload")<{
  readonly issues: readonly string[];
}> {}

/** A business refusal that the renderer treats as a recoverable `rejected`. */
export class CommandRejected extends Data.TaggedError("CommandRejected")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

/** An unexpected/transport failure of a command flow. */
export class CommandFailed extends Data.TaggedError("CommandFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

/** The requested campaign session is not open in this process. */
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: string;
}> {}

/** Every failure the dispatch flow can carry on its error channel. */
export type CommandError =
  | UnknownCommand
  | NotImplemented
  | InvalidCommandPayload
  | CommandRejected
  | CommandFailed
  | SessionNotFound;
