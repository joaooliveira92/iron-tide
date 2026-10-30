import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { verifySaveManifest } from "../src/manifest.js";
import {
  detectSaveVersion,
  migrateSaveDirectory,
  SAVE_MIGRATIONS,
  type SaveMigrationStep,
} from "../src/saveMigration.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function fixtureState(compatibilityVersion: string): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "save-migration-fixture",
    startYear: 1880,
    startMonth: 3,
    strategicWeather: [],
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Test Area", type: "sea" }], routes: [], ports: [] },
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
    compatibilityVersion,
  };
  const envelope = createEnvelope("campaign-snapshot", compatibilityVersion, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

const INJECTED_STEPS: readonly SaveMigrationStep[] = [
  { from: "1.2.0", to: CURRENT_COMPATIBILITY_VERSION },
];

function saveAt(version: string, dir: string): string {
  new SaveStore().save(fixtureState(version), dir);
  const saveId = new SaveStore().getActiveSaveId(dir)!;
  return join(dir, saveId);
}

describe("save migration (ticket 11d)", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "save-migration-"));
  });
  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects the source version explicitly", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const raw = JSON.parse(readFileSync(join(savePath, "campaign.json"), "utf8"));
    expect(detectSaveVersion(raw)).toBe("1.2.0");
    expect(detectSaveVersion({ not: "a save" })).toBeNull();
  });

  it("migrates a save through an injected step to current and preserves player-owned identity", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const before = unwrapSuccess(
      runExit(new SaveStore("1.2.0").loadById(tmpDir, basename(savePath))),
    ).state;

    const result = migrateSaveDirectory(savePath, CURRENT_COMPATIBILITY_VERSION, INJECTED_STEPS);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect([result.from, result.to]).toEqual(["1.2.0", CURRENT_COMPATIBILITY_VERSION]);

    const after = unwrapSuccess(runExit(new SaveStore().load(tmpDir))).state;
    expect(after.snapshot.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);
    expect(after.snapshot.campaignId).toBe(before.snapshot.campaignId);
    expect(after.snapshot.turnNumber).toBe(before.snapshot.turnNumber);
    expect(after.snapshot.startYear).toBe(before.snapshot.startYear);
    expect(after.snapshot.startMonth).toBe(before.snapshot.startMonth);
    expect(after.snapshot.slots).toEqual(before.snapshot.slots);
  });

  it("is idempotent: a current save is a no-op and a migrated save re-migrates as current", () => {
    expect(migrateSaveDirectory(saveAt(CURRENT_COMPATIBILITY_VERSION, tmpDir)).status).toBe(
      "current",
    );
    const savePath = saveAt("1.2.0", tmpDir);
    const migrate = () =>
      migrateSaveDirectory(savePath, CURRENT_COMPATIBILITY_VERSION, INJECTED_STEPS);
    expect(migrate().status).toBe("migrated");
    expect(migrate().status).toBe("current");
  });

  it("keeps the metadata keys and their order when it rewrites a migrated save", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const metaPath = join(savePath, "metadata.json");
    const originalKeys = Object.keys(JSON.parse(readFileSync(metaPath, "utf8")));

    migrateSaveDirectory(savePath, CURRENT_COMPATIBILITY_VERSION, INJECTED_STEPS);

    expect(Object.keys(JSON.parse(readFileSync(metaPath, "utf8")))).toEqual(originalKeys);
  });

  it("refuses to migrate a save whose metadata carries an unmodeled key and leaves it untouched", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const metaPath = join(savePath, "metadata.json");
    const metadata = { ...JSON.parse(readFileSync(metaPath, "utf8")), surprise: true };
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf8");
    const campaignBefore = readFileSync(join(savePath, "campaign.json"), "utf8");

    const result = migrateSaveDirectory(savePath, CURRENT_COMPATIBILITY_VERSION, INJECTED_STEPS);

    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.kind).toBe("malformed");
    expect(readFileSync(join(savePath, "campaign.json"), "utf8")).toBe(campaignBefore);
    expect(JSON.parse(readFileSync(metaPath, "utf8"))).toEqual(metadata);
    expect(existsSync(`${savePath}.migrating`)).toBe(false);
  });

  it("refuses an unsupported future version", () => {
    const result = migrateSaveDirectory(saveAt("5.0.0", tmpDir));
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.kind).toBe("future");
  });

  it("ships no migration: bringing a save forward would invent a prestige and a value set", () => {
    expect(SAVE_MIGRATIONS).toEqual([]);
  });

  it("refuses every earlier version with the unknown kind instead of guessing defaults", () => {
    for (const version of ["1.2.0", "2.0.0", "3.0.0", "3.1.0"]) {
      const result = migrateSaveDirectory(saveAt(version, tmpDir));
      expect(result.status, version).toBe("refused");
      if (result.status === "refused") expect(result.kind, version).toBe("unknown");
    }
  });

  it("refuses a malformed save", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    writeFileSync(join(savePath, "campaign.json"), "{ not json", "utf8");
    const result = migrateSaveDirectory(savePath);
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.kind).toBe("malformed");
  });

  it("refuses a prior version with no registered migration rather than guessing defaults", () => {
    const result = migrateSaveDirectory(saveAt("1.0.0", tmpDir));
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.kind).toBe("unknown");
  });

  it("migrates a save directory atomically and leaves the original recoverable", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const originalBytes = readFileSync(join(savePath, "campaign.json"));
    const result = migrateSaveDirectory(savePath, CURRENT_COMPATIBILITY_VERSION, INJECTED_STEPS);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect(existsSync(result.backup)).toBe(true);
    expect(readFileSync(join(result.backup, "campaign.json")).equals(originalBytes)).toBe(true);
    expect(existsSync(`${savePath}.migrating`)).toBe(false);
    expect(verifySaveManifest(savePath)).toEqual({ status: "current" });
  });
});
