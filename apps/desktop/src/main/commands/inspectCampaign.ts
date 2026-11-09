import { campaignMonthKey } from "../construction/commandRecord.js";
import { economyOutlookOptions } from "./economyOutlookOptions.js";
import { buildPlayerProjection } from "@bluewave/campaign-engine";
import { snapshotWithQueuedConstruction } from "@bluewave/phase-engine";
import { Effect } from "effect";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { CommandQueue } from "../runtime/commandQueue.js";
import type { CommandHandler } from "../runtime/commandProgram.js";

export const inspectCampaignProgram: CommandHandler<"inspectCampaign"> = (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const contentArtifact = yield* ContentArtifact;
    const shipBuilding = yield* contentArtifact.loadShipBuildingContent();
    const queue = yield* CommandQueue;
    const queued = yield* queue.entries(sessionId);
    const forecast = snapshotWithQueuedConstruction(
      record.state.snapshot,
      queued.map((entry) => entry.envelope),
      shipBuilding,
    );
    const projection = buildPlayerProjection(
      { ...record.state, snapshot: forecast },
      record.playerSlotId,
      record.month,
      shipBuilding.presence,
      economyOutlookOptions(forecast, record.playerSlotId, shipBuilding, campaignMonthKey(record)),
    );
    if (!projection) {
      return yield* new CommandFailed({
        reason: "PROJECTION_FAILED",
        diagnostics: [`Could not build a projection for nation ${record.playerSlotId}`],
      });
    }

    return { outcome: "success" as const, value: { projection }, diagnostics: [] };
  });
