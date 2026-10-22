import { Effect, Schema } from "effect";
import { playerVisibleMessages, projectTurnMessages, TurnMessageSchema } from "@bluewave/messages";
import type {
  ReadTurnSummariesResult,
  TurnSummaryEntry,
  TurnSummaries,
} from "../shared/campaign-command-contract.js";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { SessionIdPayloadSchema } from "../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "./runtime/campaignSessionStore.js";
import { withSchema } from "./runtime/commandProgram.js";
import { defineSidecar, prependBounded } from "./runtime/sidecar.js";
import { TurnSummariesStore } from "./runtime/sidecarStores.js";

export const TURN_SUMMARIES_FILENAME = "turn-summaries.json";

export const TURN_SUMMARIES_LIMIT = 12;

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const TurnSummaryEntrySchema = Schema.Struct({
  turnId: nonEmpty,
  projectionVersion: nonEmpty,
  occurredAt: nonEmpty,
  rulesetVersion: nonEmpty,
  contentVersion: nonEmpty,
  messages: Schema.Array(TurnMessageSchema),
});

const TurnSummariesSchema = Schema.Struct({
  summaries: Schema.Array(TurnSummaryEntrySchema),
});

const sidecar = defineSidecar<TurnSummaries, TurnSummaries>({
  filename: TURN_SUMMARIES_FILENAME,
  schema: TurnSummariesSchema,
  decodeOptions: { onExcessProperty: "error" },
  space: 2,
  empty: emptyTurnSummaries,
  resolve: (stored) => stored,
});

export function emptyTurnSummaries(): TurnSummaries {
  return { summaries: [] };
}

export function loadTurnSummaries(saveDir: string): TurnSummaries {
  return sidecar.read(saveDir, undefined);
}

export function saveTurnSummaries(
  saveDir: string,
  data: TurnSummaries,
  signal?: AbortSignal,
): void {
  sidecar.write(saveDir, data, signal);
}

export function appendTurnSummary(data: TurnSummaries, summary: TurnSummaryEntry): TurnSummaries {
  return {
    summaries: prependBounded(
      data.summaries,
      summary,
      TURN_SUMMARIES_LIMIT,
      (a, b) => a.turnId === b.turnId,
    ),
  };
}

export function buildTurnSummary(input: {
  readonly turnId: string;
  readonly events: readonly DomainEventEnvelope[];
  readonly snapshot: CampaignSnapshot;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
}): TurnSummaryEntry {
  const messages = playerVisibleMessages(
    projectTurnMessages({
      turnId: input.turnId,
      events: input.events,
      snapshot: input.snapshot,
      rulesetVersion: input.rulesetVersion,
      contentVersion: input.contentVersion,
    }),
  );
  const first = messages[0];
  return {
    turnId: input.turnId,
    projectionVersion: first?.debugMetadata?.projectionVersion ?? "1.0.0",
    occurredAt: first?.occurredAt ?? "",
    rulesetVersion: input.rulesetVersion,
    contentVersion: input.contentVersion,
    messages,
  };
}

export const readTurnSummariesProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    const store = yield* TurnSummariesStore;
    const data = yield* store.load(record.saveDir);
    const value: ReadTurnSummariesResult = { summaries: data.summaries };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);
