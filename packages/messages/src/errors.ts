import { Data } from "effect";

/** A projection input failed strict validation before projection ran. */
export class InvalidProjectionInputError extends Data.TaggedError("InvalidProjectionInputError")<{
  readonly message: string;
}> {}

/** A recorded turn input could not be consumed (missing, extra, or mismatched). */
export class InterruptionInputError extends Data.TaggedError("InterruptionInputError")<{
  readonly turnId: string;
  readonly ordinal: number;
  readonly reason: "missing" | "extra" | "hash-mismatch";
  readonly message: string;
}> {}

/** An interruption request is malformed for the phase that raised it. */
export class InvalidInterruptionError extends Data.TaggedError("InvalidInterruptionError")<{
  readonly message: string;
}> {}
