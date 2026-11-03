import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { writeSaveManifest } from "../src/manifest.js";
import { RecoveryManager } from "../src/recovery.js";
import { SaveStore } from "../src/store.js";
import { minimalCampaignState } from "./campaign-state-fixture.js";
import { expectFailureTag, runExit } from "./harness.js";

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");

describe("persistence files reject excess keys", () => {
  let dir: string;
  let store: SaveStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "strict-decode-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const saveOnce = (): string => {
    store.save(minimalCampaignState(), dir);
    return store.getActiveSaveId(dir)!;
  };

  it("treats a pointer with an unmodeled key as corrupt", () => {
    saveOnce();
    const pointerPath = join(dir, "pointer.json");
    writeJson(pointerPath, { ...readJson(pointerPath), surprise: true });

    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe("Pointer file is corrupt or unreadable");
    expect(store.getActiveSaveId(dir)).toBeNull();
    expect(store.getPreviousSaveId(dir)).toBeNull();
  });

  it("reports an unmodeled key in campaign.json as structurally invalid", () => {
    const id = saveOnce();
    const campaignPath = join(dir, id, "campaign.json");
    writeJson(campaignPath, { ...readJson(campaignPath), surprise: true });
    writeSaveManifest(join(dir, id));

    const error = expectFailureTag(runExit(store.loadById(dir, id)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe("Save data is structurally invalid");
  });

  it("treats an integrity manifest with an unmodeled key as corrupt", () => {
    const id = saveOnce();
    const manifestPath = join(dir, id, "manifest.json");
    writeJson(manifestPath, { ...readJson(manifestPath), surprise: true });

    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe("Save integrity manifest is invalid");
  });

  it("lists a save through its campaign header when metadata carries an unmodeled key", () => {
    const id = saveOnce();
    const metaPath = join(dir, id, "metadata.json");
    writeJson(metaPath, { ...readJson(metaPath), surprise: true });

    const saves = store.list(dir);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.saveId).toBe(id);
    expect(saves[0]!.snapshotHash).toBe("");
    expect(saves[0]!.compatibilityVersion).toBe("5.0.0");
  });

  it("reports corrupt month-input metadata with an unmodeled key", () => {
    const id = saveOnce();
    const metaPath = join(dir, id, "metadata.json");
    writeJson(metaPath, { ...readJson(metaPath), surprise: true });

    const error = expectFailureTag(
      runExit(store.loadMonthInput(dir, id)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expect(error.message).toBe(`Save ${id} has no readable metadata`);
  });

  it("drops the predecessor when reverting to a save whose metadata has an unmodeled key", () => {
    saveOnce();
    store.save(minimalCampaignState(), dir);
    const b = store.getActiveSaveId(dir)!;
    const metaPath = join(dir, b, "metadata.json");
    writeJson(metaPath, { ...readJson(metaPath), surprise: true });

    expect(RecoveryManager.revert(dir, b)).toBe(true);
    expect(store.getActiveSaveId(dir)).toBe(b);
    expect(store.getPreviousSaveId(dir)).toBeNull();
  });
});

describe("SaveStore.list ordering", () => {
  let dir: string;
  let store: SaveStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "list-order-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("orders timestamps by code point, independent of locale collation", () => {
    store.save(minimalCampaignState(), dir);
    const template = store.list(dir)[0]!;
    const stamps = ["B-stamp", "a-stamp"];
    const ids = [
      "1700000000001-00000000-0000-0000-0000-000000000001",
      "1700000000002-00000000-0000-0000-0000-000000000002",
    ];
    ids.forEach((saveId, index) => {
      mkdirSync(join(dir, saveId), { recursive: true });
      writeJson(join(dir, saveId, "metadata.json"), {
        ...template,
        saveId,
        timestamp: stamps[index],
      });
    });

    const ordered = store
      .list(dir)
      .filter((save) => ids.includes(save.saveId))
      .map((save) => save.timestamp);
    expect(ordered).toEqual(["a-stamp", "B-stamp"]);
  });
});
