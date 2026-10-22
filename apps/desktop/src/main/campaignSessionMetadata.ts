import { CANONICAL_SCENARIO_IDS } from "@bluewave/campaign";
import { Schema } from "effect";

export const SESSION_METADATA_FILENAME = "session.json";

export const SessionMetadataSchema = Schema.Struct({
  schemaVersion: Schema.Literal("session_meta_v1"),
  scenarioId: Schema.Literals(CANONICAL_SCENARIO_IDS),
  playerSlotId: Schema.String.check(Schema.isMinLength(1)),
  campaignSeed: Schema.String.check(Schema.isMinLength(1)),
});

export type SessionMetadata = typeof SessionMetadataSchema.Type;
