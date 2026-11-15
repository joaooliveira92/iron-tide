import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, CampaignState, WarDeclaration } from "@bluewave/campaign";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { DiplomacyScreenProjection } from "../../shared/diplomacy-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { programFor } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { inspectDiplomacyScreenProgram } from "./diplomacyCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

const inspect = async (sessionId: string) =>
  projectCommandExit(
    await runtime.runPromiseExit(programFor(inspectDiplomacyScreenProgram)(sessionId)),
  ) as BridgeResult<DiplomacyScreenProjection>;

function activeWar(attackerWarScore: number, defenderWarScore: number): WarDeclaration {
  return {
    id: "war_uk_france_1880-01",
    attackerSideId: "side_uk",
    defenderSideId: "side_france",
    attackerSideMembers: ["uk"],
    defenderSideMembers: ["france"],
    attackerWarScore,
    defenderWarScore,
    attackerId: "uk",
    defenderId: "france",
    startDate: "1880-01",
    status: "ACTIVE",
  };
}

describe("diplomacy projection peace refusal", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-peace-refusal-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function register(sessionId: string, war: WarDeclaration): void {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const snapshot: CampaignSnapshot = structuredClone(output.state.snapshot);
    snapshot.wars = { ...snapshot.wars, wars: [war] };
    const state: CampaignState = {
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    };
    const saveable = toSaveableState(state);
    const saveDir = resolve(saveRoot, sessionId);
    new SaveStore().save(saveable, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: saveable,
    });
  }

  it("flags an active war the AI leads by the margin", async () => {
    register("refusal-session", activeWar(0, 60));
    const result = await inspect("refusal-session");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(result.value.wars[0]?.peaceRefusal).toMatchObject({
      reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
    });
    expect(result.value.wars[0]?.peaceRefusal?.margin).toBeGreaterThan(0);
  });

  it("does not flag a war the AI does not lead by the margin", async () => {
    register("no-refusal-session", activeWar(3, 1));
    const result = await inspect("no-refusal-session");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(result.value.wars[0]?.peaceRefusal).toBeUndefined();
  });
});
