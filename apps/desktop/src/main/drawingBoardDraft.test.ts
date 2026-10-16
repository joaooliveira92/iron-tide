import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeLog, newLog, pushEdit } from "@bluewave/ship-design";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type { ReadDrawingBoardDraftResult } from "../shared/design-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "./campaignSessions.js";
import {
  DRAWING_BOARD_DRAFT_FILENAME,
  loadDrawingBoardDraft,
  readDrawingBoardDraftProgram,
  writeDrawingBoardDraftProgram,
} from "./drawingBoardDraft.js";
import { readReferenceDesigns } from "./referenceDesigns.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import type { CommandProgram } from "./runtime/commandProgram.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";

const reference = readReferenceDesigns().find((d) => d.id === "torpedo_cruiser_1880")!;

const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs a command program through the desktop service graph and projects its wire envelope. */
async function runProgram(
  program: CommandProgram,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload)));
}

describe("Drawing Board draft sidecar", () => {
  let saveDir: string;
  beforeEach(() => {
    saveDir = mkdtempSync(join(tmpdir(), "bw-draft-"));
    // The draft programs only need the session's save directory; the campaign
    // state is never read.
    registerCampaignSession({
      sessionId: "s",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: {} as never,
    });
  });
  afterEach(() => {
    rmSync(saveDir, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  const log = encodeLog(
    pushEdit(newLog(reference.draft), { kind: "set_machinery", patch: { installedKw: 2_500 } }),
  );

  it("keeps the working design across a restart, and removes it on request", async () => {
    expect(await runProgram(readDrawingBoardDraftProgram, "s")).toMatchObject({
      outcome: "success",
      value: { draft: null },
    });

    const w = await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "s",
      draft: { presetId: reference.id, log },
    });
    expect(w).toMatchObject({ outcome: "success", value: { saved: true } });

    // The saved draft round-trips with a Clock-stamped ISO `savedAt`.
    const r = await runProgram(readDrawingBoardDraftProgram, "s");
    expect(r).toMatchObject({
      outcome: "success",
      value: { draft: { presetId: reference.id, log } },
    });
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const savedAt = (r.value as ReadDrawingBoardDraftResult).draft!.savedAt;
    expect(savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const removed = await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "s",
      draft: null,
    });
    expect(removed).toMatchObject({ outcome: "success", value: { saved: false } });
    expect(existsSync(join(saveDir, DRAWING_BOARD_DRAFT_FILENAME))).toBe(false);
  });

  it("rejects something that is not an edit log, and reads a corrupt file as no draft", async () => {
    const rejected = await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "s",
      draft: { presetId: "x", log: "{}" },
    });
    expect(rejected).toMatchObject({ outcome: "rejected", reason: "INVALID_COMMAND_PAYLOAD" });

    writeFileSync(join(saveDir, DRAWING_BOARD_DRAFT_FILENAME), "{not json", "utf8");
    expect(await runProgram(readDrawingBoardDraftProgram, "s")).toMatchObject({
      outcome: "success",
      value: { draft: null },
    });
    expect((await runProgram(readDrawingBoardDraftProgram, "nobody")).outcome).toBe("error");

    // A payload that fails the wire schema is rejected before any IO.
    expect(
      await runProgram(writeDrawingBoardDraftProgram, { sessionId: "s", draft: { presetId: "x" } }),
    ).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
  });

  it("answers SESSION_NOT_FOUND for an unknown session and DRAFT_WRITE_FAILED when the dir is gone", async () => {
    const missing = await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "nobody",
      draft: { presetId: reference.id, log },
    });
    expect(missing).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });

    // Point a session at a directory that does not exist: the atomic write fails.
    registerCampaignSession({
      sessionId: "s-gone",
      saveDir: join(saveDir, "gone"),
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: {} as never,
    });
    const failed = await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "s-gone",
      draft: { presetId: reference.id, log },
    });
    expect(failed).toMatchObject({ outcome: "error", reason: "DRAFT_WRITE_FAILED" });
  });

  it("does not restore a draft from another compatibility version, and preserves it renamed", async () => {
    await runProgram(writeDrawingBoardDraftProgram, {
      sessionId: "s",
      draft: { presetId: reference.id, log },
    });
    const path = join(saveDir, DRAWING_BOARD_DRAFT_FILENAME);
    const before = readFileSync(path, "utf8");

    // A draft written under the current 3.0.0 is not restored under 4.0.0.
    expect(loadDrawingBoardDraft(saveDir, "4.0.0")).toBeNull();
    expect(existsSync(path)).toBe(false);
    expect(readFileSync(`${path}.3.0.0`, "utf8")).toBe(before);
  });

  it("treats an unstamped legacy draft as written under 1.2.0 (refused at the current version)", () => {
    const stored = { schema: "drawing_board_draft_v1", savedAt: "x", presetId: reference.id, log };
    writeFileSync(join(saveDir, DRAWING_BOARD_DRAFT_FILENAME), JSON.stringify(stored));
    // The sidecar only restores a draft whose version matches the current engine
    // version; the unstamped legacy draft is 1.2.0 and 3.0.0 is current.
    expect(loadDrawingBoardDraft(saveDir, "1.2.0")).toMatchObject({ presetId: reference.id });
    writeFileSync(join(saveDir, DRAWING_BOARD_DRAFT_FILENAME), JSON.stringify(stored));
    expect(loadDrawingBoardDraft(saveDir)).toBeNull();
    expect(existsSync(join(saveDir, `${DRAWING_BOARD_DRAFT_FILENAME}.1.2.0`))).toBe(true);
  });
});
