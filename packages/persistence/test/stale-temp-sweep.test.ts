import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { PersistenceInvalidOptionError, SaveStore, sweepStaleTemp } from "../src/index.js";
import { minimalCampaignState } from "./campaign-state-fixture.js";

describe("stale temp sweep and retention", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-sweep-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("removes abandoned temp directories, migrating directories and pointer temp files", () => {
    mkdirSync(join(dir, ".tmp_abandoned"));
    mkdirSync(join(dir, "1700000000000-x.migrating"));
    writeFileSync(join(dir, "pointer.json.tmp"), "{}");
    sweepStaleTemp(dir);
    expect(existsSync(join(dir, ".tmp_abandoned"))).toBe(false);
    expect(existsSync(join(dir, "1700000000000-x.migrating"))).toBe(false);
    expect(existsSync(join(dir, "pointer.json.tmp"))).toBe(false);
  });

  it("keeps migration backups", () => {
    mkdirSync(join(dir, ".bak_migrated_abc.from-0.0.1"));
    sweepStaleTemp(dir);
    expect(existsSync(join(dir, ".bak_migrated_abc.from-0.0.1"))).toBe(true);
  });

  it("is a no-op for a missing directory", () => {
    expect(() => sweepStaleTemp(join(dir, "absent"))).not.toThrow();
  });

  it("save sweeps leftovers from a crashed earlier save", () => {
    mkdirSync(join(dir, ".tmp_crashed"));
    new SaveStore().save(minimalCampaignState(), dir);
    expect(existsSync(join(dir, ".tmp_crashed"))).toBe(false);
  });

  it("prunes old saves beyond the retention count but keeps active and previous", () => {
    const store = new SaveStore(undefined, { retainSaves: 2 });
    for (let i = 0; i < 4; i += 1) store.save(minimalCampaignState(), dir);
    const remaining = store.list(dir);
    expect(remaining).toHaveLength(2);
    const ids = remaining.map((save) => save.saveId);
    expect(ids).toContain(store.getActiveSaveId(dir));
    expect(ids).toContain(store.getPreviousSaveId(dir));
  });

  it("keeps every save when no retention is configured", () => {
    const store = new SaveStore();
    for (let i = 0; i < 3; i += 1) store.save(minimalCampaignState(), dir);
    expect(store.list(dir)).toHaveLength(3);
  });
});

describe("injected clock", () => {
  it("derives save id and timestamp from the clock port", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-clock-"));
    try {
      const store = new SaveStore(undefined, {
        clock: {
          nowMillis: () => 1700000000000,
          nowIso: () => "2023-11-14T22:13:20.000Z",
          uuid: () => "00000000-0000-4000-8000-000000000000",
        },
      });
      const result = store.save(minimalCampaignState(), dir);
      expect(result.metadata.saveId).toBe("1700000000000-00000000-0000-4000-8000-000000000000");
      expect(result.metadata.timestamp).toBe("2023-11-14T22:13:20.000Z");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("retention option validation", () => {
  it("rejects a retention below the active and previous pair", () => {
    expect(() => new SaveStore(undefined, { retainSaves: 1 })).toThrow(
      PersistenceInvalidOptionError,
    );
  });
});
