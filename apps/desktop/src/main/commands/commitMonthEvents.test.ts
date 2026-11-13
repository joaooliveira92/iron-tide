import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");
const MONTHS = 36;
const DEFAULT_ANSWER_AFTER_MONTHS = 3;

const runtime = ManagedRuntime.make(desktopMainLayer());

async function commitMonth(
  sessionId: string,
  expectedRevision: number,
): Promise<BridgeResult<CommitMonthResponse>> {
  return projectCommandExit(
    await runtime.runPromiseExit(
      commitMonthProgram({
        sessionId,
        expectedRevision,
        transportRequestId: `req-${expectedRevision}`,
      }),
    ),
  ) as BridgeResult<CommitMonthResponse>;
}

describe("commitMonth with the production event catalogue", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-commit-month-events-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("advances every month, fires events, and never leaves a dilemma pending past its default delay", async () => {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");

    const saveDir = resolve(saveRoot, "save");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId: "session-events",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });

    const firedByNation = new Map<string, number>();
    for (let revision = 0; revision < MONTHS; revision += 1) {
      const result = await commitMonth("session-events", revision);
      expect(result.outcome, `month ${revision}`).toBe("success");
      const session = getCampaignSession("session-events")!;
      expect(Number(session.state.snapshot.turnNumber)).toBe(revision + 1);
      for (const [nationId, nation] of session.state.snapshot.nations) {
        firedByNation.set(nationId, nation.eventHistory?.fired.length ?? 0);
        const pending = nation.eventHistory?.pending;
        if (pending === undefined) continue;
        const [drawnYear, drawnMonth] = pending.drawnMonth.split("-").map(Number);
        const age = session.month.year * 12 + session.month.month - (drawnYear! * 12 + drawnMonth!);
        expect(age, `${nationId} dilemma ${pending.eventId}`).toBeLessThanOrEqual(
          DEFAULT_ANSWER_AFTER_MONTHS,
        );
      }
    }

    const totalFired = [...firedByNation.values()].reduce((sum, count) => sum + count, 0);
    expect(totalFired).toBeGreaterThan(0);
  }, 600_000);
});
