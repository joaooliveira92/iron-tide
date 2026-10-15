import { Data } from "effect";

/**
 * In-process tagged error for the AI envelope factory and the planning helpers.
 *
 * `Data.TaggedError` (not `Schema.TaggedError`) is deliberate: these failures
 * are raised and handled in-process and never cross a wire/serialization
 * boundary, so the envelope wire format is unchanged (`MIG-WIRE-3`) and the
 * package stays runtime-free (`MIG-RUNTIME-1`) — only `Data` is imported.
 * AI decisions and outcomes are unchanged (`MIG-DET-1`); the `message` text is
 * carried verbatim from the previous plain `Error` so callers that match on it
 * are unaffected.
 */
export class AiError extends Data.TaggedError("AiError")<{
  readonly message: string;
}> {}
