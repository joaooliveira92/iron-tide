import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { RecoveryManager, SaveStore } from "../src/index.js";
import { minimalCampaignState } from "./campaign-state-fixture.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";

describe("effect write api", () => {
  let dir: string;
  const store = new SaveStore();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-effect-"));
  });

  afterEach(() => {
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  });

  it("saveEffect round-trips with list, active and previous ids", () => {
    const first = unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    const second = unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    expect(unwrapSuccess(runExit(store.activeSaveIdEffect(dir)))).toBe(second.metadata.saveId);
    expect(unwrapSuccess(runExit(store.previousSaveIdEffect(dir)))).toBe(first.metadata.saveId);
    expect(unwrapSuccess(runExit(store.listEffect(dir)))).toHaveLength(2);
    expect(unwrapSuccess(runExit(store.isCurrentEffect(minimalCampaignState(), dir)))).toBe(true);
  });

  it("saveEffect is lazy until run", () => {
    const effect = store.saveEffect(minimalCampaignState(), dir);
    expect(store.list(dir)).toHaveLength(0);
    unwrapSuccess(runExit(effect));
    expect(store.list(dir)).toHaveLength(1);
  });

  it("saveEffect fails with a typed IO error when the directory is unwritable", () => {
    chmodSync(dir, 0o555);
    const failure = expectFailureTag(
      runExit(store.saveEffect(minimalCampaignState(), join(dir, "sub"))),
      "PERSISTENCE_IO",
    );
    expect(failure.stage).toBe("persistence.save");
  });

  it("saveEffect fails with a cancellation error when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expectFailureTag(
      runExit(store.saveEffect(minimalCampaignState(), dir, {}, controller.signal)),
      "PERSISTENCE_CANCELLED",
    );
  });

  it("listEffect fails with a typed IO error when the directory is unreadable", () => {
    const unreadable = join(dir, "unreadable");
    mkdirSync(unreadable);
    chmodSync(unreadable, 0o000);
    try {
      expectFailureTag(runExit(store.listEffect(unreadable)), "PERSISTENCE_IO");
    } finally {
      chmodSync(unreadable, 0o755);
    }
  });

  it("revertEffect repoints and fails typed when the pointer cannot be written", () => {
    const first = unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    unwrapSuccess(runExit(RecoveryManager.revertEffect(dir, first.metadata.saveId)));
    expect(store.getActiveSaveId(dir)).toBe(first.metadata.saveId);
    expectFailureTag(
      runExit(RecoveryManager.revertEffect(join(dir, "absent"), first.metadata.saveId)),
      "PERSISTENCE_IO",
    );
    expect(Effect.isEffect(RecoveryManager.revertEffect(dir, first.metadata.saveId))).toBe(true);
  });
});
