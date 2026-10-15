import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema, SchemaIssue } from "effect";

import type { ContentSchema } from "./decode.js";

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

/**
 * Decode untrusted `data` against an Effect `Schema` boundary and project every
 * issue onto a `SCHEMA` diagnostic. Closed-by-default: unknown/excess fields are
 * rejected (`onExcessProperty: "error"`), matching the previous Zod `.strict()`
 * behavior. Returns `undefined` (and emits diagnostics) on failure.
 */
export function validateAgainstSchema<A>(
  data: unknown,
  schema: ContentSchema<A>,
  label: string,
  sourcePath: string,
  collector: DiagnosticCollector,
): A | undefined {
  const result = Schema.decodeUnknownResult(schema, parseOptions)(data);
  if (Result.isFailure(result)) {
    for (const issue of formatter(result.failure.issue).issues) {
      const pointer = (issue.path ?? []).filter(
        (key): key is string | number => typeof key === "string" || typeof key === "number",
      );
      const path = pointer.length > 0 ? pointer.join(".") : "(root)";
      collector.addError("SCHEMA", `Validation failed for ${label}.${path}: ${issue.message}`, {
        stage: "validate",
        sourceLocation: { path: sourcePath, line: 1 },
        remediation: issue.message === "Missing key" ? `Add missing field '${path}'` : undefined,
      });
    }
    return undefined;
  }
  return result.success;
}
