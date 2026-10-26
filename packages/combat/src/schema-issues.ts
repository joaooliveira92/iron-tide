import { BluewaveError } from "@bluewave/contracts";
import { Result, Schema, SchemaIssue } from "effect";

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

const strictDecodeOptions = { onExcessProperty: "error", errors: "all" } as const;

export interface DecodeContractOptions {
  readonly message?: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly includeValue?: boolean;
}

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

export function decodeContract<A>(
  schema: Schema.ConstraintDecoder<A, never>,
  code: string,
  value: unknown,
  options: DecodeContractOptions = {},
): A {
  const result = Schema.decodeUnknownResult(schema, strictDecodeOptions)(value);
  if (Result.isFailure(result)) {
    const issues = formatContractIssues(result.failure);
    const first = issues[0];
    const context: Record<string, unknown> = { ...options.context };
    context.code = code;
    context.field = first?.path ?? "unknown";
    context.reason = first?.message ?? "contract validation failed";
    context.issues = issues;
    if (options.includeValue !== false) context.value = value;
    throw new BluewaveError(options.message ?? code, context);
  }
  return result.success;
}
