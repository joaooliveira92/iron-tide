import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { InspectCampaignResult } from "../../shared/campaign-contract.js";
import type { ConstructionScreenProjection } from "../../shared/construction-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { inspectConstructionScreenProgram } from "./constructionCommands.js";
import { inspectCampaignProgram } from "./inspectCampaign.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram<A>(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

const inspectConstructionScreen = (sessionId: string) =>
  runProgram<ConstructionScreenProjection>(inspectConstructionScreenProgram, sessionId);
const inspectCampaign = (sessionId: string) =>
  runProgram<InspectCampaignResult>(inspectCampaignProgram, sessionId);

describe("construction and treasury projections agree on monthly appropriation", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-appropriation-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("projects the same monthly appropriation as the treasury screen for the same state", async () => {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");

    const state = toSaveableState(output.state);
    const saveDir = resolve(saveRoot, "save-appropriation-parity");
    new SaveStore().save(state, saveDir);
    const uk = state.snapshot.nations.get("uk");
    if (!uk) throw new Error("uk missing from production state");
    const grownBase: CampaignState = {
      ...state,
      snapshot: {
        ...state.snapshot,
        nations: new Map(state.snapshot.nations).set("uk", {
          ...uk,
          baseResources: SafeInt(60_000),
        }),
      },
    };
    registerCampaignSession({
      sessionId: "session-appropriation-grown",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: grownBase,
    });

    const construction = await inspectConstructionScreen("session-appropriation-grown");
    const treasury = await inspectCampaign("session-appropriation-grown");
    expect(construction.outcome).toBe("success");
    expect(treasury.outcome).toBe("success");
    if (construction.outcome !== "success" || treasury.outcome !== "success") return;

    expect(construction.value.economy.monthlyAppropriation).toBe(
      treasury.value.projection.economy.monthlyAppropriation,
    );
  });
});
