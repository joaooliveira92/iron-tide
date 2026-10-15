import type { CommandBody, CommandEnvelope, CommandOutcome } from "@bluewave/commands";
import { CommandLedger } from "@bluewave/commands";
import { Result, Schema } from "effect";

/**
 * What one executed month ran on, stored beside the save that closes it (`SaveStore` month input), so `replayCampaign`
 * can run the same month again: the player's command envelopes exactly as executed (snapshot hashes refreshed at drain),
 * the engine's outcome for each, and the hash of the ship-building content the engine was given.
 */
export interface MonthInput {
  readonly schema: "month_input_v1";
  readonly commands: readonly CommandEnvelope<CommandBody>[];
  readonly commandOutcomes: readonly CommandOutcome[];
  readonly shipBuildingContentHash: string;
  /** First-class armament content hash (ADR-0093 Step 3); absent on saves written before the cut-over. */
  readonly armamentContentHash?: string;
}

// Saves are trust-class data: check the outer shape here; the engine validates every envelope again when it replays.
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

/** Parses a stored month input; null when it is not a `month_input_v1` record. */
export function parseMonthInput(value: unknown): MonthInput | null {
  const parsed = Schema.decodeUnknownResult(MonthInputSchema)(value);
  // Accepted narrowing (ticket INC-3): the schema deliberately models the
  // trust-class array elements as `Record<string, unknown>` (see JSDoc above);
  // the engine re-validates every envelope when the month replays, so this
  // nominal assertion is the boundary seam, not a substitute for validation.
  return Result.isSuccess(parsed) ? (parsed.success as unknown as MonthInput) : null;
}

/** The original command ledger of a month, rebuilt from its stored outcomes, for `ReplayVerifier.verify`. */
export function ledgerOf(input: MonthInput): CommandLedger {
  const ledger = new CommandLedger();
  for (const outcome of input.commandOutcomes) ledger.add(outcome);
  return ledger;
}
