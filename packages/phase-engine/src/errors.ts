import { Data } from "effect";

export class PhaseEngineError extends Data.TaggedError("PhaseEngineError")<{
  readonly message: string;
  readonly code?: string;
}> {}
