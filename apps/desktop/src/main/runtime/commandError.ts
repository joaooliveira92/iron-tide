import { Data } from "effect";

export class UnknownCommand extends Data.TaggedError("UnknownCommand")<{
  readonly command: string;
}> {}

export class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly command: string;
}> {}

export class InvalidCommandPayload extends Data.TaggedError("InvalidCommandPayload")<{
  readonly issues: readonly string[];
}> {}

export class CommandRejected extends Data.TaggedError("CommandRejected")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

export class CommandFailed extends Data.TaggedError("CommandFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: string;
}> {}

export type CommandError =
  | UnknownCommand
  | NotImplemented
  | InvalidCommandPayload
  | CommandRejected
  | CommandFailed
  | SessionNotFound;
