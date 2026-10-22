import { isBluewaveError, type BluewaveError } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";

export type CombatOperationResult<T> =
  | { outcome: "success"; value: T }
  | { outcome: "validation-error" }
  | { outcome: "internal-error" };

export function reportBluewaveError(
  error: BluewaveError,
  collector: DiagnosticCollector,
  stage: string,
): void {
  const remediation =
    Object.keys(error.context).length > 0 ? JSON.stringify(error.context) : undefined;
  collector.addError(error.message, error.message, { stage, remediation });
}

export function runCombatOperation<T>(
  fn: () => T,
  collector: DiagnosticCollector,
  stage: string,
): CombatOperationResult<T> {
  try {
    return { outcome: "success", value: fn() };
  } catch (err) {
    if (isBluewaveError(err)) {
      reportBluewaveError(err, collector, stage);
      return { outcome: "validation-error" };
    }
    const message = err instanceof Error ? err.message : String(err);
    collector.addError("INTERNAL_ERROR", message, { stage });
    return { outcome: "internal-error" };
  }
}
