import type { CommandBody, CommandEnvelope, CommandOutcome } from "@bluewave/commands";
import { CommandLedger } from "@bluewave/commands";
import { Result, Schema } from "effect";

export interface MonthInput {
  readonly schema: "month_input_v1";
  readonly commands: readonly CommandEnvelope<CommandBody>[];
  readonly commandOutcomes: readonly CommandOutcome[];
  readonly shipBuildingContentHash: string;
  readonly armamentContentHash?: string;
}

const MonthInputSchema = Schema.Struct({
  schema: Schema.Literal("month_input_v1"),
  commands: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  commandOutcomes: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  shipBuildingContentHash: Schema.String.check(Schema.isMinLength(1)),
  armamentContentHash: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
});

export function monthInputOf(
  commands: readonly CommandEnvelope<CommandBody>[],
  outcomes: readonly CommandOutcome[],
  shipBuildingContentHash: string,
  armamentContentHash?: string,
): MonthInput {
  return {
    schema: "month_input_v1",
    commands,
    commandOutcomes: outcomes,
    shipBuildingContentHash,
    ...(armamentContentHash !== undefined ? { armamentContentHash } : {}),
  };
}

export function parseMonthInput(value: unknown): MonthInput | null {
  const parsed = Schema.decodeUnknownResult(MonthInputSchema)(value);
  return Result.isSuccess(parsed) ? (parsed.success as unknown as MonthInput) : null;
}

export function ledgerOf(input: MonthInput): CommandLedger {
  const ledger = new CommandLedger();
  for (const outcome of input.commandOutcomes) ledger.add(outcome);
  return ledger;
}
