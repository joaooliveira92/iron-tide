import { Data } from "effect";

export class InvalidProjectionInputError extends Data.TaggedError("InvalidProjectionInputError")<{
  readonly message: string;
}> {}

export class InterruptionInputError extends Data.TaggedError("InterruptionInputError")<{
  readonly turnId: string;
  readonly ordinal: number;
  readonly reason: "missing" | "extra" | "hash-mismatch";
  readonly message: string;
}> {}

export class InvalidInterruptionError extends Data.TaggedError("InvalidInterruptionError")<{
  readonly message: string;
}> {}
