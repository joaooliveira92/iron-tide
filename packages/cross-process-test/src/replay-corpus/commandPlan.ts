import { Data, Result, Schema, SchemaIssue } from "effect";

import { COMMAND_KINDS, type CommandPlan } from "./fuzz.js";

export class CommandPlanError extends Data.TaggedError("CommandPlanError")<{
  readonly message: string;
}> {}

const CommandPickSchema = Schema.Struct({
  kind: Schema.Literals(COMMAND_KINDS),
  draws: Schema.Array(Schema.Finite),
});

const CommandPlanSchema = Schema.Array(Schema.Array(CommandPickSchema));

const decodePlan = Schema.decodeUnknownResult(CommandPlanSchema, {
  onExcessProperty: "error",
  errors: "all",
});
const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeCommandPlan(text: string): Result.Result<CommandPlan, CommandPlanError> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Result.fail(new CommandPlanError({ message: "the plan is not valid JSON" }));
  }
  const decoded = decodePlan(json);
  if (Result.isFailure(decoded)) {
    const issues = formatter(decoded.failure.issue).issues.map((issue) => {
      const path = (issue.path ?? []).map(String).join(".");
      return `${path === "" ? "(root)" : path}: ${issue.message}`;
    });
    return Result.fail(
      new CommandPlanError({ message: `the plan failed validation: ${issues.join("; ")}` }),
    );
  }
  return Result.succeed(decoded.success);
}
