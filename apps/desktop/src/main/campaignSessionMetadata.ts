import { CANONICAL_SCENARIO_IDS } from "@bluewave/campaign";
import { Schema } from "effect";

/**
 * App-owned `session.json` sidecar at a `SaveStore` package's root directory
 * (desktop-mvp ticket 16). `SaveStore`'s package stores the authoritative
 * `CampaignState` (hash/envelope/sig/pointer), but three fields a loaded
 * `CampaignSessionRecord` needs are NOT part of the compiled snapshot:
 *
 * - `playerSlotId` — which nation the player chose (the snapshot's `slots`
 *   aren't authored as the player pick),
 * - `campaignSeed` — the player-chosen `CampaignConfiguration.campaignSeed`,
 *   the deterministic root `commitMonth` and `replayCampaign` derive every
 *   month seed from; unrecoverable from state alone,
 * - `scenarioId` — whose canonical start date ({startYear,startMonth}) the
 *   current calendar month is derived from as start + `turnNumber` months.
 *
 * This module owns only the sidecar's *shape* (the schema + filename); the
 * filesystem read/write lives in the `ProjectStore` service
 * (`runtime/projectStore.ts`), so no command path touches `node:fs` for it.
 * Saves are trust-class data (ENGINEERING-CONTRACT "Security"), so reads are
 * validated with this Effect Schema (ADR-0102).
 */
export const SESSION_METADATA_FILENAME = "session.json";

export const SessionMetadataSchema = Schema.Struct({
  schemaVersion: Schema.Literal("session_meta_v1"),
  scenarioId: Schema.Literals(CANONICAL_SCENARIO_IDS),
  playerSlotId: Schema.String.check(Schema.isMinLength(1)),
  campaignSeed: Schema.String.check(Schema.isMinLength(1)),
});

export type SessionMetadata = typeof SessionMetadataSchema.Type;
