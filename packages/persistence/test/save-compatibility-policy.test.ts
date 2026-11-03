import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  COMPATIBILITY_MISMATCH_CODE,
  CURRENT_COMPATIBILITY_VERSION,
  PART_MODEL_COMPATIBILITY_VERSION,
} from "../src/compatibility.js";
import { writeSaveManifest } from "../src/manifest.js";
import { SaveStore } from "../src/store.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function createFixtureState(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "save-compat-fixture",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: {
      areas: [{ id: "area-1", name: "Test Area", type: "sea" }],
      routes: [],
      ports: [],
    },
    nations: new Map(),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };

  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));

  return { snapshot, envelope, rawHash };
}

describe("save-compatibility policy", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "save-compat-policy-"));
    store = new SaveStore();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("locks CURRENT_COMPATIBILITY_VERSION to the current release constant", () => {
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("5.0.0");
  });

  it("round-trips a snapshot saved at the current compatibility version", () => {
    const state = createFixtureState();
    store.save(state, tmpDir);

    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.snapshot.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);
    expect(loaded.state.rawHash).toBe(state.rawHash);
    expect(loaded.state.envelope.bodyHash).toBe(state.envelope.bodyHash);
  });

  it("rejects a save stored with a prior compatibility version using the stable mismatch code", () => {
    const state = createFixtureState();
    store.save(state, tmpDir);

    const saveId = store.getActiveSaveId(tmpDir);
    expect(saveId).not.toBeNull();
    const campaignPath = join(tmpDir, saveId!, "campaign.json");
    const parsed = JSON.parse(readFileSync(campaignPath, "utf8")) as {
      snapshot: { compatibilityVersion: string };
    };
    parsed.snapshot.compatibilityVersion = "1.0.0";
    writeFileSync(campaignPath, JSON.stringify(parsed), "utf8");
    writeSaveManifest(join(tmpDir, saveId!));

    const error = expectFailureTag(
      runExit(store.load(tmpDir)),
      "PERSISTENCE_COMPATIBILITY_MISMATCH",
    );

    expect(error.code).toBe(COMPATIBILITY_MISMATCH_CODE);
    expect(error.message).toContain('Save compatibility version "1.0.0"');
    expect(error.message).toContain(CURRENT_COMPATIBILITY_VERSION);
    expect(error.stage).toBe("persistence.load");
  });

  it.each(["1.0.0", "1.1.0", "3.0.0"])(
    "rejects a pre-change save at %s with the stable mismatch code (documented rejection, ADR-0129)",
    (prior) => {
      const state = createFixtureState();
      store.save(state, tmpDir);
      const saveId = store.getActiveSaveId(tmpDir);
      const campaignPath = join(tmpDir, saveId!, "campaign.json");
      const parsed = JSON.parse(readFileSync(campaignPath, "utf8")) as {
        snapshot: { compatibilityVersion: string };
      };
      parsed.snapshot.compatibilityVersion = prior;
      writeFileSync(campaignPath, JSON.stringify(parsed), "utf8");
      writeSaveManifest(join(tmpDir, saveId!));

      const error = expectFailureTag(
        runExit(store.load(tmpDir)),
        "PERSISTENCE_COMPATIBILITY_MISMATCH",
      );
      expect(error.code).toBe(COMPATIBILITY_MISMATCH_CODE);
    },
  );

  it("keeps the named part-model version while the current release moves on", () => {
    expect(PART_MODEL_COMPATIBILITY_VERSION).toBe("2.0.0");
  });

  it("refuses a 2.0.0 campaign at the current 5.0.0 version, leaving the file byte-identical", () => {
    const legacy = createFixtureState();
    const legacySnapshot = { ...legacy.snapshot, compatibilityVersion: "2.0.0" };
    const legacyEnvelope = createEnvelope("campaign-snapshot", "2.0.0", legacySnapshot);
    const legacyRawHash = sha256Hex(
      canonicalSerialize({ snapshot: legacySnapshot, envelope: legacyEnvelope }),
    );
    store.save(
      { snapshot: legacySnapshot, envelope: legacyEnvelope, rawHash: legacyRawHash },
      tmpDir,
    );
    const campaignPath = join(tmpDir, store.getActiveSaveId(tmpDir)!, "campaign.json");
    const before = readFileSync(campaignPath);

    const error = expectFailureTag(
      runExit(store.load(tmpDir)),
      "PERSISTENCE_COMPATIBILITY_MISMATCH",
    );

    expect(error.code).toBe(COMPATIBILITY_MISMATCH_CODE);
    expect(error.message).toContain('"2.0.0"');
    expect(error.message).toContain(CURRENT_COMPATIBILITY_VERSION);
    expect(readFileSync(campaignPath).equals(before)).toBe(true);
  });
});
