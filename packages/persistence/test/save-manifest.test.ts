import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import {
  SAVE_FORMAT_VERSION,
  SAVE_HASH_VERSION,
  SAVE_MANIFEST_FILE,
  verifySaveManifest,
} from "../src/manifest.js";
import { SaveStore } from "../src/store.js";
import { minimalCampaignState } from "./campaign-state-fixture.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";

interface ManifestFile {
  name: string;
  hash: string;
}

describe("save integrity manifest", () => {
  let dir: string;
  let store: SaveStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "save-manifest-"));
    store = new SaveStore();
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const saved = () => {
    store.save(minimalCampaignState(), dir, undefined, { monthInput: { month: 1 } });
    return store.getActiveSaveId(dir)!;
  };

  it("lists every save file with its hash, the format version and the hash version", () => {
    const id = saved();
    const manifest = JSON.parse(readFileSync(join(dir, id, SAVE_MANIFEST_FILE), "utf8")) as {
      formatVersion: number;
      hashVersion: string;
      files: ManifestFile[];
    };

    expect(manifest.formatVersion).toBe(SAVE_FORMAT_VERSION);
    expect(manifest.hashVersion).toBe(SAVE_HASH_VERSION);
    expect(manifest.files.map((file) => file.name)).toEqual([
      "campaign.json",
      "metadata.json",
      "month-input.json",
    ]);
    for (const file of manifest.files) {
      expect(file.hash).toBe(sha256Hex(readFileSync(join(dir, id, file.name), "utf8")));
    }
    expect(verifySaveManifest(join(dir, id))).toEqual({ status: "current" });
  });

  it.each([
    ["campaign.json", "Saved campaign data failed its integrity check"],
    ["metadata.json", "Saved campaign metadata failed its integrity check"],
    ["month-input.json", "Saved month input failed its integrity check"],
  ])("fails with a distinct message when one byte in %s changes", (name, message) => {
    const id = saved();
    const path = join(dir, id, name);
    const content = readFileSync(path, "utf8");
    writeFileSync(
      path,
      content.replace(/[0-9]/, (digit) => (digit === "9" ? "8" : "9")),
      "utf8",
    );

    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe(message);
  });

  it("fails closed when a saved file is not listed", () => {
    const id = saved();
    writeFileSync(join(dir, id, "stray.json"), "{}", "utf8");
    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe("Save integrity manifest does not list every saved file");
  });

  it("fails closed when a listed file is missing", () => {
    const id = saved();
    rmSync(join(dir, id, "month-input.json"));
    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).toBe("A file listed in the save manifest is missing");
  });

  it("loads a previous-format save with a legacy integrity record and one warning", () => {
    const state = minimalCampaignState();
    store.save(state, dir);
    const id = store.getActiveSaveId(dir)!;
    const campaignJson = readFileSync(join(dir, id, "campaign.json"), "utf8");
    writeFileSync(
      join(dir, id, "campaign.sig.json"),
      JSON.stringify(
        {
          serializedHash: sha256Hex(campaignJson),
          stateHash: state.rawHash,
          compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
        },
        null,
        2,
      ),
      "utf8",
    );
    rmSync(join(dir, id, SAVE_MANIFEST_FILE));

    const loaded = unwrapSuccess(runExit(store.load(dir)));
    expect(loaded.warnings).toHaveLength(1);
    expect(loaded.warnings[0]!.code).toBe("PERSISTENCE_LEGACY_SAVE");
    expect(loaded.warnings[0]!.message).not.toContain("signature");
  });

  it("rejects a previous-format save whose legacy integrity record does not match", () => {
    const state = minimalCampaignState();
    store.save(state, dir);
    const id = store.getActiveSaveId(dir)!;
    const campaignJson = readFileSync(join(dir, id, "campaign.json"), "utf8");
    writeFileSync(
      join(dir, id, "campaign.sig.json"),
      JSON.stringify(
        {
          serializedHash: sha256Hex(campaignJson),
          stateHash: sha256Hex(canonicalSerialize({ wrong: state.rawHash })),
          compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
        },
        null,
        2,
      ),
      "utf8",
    );
    rmSync(join(dir, id, SAVE_MANIFEST_FILE));

    const error = expectFailureTag(runExit(store.load(dir)), "PERSISTENCE_CORRUPT_SAVE");
    expect(error.message).not.toContain("signature");
  });

  it("the migration path seals the rewritten save", () => {
    const state = minimalCampaignState();
    store.save(state, dir);
    const id = store.getActiveSaveId(dir)!;
    expect(existsSync(join(dir, id, SAVE_MANIFEST_FILE))).toBe(true);
    expect(verifySaveManifest(join(dir, id))).toEqual({ status: "current" });
  });
});
