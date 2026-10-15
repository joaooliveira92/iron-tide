import { buildWorldMapView } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";

/**
 * `inspectMap(sessionId) -> { world }` as an Effect command program (ADR-0159)
 * — full-world projection for the F1 strategic map. Read-only, rebuilt fresh
 * from the session's stored `CampaignState` every call via
 * `@bluewave/campaign-engine`'s pure `buildWorldMapView` (same
 * immutable-snapshot pattern as `inspectCampaign` and `inspectFleetScreen`), so
 * the map colours the whole world from authoritative campaign data rather than
 * a static fixture. The session is resolved through `CampaignSessionStore`.
 */
export const inspectMapProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const world = buildWorldMapView(record.state.snapshot);

    return {
      outcome: "success" as const,
      value: {
        revision: Number(record.state.snapshot.turnNumber),
        month: record.month,
        world,
      },
      diagnostics: [],
    };
  }),
);
