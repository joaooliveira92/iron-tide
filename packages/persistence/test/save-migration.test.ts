// Save migration (ship-part-model SPM-R21, ticket 11d). The migration is an
// offline, version-keyed transform, not a runtime load path: the product refuses
// a mismatched save (ADR-0113), and the developer tool brings fixtures forward.
// These tests prove the load and migration behaviour the version bump requires:
// explicit source detection, deterministic migration of every supported prior
// version, refusal of unsupported/future saves, preserved player identity, no
// guessed defaults, validation before publication, atomic recoverable writes and
// idempotency.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { detectSaveVersion, migrateSaveDirectory } from "../src/saveMigration.js";
import { SaveStore } from "../src/store.js";

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
    rulesetVersion: "1.0.0",
    compatibilityVersion,
  };
  const envelope = createEnvelope("campaign-snapshot", compatibilityVersion, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

/** Write a save directory at `version` and return the save-id directory. */
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

  it("migrates the supported 1.2.0 save to current and preserves player-owned identity", () => {
    const savePath = saveAt("1.2.0", tmpDir);
    const before = new SaveStore("1.2.0").loadById(
      tmpDir,
      basename(savePath),
      new DiagnosticCollector(),
    )!;

    const result = migrateSaveDirectory(savePath);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect([result.from, result.to]).toEqual(["1.2.0", CURRENT_COMPATIBILITY_VERSION]);

    const diagnostics = new DiagnosticCollector();
    const after = new SaveStore().load(tmpDir, diagnostics);
    expect(diagnostics.hasErrors).toBe(false);
    expect(after).not.toBeNull();
    if (after === null) return;
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
    expect(migrateSaveDirectory(savePath).status).toBe("migrated");
    expect(migrateSaveDirectory(savePath).status).toBe("current");
  });

  it("refuses an unsupported future version", () => {
    const result = migrateSaveDirectory(saveAt("4.0.0", tmpDir));
    expect(result.status).toBe("refused");
    if (result.status === "refused") expect(result.kind).toBe("future");
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
    const result = migrateSaveDirectory(savePath);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect(existsSync(result.backup)).toBe(true);
    expect(readFileSync(join(result.backup, "campaign.json")).equals(originalBytes)).toBe(true);
    expect(existsSync(`${savePath}.migrating`)).toBe(false);
  });
});
