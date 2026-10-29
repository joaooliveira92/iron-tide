import type { CampaignSnapshot } from "@bluewave/campaign";
import { unifiedSnapshotHash } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type DecisionAnswer,
  type DecisionRequest,
  type PendingDecision,
} from "@bluewave/messages";
import { MonthExecutor, type InterruptionChannel } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { productionStartSnapshot, saveAndLoad } from "../src/replay-corpus/corpus.js";

const SEED = "suspended-turn-save-load";
const TURN_ID = "turn-1";

function pendingFor(snapshot: CampaignSnapshot): PendingDecision {
  const nationId = snapshot.slots[0]?.nationId;
  if (nationId === undefined) throw new Error("production snapshot has no slots");
  return {
    phase: "appropriation",
    subjectKey: nationId,
    decisionId: "dec-save-load",
    titleKey: "messages.decision.title",
    bodyKey: "messages.decision.body",
    interpolation: {},
    options: [
      {
        optionId: "approve",
        titleKey: "messages.decision.approve.title",
        bodyKey: "messages.decision.approve.body",
        hints: [],
        effects: [{ nationId, attribute: "treasury", delta: -50 }],
      },
      {
        optionId: "decline",
        titleKey: "messages.decision.decline.title",
        bodyKey: "messages.decision.decline.body",
        hints: [],
        effects: [],
      },
    ],
  };
}

function run(snapshot: CampaignSnapshot, channel: InterruptionChannel) {
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    interruptions: channel,
  });
}

function answer(request: DecisionRequest, optionId: string) {
  const payload: DecisionAnswer = {
    interruptionId: request.interruptionId,
    decisionId: request.decisionId,
    optionId,
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "decision",
    interruptionId: request.interruptionId,
    payload,
  });
}

describe("a turn suspended for a decision survives save and load", () => {
  const start = productionStartSnapshot();
  const pending = pendingFor(start);
  const suspended = run(start, {
    turnId: TURN_ID,
    recordedInputs: [],
    pendingDecisions: [pending],
  });
  const request = suspended.suspended?.request;

  it("suspends awaiting the decision", () => {
    expect(suspended.outcome).toBe("suspended");
    expect(request?.kind).toBe("decision");
  });

  for (const optionId of ["approve", "decline"]) {
    it(`resumes from the reloaded snapshot exactly as from memory (${optionId})`, () => {
      if (request?.kind !== "decision") throw new Error("expected a decision request");
      const channel: InterruptionChannel = {
        turnId: TURN_ID,
        recordedInputs: [answer(request, optionId)],
        pendingDecisions: [pending],
      };
      const reloaded = saveAndLoad(start);
      if (!reloaded.ok) throw new Error(reloaded.reason);

      const inMemory = run(start, channel);
      const afterReload = run(reloaded.snapshot, channel);

      expect(afterReload.outcome).toBe("completed");
      expect(unifiedSnapshotHash(afterReload.finalSnapshot)).toBe(
        unifiedSnapshotHash(inMemory.finalSnapshot),
      );
      expect(afterReload.randomLedger.hash()).toBe(inMemory.randomLedger.hash());
      expect(afterReload.financialLedger.hash()).toBe(inMemory.financialLedger.hash());
    });
  }

  it("reaches different states for different answers", () => {
    if (request?.kind !== "decision") throw new Error("expected a decision request");
    const finalHash = (optionId: string) =>
      unifiedSnapshotHash(
        run(start, {
          turnId: TURN_ID,
          recordedInputs: [answer(request, optionId)],
          pendingDecisions: [pending],
        }).finalSnapshot,
      );
    expect(finalHash("approve")).not.toBe(finalHash("decline"));
  });

  it("suspends identically when the start snapshot is reloaded before the first run", () => {
    const reloaded = saveAndLoad(start);
    if (!reloaded.ok) throw new Error(reloaded.reason);
    const again = run(reloaded.snapshot, {
      turnId: TURN_ID,
      recordedInputs: [],
      pendingDecisions: [pending],
    });
    expect(again.suspended).toEqual(suspended.suspended);
  });
});
