import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { EN_US_MESSAGES } from "../../renderer/lib/en-us-messages.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { ResolveTurnResult } from "../../shared/turn-message-contract.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { answerDecisionProgram, resolveTurnProgram } from "./resolveTurn.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");
const PLAYER_NATION = "austria_hungary";
const MONTHS = 36;

const runtime = ManagedRuntime.make(desktopMainLayer());

async function run(program: AnyCommandHandler, payload: unknown): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
}

describe("resolveTurn with the production event catalogue", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-resolve-turn-events-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("suspends on a player dilemma with answerable options and completes every month once answered", async () => {
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      new DiagnosticCollector(),
    );
    if (!output) throw new Error("production pack failed to compile");
    const saveDir = join(saveRoot, "save");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId: "session-dilemma",
      saveDir,
      playerSlotId: PLAYER_NATION,
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });

    let dilemmas = 0;
    let prestigeAnswers = 0;
    let revision = 0;
    for (let guard = 0; guard < MONTHS * 4 && revision < MONTHS; guard += 1) {
      const result = await run(resolveTurnProgram, {
        sessionId: "session-dilemma",
        expectedRevision: revision,
        transportRequestId: `req-${guard}`,
      });
      let value = (result as { value: ResolveTurnResult }).value;
      expect(result.outcome).toBe("success");
      while (value.status === "suspended") {
        const request = value.request;
        expect(request?.kind).toBe("decision");
        expect(request?.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        dilemmas += 1;
        const answered = await run(answerDecisionProgram, {
          sessionId: "session-dilemma",
          expectedRevision: revision,
          transportRequestId: `answer-${guard}-${dilemmas}`,
          interruptionId: request!.interruptionId,
          decisionId: request!.decisionId,
          optionId: request!.options![0]!.optionId,
        });
        expect(answered.outcome).toBe("success");
        value = (answered as { value: ResolveTurnResult }).value;
        const player =
          getCampaignSession("session-dilemma")!.state.snapshot.nations.get(PLAYER_NATION);
        const fired = player?.eventHistory?.fired.at(-1);
        expect(fired?.eventId).toBe(request!.decisionId);
        expect(fired?.answerId).toBe(request!.options![0]!.optionId);
        expect(fired?.resolvedBy).toBe("PLAYER");
        const reason = player?.prestigeLastChange?.reasonCode;
        if (fired?.effects !== undefined && fired.effects.prestigeDelta !== 0) {
          expect(player?.prestigeLastChange?.month).toBe(fired.month);
          expect(reason).toBeDefined();
          expect(EN_US_MESSAGES).toHaveProperty([`shell.prestige.reason.${reason}`]);
          prestigeAnswers += 1;
        }
      }
      expect(value.status).toBe("completed");
      revision += 1;
      expect(Number(getCampaignSession("session-dilemma")!.state.snapshot.turnNumber)).toBe(
        revision,
      );
    }

    expect(revision).toBe(MONTHS);
    expect(dilemmas).toBeGreaterThan(0);
    expect(prestigeAnswers).toBeGreaterThan(0);
  }, 600_000);
});
