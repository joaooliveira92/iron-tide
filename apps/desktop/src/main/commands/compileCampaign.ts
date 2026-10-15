import { createInitialCampaignState } from "@bluewave/campaign";
import { supportedPlayerSlotIds } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Effect } from "effect";
import { CampaignConfigurationPayloadSchema } from "../campaignCommandSchemas.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { IdGenerator, NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { toSaveableState } from "../saveHelpers.js";

/**
 * `compileCampaign(configuration) -> { sessionId }` (ticket 08/12) as a native
 * `CommandProgram` (INC-5; ADR-0159): validates the configuration, compiles
 * `content/production/1880` through the `ContentArtifact` service, rejects an
 * unsupported/zero-content player slot, prompts for a save location through
 * `NativeDialog`, writes the initial save + `session.json` sidecar through
 * `ProjectStore` (so there's always something recoverable), and registers the
 * live session through `CampaignSessionStore` so `inspectCampaign` can serve
 * it. Every reason (`INVALID_CAMPAIGN_CONFIGURATION`, `COMPILE_FAILED`,
 * `UNKNOWN_PLAYER_SLOT`, `PLAYER_SLOT_NOT_SUPPORTED`,
 * `SAVE_LOCATION_CANCELLED`, `SAVE_FAILED`) is modelled on the typed channel:
 * business refusals as `CommandRejected`, service failures as `CommandFailed`.
 *
 * Judgment call (ticket 12): `configuration` is validated and its session
 * bookkeeping (start year/month, turn number) is derived via
 * `createInitialCampaignState` — but is *not* threaded into
 * `CampaignCompiler.compile()`'s `campaignConfiguration` input. That input
 * triggers a stricter DESIGN-03 precondition gate requiring the full
 * canonical scenario/fleet-size/research-speed catalogs to be supplied
 * alongside it; nothing in the compiler actually *consumes*
 * `campaignConfiguration` to parameterize the compiled snapshot (it's a
 * precondition gate, not an input to snapshot construction) — fleets,
 * economies, designs, etc. come entirely from the content pack's YAML.
 * `packages/cross-process-test/src/run-child.ts` (the one proven
 * compile->advance->save/load reference loop in the repo) does the same:
 * compiles without `campaignConfiguration`. Matching that precedent avoids
 * a validation path nothing in the actual compile step depends on.
 */
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

      // B-6/ADR-0025: thread the scenario's start calendar date into the compile
      // so the snapshot stamps authoritative startYear/startMonth (the month ids
      // every later campaign month — incl. the weather stream — derive from).
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

      // `CampaignCompiler.compile()`'s `rawHash` is computed over `snapshot`
      // alone, but `SaveStore.save`/`load` verify a hash computed over the whole
      // state (`{snapshot, envelope}`) — the two don't agree, so saving the
      // compiler's own `rawHash` as-is fails `SaveStore.load`'s integrity check.
      // `packages/cross-process-test/src/run-child.ts` (the one proven
      // compile->save/load loop in the repo) already recomputes `rawHash` this
      // same way immediately before calling `store.save`; this repeats that
      // precedent rather than inventing a new hashing convention.
      const saveableState = toSaveableState(output.state);

      yield* projects.save(saveableState, saveDir);

      // Ticket 16: the continuance sidecar. `SaveStore`'s package stores the
      // authoritative `CampaignState`, but a session restored on load also needs
      // the player's slot, seed, and scenario — none of which live in the
      // snapshot. This app-owned file (invisible to SaveStore, outside its
      // integrity envelope) is what makes a later `loadCampaign`/
      // `replayCampaign` able to restore the real campaign instead of a hollow
      // shell. `ProjectStore.writeSessionMetadata` is atomic (tmp+rename); a
      // failure here means the package is incomplete and the command reports
      // SAVE_FAILED.
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
