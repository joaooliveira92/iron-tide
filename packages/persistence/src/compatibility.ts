import type { DiagnosticCode } from "@bluewave/diagnostics";
import { Result } from "effect";
import { COMPATIBILITY_MISMATCH_CODE, PersistenceCompatibilityMismatchError } from "./errors.js";

export { COMPATIBILITY_MISMATCH_CODE } from "./errors.js";

export const CURRENT_COMPATIBILITY_VERSION = "5.0.0";

export const PART_MODEL_COMPATIBILITY_VERSION = "2.0.0";

export class CompatibilityChecker {
  static check(
    saveVersion: string,
    currentVersion: string = CURRENT_COMPATIBILITY_VERSION,
  ): Result.Result<void, PersistenceCompatibilityMismatchError> {
    if (saveVersion !== currentVersion) {
      return Result.fail(
        new PersistenceCompatibilityMismatchError({
          message: `Save compatibility version "${saveVersion}" does not match current engine version "${currentVersion}"`,
          stage: "persistence.load",
          remediation: "Use a compatible save file or migrate the save data.",
        }),
      );
    }
    return Result.succeed(undefined);
  }
}

export class CompatibilityError extends Error {
  readonly _tag = "CompatibilityError";
  readonly code: DiagnosticCode = COMPATIBILITY_MISMATCH_CODE;
  readonly severity = "error" as const;
  readonly stage = "persistence.load";
  constructor(
    message: string,
    public readonly saveVersion: string,
    public readonly currentVersion: string,
  ) {
    super(message);
    this.name = "CompatibilityError";
  }
}
