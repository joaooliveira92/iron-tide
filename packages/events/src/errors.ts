import type { SafeInt } from "@bluewave/contracts";
import { Data } from "effect";

/**
 * In-process tagged errors for the event ledger and the explanation builder.
 *
 * `Data.TaggedError` (not `Schema.TaggedError`) is deliberate: these failures
 * are raised and handled in-process and never cross a wire/serialization
 * boundary, so the event envelope wire format is unchanged (`MIG-WIRE-3`) and
 * the package stays runtime-free (`MIG-RUNTIME-1`) — only `Data` is imported.
 * The `_tag` discriminator lets a later wave recover with `Effect.catchTag`
 * without this package importing the runtime.
 *
 * The `message` text is carried verbatim from the previous plain
 * `Error`/`TypeError` so callers that match on it are unaffected.
 */
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
