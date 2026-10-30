import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Tracer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { RecoveryManager, SaveStore } from "../src/index.js";
import { minimalCampaignState } from "./campaign-state-fixture.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

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

  const corruptPointer = (): void => {
    const pointerPath = join(dir, "pointer.json");
    writeFileSync(
      pointerPath,
      JSON.stringify({ ...readJson(pointerPath), surprise: true }, null, 2),
      "utf8",
    );
  };

  const saveDirectoryCount = (): number =>
    readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;

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

  it("pointer effects fail typed instead of reporting no active save", () => {
    unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    corruptPointer();

    const active = expectFailureTag(
      runExit(store.activeSaveIdEffect(dir)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expect(active.stage).toBe("persistence.pointer");

    const previous = expectFailureTag(
      runExit(store.previousSaveIdEffect(dir)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expect(previous.stage).toBe("persistence.pointer");
  });

  it("isCurrentEffect fails typed when the pointer cannot be read", () => {
    unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    unwrapSuccess(runExit(store.saveEffect(minimalCampaignState(), dir)));
    corruptPointer();

    const failure = expectFailureTag(
      runExit(store.isCurrentEffect(minimalCampaignState(), dir)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expect(failure.stage).toBe("persistence.isCurrent");
    expect(
      unwrapSuccess(runExit(store.isCurrentEffect(minimalCampaignState(), join(dir, "absent")))),
    ).toBe(false);
  });

  it("saveEffect warns and skips pruning when the pointer is unreadable", () => {
    const pruned = new SaveStore(undefined, { retainSaves: 2 });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      unwrapSuccess(runExit(pruned.saveEffect(minimalCampaignState(), dir)));
    }
    expect(saveDirectoryCount()).toBe(2);

    corruptPointer();
    const result = unwrapSuccess(runExit(pruned.saveEffect(minimalCampaignState(), dir)));

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("PERSISTENCE_CORRUPT_SAVE");
    expect(result.warnings[0]!.severity).toBe("warning");
    expect(saveDirectoryCount()).toBe(3);
    expect(pruned.getPreviousSaveId(dir)).toBeNull();
  });

  it("revertEffect keeps the underlying cause in the failure", () => {
    const failure = expectFailureTag(
      runExit(
        RecoveryManager.revertEffect(
          join(dir, "absent"),
          "1700000000000-00000000-0000-0000-000000000000",
        ),
      ),
      "PERSISTENCE_IO",
    );
    expect(failure.message).toContain("ENOENT");
  });

  it("traces the persistence io boundary", () => {
    const spans: Tracer.NativeSpan[] = [];
    const tracer = Tracer.make({
      span(options) {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);
        return span;
      },
    });
    const program = Effect.gen(function* () {
      yield* store.saveEffect(minimalCampaignState(), dir);
      yield* store.listEffect(dir);
      yield* store.isCurrentEffect(minimalCampaignState(), dir);
    });

    unwrapSuccess(runExit(Effect.provideService(program, Tracer.Tracer, tracer)));

    expect(spans.map((span) => span.name)).toEqual(
      expect.arrayContaining(["persistence.save", "persistence.list", "persistence.isCurrent"]),
    );
  });
});
