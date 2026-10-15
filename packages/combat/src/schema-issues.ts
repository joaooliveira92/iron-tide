import { SchemaIssue } from "effect";
import type { Schema } from "effect";

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export interface ContractIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Projects an Effect v4 `SchemaError` issue tree onto Zod-style per-field
 * `{ path, message }` entries. `path` joins nested/array keys with `.`, matching
 * the previous Zod `issue.path.join(".")`; a root-level failure yields `""`.
 *
 * Shared by the `@bluewave/combat` contract validators so every boundary maps
 * schema failures to the existing `BluewaveError` shape consistently.
 */
export function formatContractIssues(error: Schema.SchemaError): readonly ContractIssue[] {
  return formatter(error.issue).issues.map((issue) => ({
    path: (issue.path ?? [])
      .filter((key): key is string | number => typeof key === "string" || typeof key === "number")
      .join("."),
    message: issue.message,
  }));
}
