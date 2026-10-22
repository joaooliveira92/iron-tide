import { buildPlayerProjection } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { SessionIdPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";

export const inspectCampaignProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const contentArtifact = yield* ContentArtifact;
    const shipBuilding = yield* contentArtifact.loadShipBuildingContent();
    const projection = buildPlayerProjection(
      record.state,
      record.playerSlotId,
      record.month,
      shipBuilding.presence,
    );
    if (!projection) {
      return yield* new CommandFailed({
        reason: "PROJECTION_FAILED",
        diagnostics: [`Could not build a projection for nation ${record.playerSlotId}`],
      });
    }

    return { outcome: "success" as const, value: { projection }, diagnostics: [] };
  }),
);
