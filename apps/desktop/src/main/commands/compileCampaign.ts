import { createInitialCampaignState } from "@bluewave/campaign";
import { supportedPlayerSlotIds } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Effect } from "effect";
import { CampaignConfigurationPayloadSchema } from "../../shared/campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { IdGenerator, NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { toSaveableState } from "../saveHelpers.js";

export const compileCampaignProgram = withSchema(
  CampaignConfigurationPayloadSchema,
  (configuration) =>
    Effect.gen(function* () {
      const dialogs = yield* NativeDialog;
      const projects = yield* ProjectStore;
      const sessions = yield* CampaignSessionStore;
      const content = yield* ContentArtifact;
      const ids = yield* IdGenerator;

      const sessionCollector = new DiagnosticCollector();
      const session = createInitialCampaignState(configuration, sessionCollector);
      if (!session) {
        return {
          outcome: "rejected",
          reason: "INVALID_CAMPAIGN_CONFIGURATION",
          diagnostics: sessionCollector.all.map((d) => d.message),
        };
      }

      const output = yield* content.compileProductionCampaign({
        startYear: session.currentYear,
        startMonth: session.currentMonth,
      });

      const nation = output.state.snapshot.nations.get(configuration.playerSlotId);
      if (!nation) {
        return {
          outcome: "rejected",
          reason: "UNKNOWN_PLAYER_SLOT",
          diagnostics: [`No nation ${configuration.playerSlotId} in the compiled campaign.`],
        };
      }
      if (!supportedPlayerSlotIds(output.state.snapshot).includes(configuration.playerSlotId)) {
        return {
          outcome: "rejected",
          reason: "PLAYER_SLOT_NOT_SUPPORTED",
          diagnostics: [
            `Nation ${configuration.playerSlotId} has no ship designs or construction projects and cannot be played (desktop-mvp Empty-Nation Content Gap).`,
          ],
        };
      }

      const saveDir = yield* dialogs.chooseSaveDirectory(
        `bluewave-${configuration.playerSlotId}-${configuration.scenarioId}`,
      );
      if (saveDir === null) {
        return { outcome: "rejected", reason: "SAVE_LOCATION_CANCELLED", diagnostics: [] };
      }

      const saveableState = toSaveableState(output.state);

      yield* projects.save(saveableState, saveDir);

      yield* projects
        .writeSessionMetadata(saveDir, {
          schemaVersion: "session_meta_v1",
          scenarioId: configuration.scenarioId,
          playerSlotId: configuration.playerSlotId,
          campaignSeed: configuration.campaignSeed,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new CommandFailed({
                reason: "SAVE_FAILED",
                diagnostics: [
                  `Package saved but session metadata could not be written: ${error.diagnostics[0] ?? ""}`,
                ],
              }),
          ),
        );

      const sessionId = yield* ids.next();
      yield* sessions.register({
        sessionId,
        saveDir,
        playerSlotId: configuration.playerSlotId,
        campaignSeed: configuration.campaignSeed,
        month: { month: session.currentMonth, year: session.currentYear },
        state: saveableState,
      });

      return { outcome: "success", value: { sessionId }, diagnostics: [] };
    }),
);
