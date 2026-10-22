import { Data } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";

export class InvalidPreferencesPayload extends Data.TaggedError("InvalidPreferencesPayload")<{
  readonly issues: readonly string[];
}> {}

export class PreferencesReadFailed extends Data.TaggedError("PreferencesReadFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

export class PreferencesWriteFailed extends Data.TaggedError("PreferencesWriteFailed")<{
  readonly reason: string;
  readonly diagnostics: readonly string[];
}> {}

export type PreferencesError =
  | InvalidPreferencesPayload
  | PreferencesReadFailed
  | PreferencesWriteFailed;

const PREFERENCES_ERROR_TAGS: ReadonlySet<string> = new Set([
  "InvalidPreferencesPayload",
  "PreferencesReadFailed",
  "PreferencesWriteFailed",
]);

export function isPreferencesError(value: unknown): value is PreferencesError {
  return (
    typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    typeof value._tag === "string" &&
    PREFERENCES_ERROR_TAGS.has(value._tag)
  );
}

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
