// The preferences IPC error channel (D6). In-process failures carry a stable
// `_tag` and are discriminated by `_tag` (RULES.md §Errors); they are projected
// to the plain `BridgeResult` envelope at the wire edge, never thrown across it.
import { Data } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";

/** The wire or file payload failed the strict preferences schema decode. */
export class InvalidPreferencesPayload extends Data.TaggedError("InvalidPreferencesPayload")<{
  readonly issues: readonly string[];
}> {}

/** An unexpected read failure (the tolerant read normally falls back to defaults). */
export class PreferencesReadFailed extends Data.TaggedError("PreferencesReadFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

/** A write could not be persisted atomically. */
export class PreferencesWriteFailed extends Data.TaggedError("PreferencesWriteFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

/** Every failure the preferences flow can carry on its error channel. */
export type PreferencesError =
  | InvalidPreferencesPayload
  | PreferencesReadFailed
  | PreferencesWriteFailed;

const PREFERENCES_ERROR_TAGS: ReadonlySet<string> = new Set([
  "InvalidPreferencesPayload",
  "PreferencesReadFailed",
  "PreferencesWriteFailed",
]);

/** Structural `_tag` guard (never `instanceof`; RULES.md §Errors). */
export function isPreferencesError(value: unknown): value is PreferencesError {
  return (
    typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    typeof value._tag === "string" &&
    PREFERENCES_ERROR_TAGS.has(value._tag)
  );
}

/** Maps one tagged preferences error to the stable wire envelope. */
export function projectPreferencesError<A>(error: PreferencesError): BridgeResult<A> {
  switch (error._tag) {
    case "InvalidPreferencesPayload":
      return {
        outcome: "error",
        reason: "INVALID_PREFERENCES_PAYLOAD",
        diagnostics: error.issues,
      };
    case "PreferencesReadFailed":
      return {
        outcome: "error",
        reason: "PREFERENCES_READ_FAILED",
        diagnostics: error.diagnostics,
      };
    case "PreferencesWriteFailed":
      return {
        outcome: "error",
        reason: "PREFERENCES_WRITE_FAILED",
        diagnostics: error.diagnostics,
      };
  }
}
