import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type { ResolveTurnResult } from "../shared/turn-message-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { answerDecisionProgram, resolveTurnProgram } from "./commands/resolveTurn.js";
import { programFor } from "./commandProgramFixtures.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";
import { toSaveableState } from "./saveHelpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../..", "content", "generated", "1880");
const DELIVERED_TITLE = "messages.construction.delivered.title";
const DELIVERY_TURNS = 12;

const runtime = ManagedRuntime.make(desktopMainLayer());

describe("ship delivery turn message on a real production month (#623)", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-delivery-e2e-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("reports the delivered ship and places it in a Newly delivered fleet", async () => {
    const saveDir = join(saveRoot, "campaign");
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId: "session-delivery",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "e2e-seed-0123456789abcdef0123456789",
      month: { month: 1, year: 1880 },
      state,
    });

    const found: { turn: number; shipId: string; nationId: string | undefined }[] = [];
    for (let turn = 0; turn < DELIVERY_TURNS && found.length === 0; turn++) {
      let result = projectCommandExit(
        await runtime.runPromiseExit(
          programFor(resolveTurnProgram)({
            sessionId: "session-delivery",
            expectedRevision: turn,
            transportRequestId: `req-${String(turn)}`,
          }),
        ),
      ) as BridgeResult<ResolveTurnResult>;
      for (let answer = 0; result.outcome === "success" && result.value.status === "suspended";) {
        const request = result.value.request;
        const option = request?.options?.[0];
        if (request?.kind !== "decision" || option === undefined) break;
        result = projectCommandExit(
          await runtime.runPromiseExit(
            programFor(answerDecisionProgram)({
              sessionId: "session-delivery",
              expectedRevision: turn,
              transportRequestId: `req-${String(turn)}-answer-${String(answer++)}`,
              interruptionId: request.interruptionId,
              decisionId: request.decisionId ?? "",
              optionId: option.optionId,
            }),
          ),
        ) as BridgeResult<ResolveTurnResult>;
      }
      if (result.outcome !== "success" || result.value.status !== "completed") break;
      for (const message of result.value.summary.messages) {
        const ship = message.subjectRefs.find((ref) => ref.type === "ship");
        if (message.titleKey === DELIVERED_TITLE && ship !== undefined) {
          found.push({
            turn,
            shipId: ship.id,
            nationId: message.subjectRefs.find((ref) => ref.type === "nation")?.id,
          });
        }
      }
    }

    expect(found).toEqual([{ turn: 10, shipId: "ship-ger_sachsen-10", nationId: "germany" }]);
    const nations = getCampaignSession("session-delivery")!.state.snapshot.nations;
    const germany = nations.get("germany")!;
    const delivered = germany.fleets.find((fleet) =>
      fleet.ships.some((ship) => ship.id === "ship-ger_sachsen-10"),
    )!;
    expect(delivered.name).toBe("Newly delivered");
    expect(delivered.id).toBe(`fleet-germany-delivered-${germany.homeAreaId}`);
    expect(delivered.locationAreaId).toBe(germany.homeAreaId);
  }, 120_000);
});
