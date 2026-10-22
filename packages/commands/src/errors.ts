import type { Diagnostic } from "@bluewave/diagnostics";
import { Data } from "effect";

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly message: string;
  readonly code?: string;
  readonly diagnostics?: readonly Diagnostic[];
}> {}
