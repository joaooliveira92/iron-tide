import { advanceMonth, getScenarioById, type CampaignState } from "@bluewave/campaign";
import { CommandLedger } from "@bluewave/commands";
import { DiagnosticCollector, type DiagnosticCode } from "@bluewave/diagnostics";
import type { SaveMetadata } from "@bluewave/persistence";
import { Effect } from "effect";
import type { ReplayedRevision } from "../../shared/continuity-contract.js";
import {
  isApprovedPackage,
  isPackageDirectory,
  listRecentPackages,
  recordRecentPackage,
  removeRecentPackage,
} from "../recentPackages.js";
import { ledgerOf, parseMonthInput } from "../monthInput.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandQueueStore } from "../runtime/commandQueueStore.js";
import { CommandFailed } from "../runtime/commandError.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { AppPaths, Clock, IdGenerator, NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { ReplayService } from "../runtime/replayService.js";

function cancelled() {
  return {
    outcome: "rejected" as const,
    reason: "PACKAGE_SELECTION_CANCELLED",
    diagnostics: [] as readonly string[],
  };
}

export const loadCampaignProgram: CommandHandler<"loadCampaign"> = () =>
  Effect.gen(function* () {
    const dialogs = yield* NativeDialog;

    const saveDir = yield* dialogs.choosePackageDirectory();
    if (saveDir === null) return cancelled();

    return yield* loadPackageAt(saveDir);
  });

export const listRecentCampaignsProgram: CommandHandler<"listRecentCampaigns"> = () =>
  Effect.gen(function* () {
    const paths = yield* AppPaths;
    const userDataDir = yield* paths.userDataDir();
    return {
      outcome: "success" as const,
      value: listRecentPackages(userDataDir),
      diagnostics: [],
    };
  });

export const removeRecentCampaignProgram: CommandHandler<"removeRecentCampaign"> = ({
  packagePath,
}) =>
  Effect.gen(function* () {
    const paths = yield* AppPaths;
    const userDataDir = yield* paths.userDataDir();
    removeRecentPackage(userDataDir, packagePath);
    return {
      outcome: "success" as const,
      value: listRecentPackages(userDataDir),
      diagnostics: [],
    };
  });

export const loadRecentCampaignProgram: CommandHandler<"loadRecentCampaign"> = ({ packagePath }) =>
  Effect.gen(function* () {
    const paths = yield* AppPaths;
    const userDataDir = yield* paths.userDataDir();
    const approved = isApprovedPackage(userDataDir, packagePath);
    if (approved === null) {
      const listed = listRecentPackages(userDataDir).some(
        (entry) => entry.packagePath === packagePath,
      );
      return listed && !isPackageDirectory(packagePath)
        ? {
            outcome: "error" as const,
            reason: "PACKAGE_MISSING",
            diagnostics: [`${packagePath} no longer exists. It may have been moved or deleted.`],
          }
        : {
            outcome: "error" as const,
            reason: "PACKAGE_NOT_APPROVED",
            diagnostics: ["This package was not opened through the file dialog; choose it again."],
          };
    }
    return yield* loadPackageAt(approved);
  });

const loadPackageAt = (saveDir: string) =>
  Effect.gen(function* () {
    const projects = yield* ProjectStore;
    const sessions = yield* CampaignSessionStore;
    const queue = yield* CommandQueueStore;
    const ids = yield* IdGenerator;

    const collector = new DiagnosticCollector();
    const state = yield* projects.load(saveDir, collector);
    if (!state) {
      return {
        outcome: "error" as const,
        reason: "LOAD_FAILED",
        diagnostics: collector.all.map((d) => d.message),
      };
    }

    const metadata = yield* projects.readSessionMetadata(saveDir);
    if (!metadata) {
      return {
        outcome: "error" as const,
        reason: "SESSION_METADATA_MISSING",
        diagnostics: [
          `${saveDir} is a valid package but has no readable session.json metadata. It cannot be restored — only packages written by the New Game flow carry the player slot, seed, and scenario needed to continue.`,
        ],
      };
    }

    if (!state.snapshot.nations.has(metadata.playerSlotId)) {
      return {
        outcome: "error" as const,
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [
          `Nation ${metadata.playerSlotId} (from session.json) does not exist in the package snapshot.`,
        ],
      };
    }

    const scenario = getScenarioById(metadata.scenarioId);
    if (!scenario) {
      return {
        outcome: "error" as const,
        reason: "SESSION_METADATA_INVALID",
        diagnostics: [`Scenario ${metadata.scenarioId} is not a canonical scenario.`],
      };
    }

    const activeRevision = Number(state.snapshot.turnNumber);
    const month = advanceMonth(scenario.startYear, scenario.startMonth, activeRevision);

    const sessionId = yield* ids.next();
    yield* sessions.register({
      sessionId,
      saveDir,
      playerSlotId: metadata.playerSlotId,
      campaignSeed: metadata.campaignSeed,
      month,
      state,
    });
    yield* queue.restore(sessionId);

    const appPaths = yield* AppPaths;
    const clock = yield* Clock;
    const now = yield* clock.now();
    yield* appPaths.userDataDir().pipe(
      Effect.flatMap((userDataDir) =>
        Effect.try(() =>
          recordRecentPackage(userDataDir, {
            path: saveDir,
            campaignIdentity: state.snapshot.campaignId,
            activeRevision,
            lastOpened: now.getTime(),
          }),
        ),
      ),
      Effect.ignore,
    );

    return {
      outcome: "success" as const,
      value: {
        sessionId,
        packagePath: saveDir,
        campaignIdentity: state.snapshot.campaignId,
        activeRevision,
      },
      diagnostics: [],
    };
  });

export const listCampaignsProgram: CommandHandler<"listCampaigns"> = () =>
  Effect.gen(function* () {
    const dialogs = yield* NativeDialog;
    const projects = yield* ProjectStore;

    const saveDir = yield* dialogs.choosePackageDirectory();
    if (saveDir === null) return cancelled();

    const value = yield* projects.list(saveDir);
    return { outcome: "success", value: [...value], diagnostics: [] };
  });

export const verifyCampaignProgram: CommandHandler<"verifyCampaign"> = () =>
  Effect.gen(function* () {
    const dialogs = yield* NativeDialog;
    const projects = yield* ProjectStore;

    const saveDir = yield* dialogs.choosePackageDirectory();
    if (saveDir === null) return cancelled();

    const collector = new DiagnosticCollector();
    const state = yield* projects.load(saveDir, collector);

    const claimed = (yield* projects.list(saveDir))[0];
    const campaignIdentity = state ? state.snapshot.campaignId : (claimed?.campaignId ?? "");
    const activeRevision = state ? Number(state.snapshot.turnNumber) : (claimed?.turnNumber ?? 0);

    if (state) {
      return {
        outcome: "success",
        value: { valid: true, campaignIdentity, activeRevision, issues: [] },
        diagnostics: [],
      };
    }

    return {
      outcome: "success",
      value: {
        valid: false,
        campaignIdentity,
        activeRevision,
        issues: collector.all.map((d) => d.message),
      },
      diagnostics: [],
    };
  });

export const replayCampaignProgram: CommandHandler<"replayCampaign"> = () =>
  Effect.gen(function* () {
    const dialogs = yield* NativeDialog;
    const projects = yield* ProjectStore;
    const replay = yield* ReplayService;
    const contentArtifact = yield* ContentArtifact;

    const saveDir = yield* dialogs.choosePackageDirectory();
    if (saveDir === null) return cancelled();

    const metadata = yield* projects.readSessionMetadata(saveDir);
    if (!metadata) {
      return {
        outcome: "error",
        reason: "SESSION_METADATA_MISSING",
        diagnostics: [
          `${saveDir} has no readable session.json — the replay seed (derived from the campaign's configuration seed) cannot be reconstructed.`,
        ],
      };
    }

    const listed = yield* projects.list(saveDir);
    if (listed.length === 0) {
      return {
        outcome: "error",
        reason: "REPLAY_FAILED",
        diagnostics: ["Package contains no saves."],
      };
    }

    const newestSavePerTurn = new Map<number, SaveMetadata>();
    for (const meta of listed) {
      if (!newestSavePerTurn.has(meta.turnNumber)) {
        newestSavePerTurn.set(meta.turnNumber, meta);
      }
    }
    const turns = [...newestSavePerTurn.keys()].sort((a, b) => a - b);

    if (turns.length < 2) {
      return {
        outcome: "success",
        value: { matched: true, revisions: [] },
        diagnostics: [
          `Campaign is at revision ${String(turns[0] ?? 0)} — no executed months to replay.`,
        ],
      };
    }

    const collector = new DiagnosticCollector();
    const revisions: ReplayedRevision[] = [];
    let allMatched = true;

    for (let i = 0; i + 1 < turns.length; i++) {
      const preTurn = turns[i]!;
      const postTurn = turns[i + 1]!;
      const pre = yield* loadSaveForTurn(projects, saveDir, newestSavePerTurn, preTurn);
      const post = yield* loadSaveForTurn(projects, saveDir, newestSavePerTurn, postTurn);

      if (!pre || !post) {
        allMatched = false;
        revisions.push({
          revision: postTurn,
          matched: false,
          expectedHash: "missing",
          actualHash: "missing",
        });
        continue;
      }

      const seed = `${metadata.campaignSeed}:month:${String(pre.snapshot.turnNumber)}`;
      const postSaveId = newestSavePerTurn.get(postTurn)!.saveId;
      const stored = yield* projects.loadMonthInput(saveDir, postSaveId, collector);
      const input = stored.status === "present" ? parseMonthInput(stored.value) : null;
      if (stored.status === "corrupt" || (stored.status === "present" && input === null)) {
        if (stored.status === "present") {
          collector.addError(
            "REPLAY_MONTH_INPUT_INVALID" as DiagnosticCode,
            `Revision ${String(postTurn)}: the stored month input is not a month_input_v1 record.`,
            { stage: "replay" },
          );
        }
        allMatched = false;
        revisions.push({
          revision: postTurn,
          matched: false,
          expectedHash: "unreadable",
          actualHash: "unreadable",
        });
        continue;
      }
      if (
        input !== null &&
        input.shipBuildingContentHash !== (yield* contentArtifact.shipBuildingContentHash())
      ) {
        collector.addWarning(
          "REPLAY_CONTENT_CHANGED" as DiagnosticCode,
          `Revision ${String(postTurn)} was played with different ship-building content; it cannot be reproduced by this version.`,
          { stage: "replay" },
        );
        allMatched = false;
        revisions.push({
          revision: postTurn,
          matched: false,
          expectedHash: "content-changed",
          actualHash: "content-changed",
        });
        continue;
      }
      if (
        input !== null &&
        input.armamentContentHash !== undefined &&
        input.armamentContentHash !== (yield* contentArtifact.armamentContentHash())
      ) {
        collector.addWarning(
          "REPLAY_CONTENT_CHANGED" as DiagnosticCode,
          `Revision ${String(postTurn)} was played with different armament content; it cannot be reproduced by this version.`,
          { stage: "replay" },
        );
        allMatched = false;
        revisions.push({
          revision: postTurn,
          matched: false,
          expectedHash: "armament-content-changed",
          actualHash: "armament-content-changed",
        });
        continue;
      }
      const executed = yield* replay.promote(pre.snapshot, metadata.playerSlotId);
      const expectedHash = yield* replay.hash(
        yield* replay.promote(
          { ...post.snapshot, turnNumber: pre.snapshot.turnNumber },
          metadata.playerSlotId,
        ),
      );
      const shipBuilding =
        input === null ? undefined : yield* contentArtifact.loadShipBuildingContent();
      const engineOptions =
        shipBuilding === undefined
          ? undefined
          : {
              shipBuilding,
              ...(shipBuilding.presence !== undefined ? { presence: shipBuilding.presence } : {}),
            };
      const result = yield* replay.verify({
        snapshot: executed,
        commands: input === null ? [] : [...input.commands],
        originalCommandLedger: input === null ? new CommandLedger() : ledgerOf(input),
        expectedFinalSnapshotHash: expectedHash,
        randomSeed: seed,
        collector,
        engineOptions,
      });

      revisions.push({
        revision: postTurn,
        matched: result.match,
        expectedHash: result.originalFinalHash,
        actualHash: result.replayedFinalHash,
      });
      if (!result.match) allMatched = false;
    }

    return {
      outcome: "success",
      value: { matched: allMatched, revisions },
      diagnostics: collector.all.map((d) => d.message),
    };
  });

function loadSaveForTurn(
  projects: ProjectStore["Service"],
  saveDir: string,
  newestSavePerTurn: Map<number, SaveMetadata>,
  turn: number,
): Effect.Effect<CampaignState | null, CommandFailed> {
  const meta = newestSavePerTurn.get(turn);
  if (!meta) return Effect.succeed(null);
  return projects.loadById(saveDir, meta.saveId, new DiagnosticCollector());
}

export const recoverCampaignProgram: CommandHandler<"recoverCampaign"> = () =>
  Effect.gen(function* () {
    const dialogs = yield* NativeDialog;
    const projects = yield* ProjectStore;
    const replay = yield* ReplayService;

    const saveDir = yield* dialogs.choosePackageDirectory();
    if (saveDir === null) return cancelled();

    const notes: string[] = [];

    const activeSaveId = yield* projects.getActiveSaveId(saveDir);
    if (activeSaveId === null) {
      return {
        outcome: "success",
        value: {
          recovered: false,
          activeRevision: null,
          notes: ["No pointer file (or an unreadable one) — nothing to recover."],
        },
        diagnostics: [],
      };
    }

    const probe = new DiagnosticCollector();
    const active = yield* projects.loadById(saveDir, activeSaveId, probe);
    if (active) {
      return {
        outcome: "success",
        value: {
          recovered: false,
          activeRevision: Number(active.snapshot.turnNumber),
          notes: ["Active save passes integrity checks — no recovery performed."],
        },
        diagnostics: [],
      };
    }
    notes.push(...probe.all.map((d) => d.message));

    const previousSaveId = yield* projects.getPreviousSaveId(saveDir);
    if (previousSaveId === null) {
      return {
        outcome: "success",
        value: {
          recovered: false,
          activeRevision: null,
          notes: [...notes, "The active save is corrupt and no earlier save exists to revert to."],
        },
        diagnostics: [],
      };
    }

    const reverted = yield* replay.revert(saveDir, previousSaveId);
    if (!reverted) {
      return {
        outcome: "error",
        reason: "RECOVERY_FAILED",
        diagnostics: [...notes, "RecoveryManager could not write the reverted pointer."],
      };
    }
    notes.push(`Reverted the package pointer to save ${previousSaveId}.`);

    const after = new DiagnosticCollector();
    const revertedState = yield* projects.load(saveDir, after);
    if (!revertedState) {
      return {
        outcome: "success",
        value: {
          recovered: false,
          activeRevision: null,
          notes: [
            ...notes,
            ...after.all.map((d) => d.message),
            "Reverted save also fails integrity.",
          ],
        },
        diagnostics: [],
      };
    }

    return {
      outcome: "success",
      value: {
        recovered: true,
        activeRevision: Number(revertedState.snapshot.turnNumber),
        notes,
      },
      diagnostics: [],
    };
  });
