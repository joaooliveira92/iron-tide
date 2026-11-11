import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashCampaignSnapshot } from "@bluewave/campaign";
import type { CampaignConfiguration } from "@bluewave/campaign-engine";
import { supportedPlayerSlotIds } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CompileCampaignResult } from "../../shared/campaign-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { IdGenerator, NativeDialog } from "../runtime/platform.js";
import { commitMonthProgram } from "./commitMonth.js";
import { compileCampaignProgram } from "./compileCampaign.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");
const CAMPAIGN_SEED = "0123456789abcdef0123456789abcdef";

let saveDirAnswer: string | null = null;
let idCounter = 0;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => Effect.succeed(saveDirAnswer),
      choosePackageDirectory: () => Effect.succeed(null),
      chooseCopyDirectory: () => Effect.succeed(null),
    }),
    Layer.succeed(IdGenerator, { next: () => Effect.sync(() => `resume-session-${idCounter++}`) }),
  ),
);

function generatedConfiguration(playerSlotId: string): CampaignConfiguration {
  return {
    scenarioId: "scen_1880",
    playerSlotId,
    continuityModeId: "historical",
    fleetSizeSettingId: "standard",
    researchSpeedSettingId: "standard",
    technologyVariationSettingId: "none",
    historicalBudgetOptionId: "standard",
    legacyFleetModeId: "generated",
    tacticalRealismModeId: "standard",
    difficultyProfileId: "easy",
    campaignSeed: CAMPAIGN_SEED,
    configurationSchemaVersion: "campaign_configuration_v1",
  } as CampaignConfiguration;
}

const probe = compileProductionCampaignFromArtifact(
  GENERATED_ARTIFACT,
  new AbortController().signal,
  new DiagnosticCollector(),
);
const PLAYABLE_NATIONS =
  probe === undefined ? [] : [...supportedPlayerSlotIds(probe.state.snapshot)];
const PACK_VERSION = probe?.pack.manifest.version;

async function commit(sessionId: string, expectedRevision: number) {
  return projectCommandExit(
    await runtime.runPromiseExit(
      commitMonthProgram({ sessionId, expectedRevision, transportRequestId: `req-${sessionId}` }),
    ),
  );
}

describe("create, save, load and resume a generated-fleet campaign", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), "bw-save-resume-"));
    idCounter = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("covers the ten playable nations", () => {
    expect(PLAYABLE_NATIONS).toHaveLength(10);
    expect(PACK_VERSION).toBeDefined();
  });

  it.each(PLAYABLE_NATIONS)(
    "%s round-trips its seed and resumes to the same month",
    async (nation) => {
      const saveDir = resolve(root, "created");
      saveDirAnswer = saveDir;
      const created = projectCommandExit(
        await runtime.runPromiseExit(compileCampaignProgram(generatedConfiguration(nation))),
      ) as BridgeResult<CompileCampaignResult>;
      expect(created.outcome).toBe("success");
      if (created.outcome !== "success") return;
      const original = getCampaignSession(created.value.sessionId);
      if (original === undefined) throw new Error("session was not registered");

      const store = new SaveStore();
      const [metadata] = store.list(saveDir);
      expect(metadata?.campaignSeed).toBe(CAMPAIGN_SEED);
      expect(metadata?.rulesetVersion).toBe(original.state.snapshot.rulesetVersion);
      expect(metadata?.dataPackVersion).toBe(PACK_VERSION);

      const loaded = Effect.runSync(store.load(saveDir)).state;
      expect(hashCampaignSnapshot(loaded.snapshot)).toBe(
        hashCampaignSnapshot(original.state.snapshot),
      );

      const resumedDir = resolve(root, "resumed");
      store.save(loaded, resumedDir);
      registerCampaignSession({
        sessionId: "resumed",
        saveDir: resumedDir,
        playerSlotId: nation,
        campaignSeed: CAMPAIGN_SEED,
        month: original.month,
        state: loaded,
      });

      const revision = Number(original.state.snapshot.turnNumber);
      const fromOriginal = await commit(original.sessionId, revision);
      const fromResumed = await commit("resumed", revision);
      expect(fromOriginal.outcome).toBe("success");
      expect(fromResumed.outcome).toBe("success");

      const advancedOriginal = getCampaignSession(original.sessionId);
      const advancedResumed = getCampaignSession("resumed");
      expect(hashCampaignSnapshot(advancedResumed!.state.snapshot)).toBe(
        hashCampaignSnapshot(advancedOriginal!.state.snapshot),
      );
      expect(advancedOriginal?.month).toEqual(advancedResumed?.month);

      const [latest] = store.list(saveDir).sort((a, b) => b.turnNumber - a.turnNumber);
      expect(latest?.turnNumber).toBe(revision + 1);
      expect(latest?.campaignSeed).toBe(CAMPAIGN_SEED);
      expect(latest?.dataPackVersion).toBe(PACK_VERSION);
    },
    120_000,
  );
});
