//apps/compiler-cli/src/combatDiagnostics.ts
import { isBluewaveError, type BluewaveError } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";

export type CombatOperationResult<T> =
  | { outcome: "success"; value: T }
  | { outcome: "validation-error" }
  | { outcome: "internal-error" };

/**
 * @bluewave/combat reports failures by throwing `BluewaveError(message,
 * context)` rather than pushing into a DiagnosticCollector. `message` doubles
 * as the reason code (it's a REASON_CODES constant in most call sites, but
 * not all — resolver.ts throws free-form strings too), so it is used
 * verbatim as both the collector's `code` and `message`. `context` has no
 * dedicated DiagnosticCollector field, so it is folded into `remediation` as
 * JSON for visibility rather than silently dropped.
 */
export function reportBluewaveError(
  error: BluewaveError,
  collector: DiagnosticCollector,
  stage: string,
): void {
  const remediation =
    Object.keys(error.context).length > 0 ? JSON.stringify(error.context) : undefined;
  collector.addError(error.message, error.message, { stage, remediation });
}

/**
 * Runs a combat-engine call, translating a thrown BluewaveError into the
 * collector the rest of the CLI already reports through, and mapping any
 * other thrown error to an internal-error outcome (an engine bug, not a
 * validation failure) rather than lumping both into "validation-error".
 */
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
