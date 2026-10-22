import { SchemaIssue } from "effect";
import type { Schema } from "effect";

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export interface ContractIssue {
  readonly path: string;
  readonly message: string;
}

export function formatContractIssues(error: Schema.SchemaError): readonly ContractIssue[] {
  return formatter(error.issue).issues.map((issue) => ({
    path: (issue.path ?? [])
      .filter((key): key is string | number => typeof key === "string" || typeof key === "number")
      .join("."),
    message: issue.message,
  }));
}
