import type { SafeInt } from "@bluewave/contracts";
import { Data } from "effect";

export class DuplicateEventIdError extends Data.TaggedError("DuplicateEventIdError")<{
  readonly eventId: string;
  readonly message: string;
}> {}

export class EventSequenceNotIncreasingError extends Data.TaggedError(
  "EventSequenceNotIncreasingError",
)<{
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly sequenceNumber: SafeInt;
  readonly previousSequence: SafeInt;
  readonly message: string;
}> {}

export class NonFiniteNumberError extends Data.TaggedError("NonFiniteNumberError")<{
  readonly valueName: string;
  readonly message: string;
}> {}

export class EmptyFormulaIdentifierError extends Data.TaggedError("EmptyFormulaIdentifierError")<{
  readonly message: string;
}> {}
