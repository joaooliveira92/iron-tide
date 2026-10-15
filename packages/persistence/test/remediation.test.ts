// Boundary tests for the code-review remediation (TODO.md): directory-traversal
// rejection, signature-file validation, snapshotHash correctness, atomic
// publication, cancellation invariants, the list() signature fallback, and
// predecessor preservation across saves/recovery.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { RecoveryManager } from "../src/recovery.js";
import type { SigFile } from "../src/schemas.js";
import { toStorableSnapshot } from "../src/snapshotSerialization.js";
import { SaveStore } from "../src/store.js";

function fixture(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "remediation-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
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
    rulesetVersion: "1.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("persistence remediation", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "remediate-"));
    store = new SaveStore();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadById save-id validation (TODO #3)", () => {
    it("rejects traversal ids before any fs access", () => {
      store.save(fixture(), tmpDir);
      for (const bad of [
        "../outside",
        "../../outside",
        "a/b/c",
        "/absolute",
        join(tmpDir, "..", "escape"),
        "",
        "..",
      ]) {
        const d = new DiagnosticCollector();
        expect(store.loadById(tmpDir, bad, d)).toBeNull();
        expect(d.errors.some((e) => e.code === "PERSISTENCE_CORRUPT_SAVE")).toBe(true);
      }
    });

    it("still loads a valid id", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      expect(store.loadById(tmpDir, id, new DiagnosticCollector())).not.toBeNull();
    });
  });

  describe("signature-file validation (TODO #1/#5)", () => {
    it("rejects a save whose signature was tampered", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const sigPath = join(tmpDir, id, "campaign.sig.json");
      const sig = JSON.parse(readFileSync(sigPath, "utf8")) as SigFile;
      sig.serializedHash = "f".repeat(64);
      writeFileSync(sigPath, JSON.stringify(sig, null, 2), "utf8");

      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.errors.some((e) => e.code === "PERSISTENCE_CORRUPT_SAVE")).toBe(true);
    });

    it("rejects a save whose signature was deleted", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      writeFileSync(join(tmpDir, id, "campaign.sig.json"), "", "utf8");
      expect(store.load(tmpDir, new DiagnosticCollector())).toBeNull();
    });

    it("rejects a semantically-modified campaign.json", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const campaignPath = join(tmpDir, id, "campaign.json");
      const data = JSON.parse(readFileSync(campaignPath, "utf8"));
      data.snapshot.turnNumber = 99;
      writeFileSync(campaignPath, JSON.stringify(data), "utf8");

      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.errors.some((e) => e.code === "PERSISTENCE_CORRUPT_SAVE")).toBe(true);
    });

    it("rejects campaign.json whose hashes were recomputed but whose signature is stale", () => {
      // The point of the signature file is that the attacker must update BOTH
      // the in-file hashes AND the separately-written signature. Here they
      // recompute rawHash + envelope so the in-file gates alone would pass;
      // the untouched signature must still refuse the load.
      const state = fixture();
      store.save(state, tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const campaignPath = join(tmpDir, id, "campaign.json");
      const data = JSON.parse(readFileSync(campaignPath, "utf8"));

      state.snapshot.turnNumber = SafeInt(99);
      const envelope = createEnvelope(
        "campaign-snapshot",
        CURRENT_COMPATIBILITY_VERSION,
        state.snapshot,
      );
      data.snapshot.turnNumber = 99;
      data.envelope = envelope;
      data.rawHash = sha256Hex(canonicalSerialize({ snapshot: state.snapshot, envelope }));
      writeFileSync(campaignPath, JSON.stringify(data, null, 2), "utf8");

      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.errors.some((e) => e.code === "PERSISTENCE_CORRUPT_SAVE")).toBe(true);
    });

    it("loads a legacy save with no signature file, emitting a validation warning", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      rmSync(join(tmpDir, id, "campaign.sig.json"));

      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).not.toBeNull();
      expect(diagnostics.hasErrors).toBe(false);
      expect(diagnostics.warnings.some((w) => w.code === "PERSISTENCE_UNSIGNED_SAVE")).toBe(true);
    });

    it("round-trips a normally signed save with no false rejection or warning", () => {
      store.save(fixture(), tmpDir);
      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).not.toBeNull();
      expect(diagnostics.hasErrors).toBe(false);
      expect(diagnostics.warnings).toHaveLength(0);
    });
  });

  describe("metadata hashes (TODO #1/#2)", () => {
    it("snapshotHash is a real snapshot hash, not the campaign id", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const meta = JSON.parse(readFileSync(join(tmpDir, id, "metadata.json"), "utf8")) as {
        campaignId: string;
        snapshotHash: string;
        contentArtifactHash: string;
      };

      expect(meta.snapshotHash).not.toBe(meta.campaignId);
      expect(meta.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("snapshotHash equals sha256 of the storable snapshot, matching its name", () => {
      const state = fixture();
      store.save(state, tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const meta = JSON.parse(readFileSync(join(tmpDir, id, "metadata.json"), "utf8")) as {
        snapshotHash: string;
      };
      const expected = sha256Hex(canonicalSerialize(toStorableSnapshot(state.snapshot)));
      expect(meta.snapshotHash).toBe(expected);
    });

    it("contentArtifactHash equals sha256 of the exact on-disk campaign.json bytes", () => {
      const state = fixture();
      store.save(state, tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const meta = JSON.parse(readFileSync(join(tmpDir, id, "metadata.json"), "utf8")) as {
        contentArtifactHash: string;
      };
      const onDisk = readFileSync(join(tmpDir, id, "campaign.json"), "utf8");
      expect(meta.contentArtifactHash).toBe(sha256Hex(onDisk));
    });

    it("re-saving an identical state yields identical metadata hash values", () => {
      const state = fixture();
      store.save(state, tmpDir);
      store.save(state, tmpDir);
      const saves = store.list(tmpDir);
      expect(saves).toHaveLength(2);
      expect(saves[0]!.snapshotHash).toBe(saves[1]!.snapshotHash);
      expect(saves[0]!.contentArtifactHash).toBe(saves[1]!.contentArtifactHash);
    });

    it("re-loading a save recomputes the same snapshot hash it was saved with", () => {
      const state = fixture();
      store.save(state, tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      const meta = JSON.parse(readFileSync(join(tmpDir, id, "metadata.json"), "utf8")) as {
        snapshotHash: string;
      };
      const loaded = store.loadById(tmpDir, id, new DiagnosticCollector())!;
      const recomputed = sha256Hex(canonicalSerialize(toStorableSnapshot(loaded.snapshot)));
      expect(recomputed).toBe(meta.snapshotHash);
    });

    it("metadata records the save's predecessor", () => {
      store.save(fixture(), tmpDir);
      const first = store.getActiveSaveId(tmpDir)!;
      store.save(fixture(), tmpDir);
      const second = store.getActiveSaveId(tmpDir)!;
      const meta = JSON.parse(readFileSync(join(tmpDir, second, "metadata.json"), "utf8")) as {
        previousSaveId?: string;
      };
      expect(meta.previousSaveId).toBe(first);
    });
  });

  describe("atomic publication (TODO #4)", () => {
    it("each save is a complete self-contained directory with no temp leftovers", () => {
      store.save(fixture(), tmpDir);
      store.save(fixture(), tmpDir);
      const top = readdirSync(tmpDir);
      expect(top.some((f) => f.startsWith(".tmp_"))).toBe(false);
      const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
        activeSaveId: string;
      };
      for (const id of [pointer.activeSaveId, store.getPreviousSaveId(tmpDir)!]) {
        const files = readdirSync(join(tmpDir, id)).sort();
        expect(files).toEqual(["campaign.json", "campaign.sig.json", "metadata.json"]);
      }
      // A valid active save must always load (no partial publication is valid).
      expect(store.load(tmpDir, new DiagnosticCollector())).not.toBeNull();
    });
  });

  describe("cancellation invariants (TODO #5/#6)", () => {
    it("an aborted save leaves the pointer and save set untouched", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;

      const before = readdirSync(tmpDir).sort();
      const controller = new AbortController();
      controller.abort();
      let thrown: unknown;
      try {
        store.save(fixture(), tmpDir, controller.signal);
      } catch (err) {
        thrown = err;
      }
      expect((thrown as Error).name).toBe("AbortError");
      expect(store.getActiveSaveId(tmpDir)).toBe(id);
      expect(readdirSync(tmpDir).sort()).toEqual(before);
    });
  });

  describe("list() signature fallback (TODO #11)", () => {
    it("lists a valid signature when metadata is missing", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      writeFileSync(join(tmpDir, id, "metadata.json"), "corrupt", "utf8");

      const saves = store.list(tmpDir);
      expect(saves).toHaveLength(1);
      expect(saves[0]!.saveId).toBe(id);
      expect(saves[0]!.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);
    });

    it("does not mislabel snapshotHash with the whole-campaign state hash in the fallback", () => {
      store.save(fixture(), tmpDir);
      const id = store.getActiveSaveId(tmpDir)!;
      writeFileSync(join(tmpDir, id, "metadata.json"), "corrupt", "utf8");
      const sig = JSON.parse(
        readFileSync(join(tmpDir, id, "campaign.sig.json"), "utf8"),
      ) as SigFile;

      const saves = store.list(tmpDir);
      expect(saves).toHaveLength(1);
      // The degraded fallback record cannot reconstruct a genuine snapshot hash
      // (the sig file carries no such field), so it must be empty — not the
      // whole-campaign state hash that ticket 03 removed from the save path.
      expect(saves[0]!.snapshotHash).toBe("");
      expect(saves[0]!.snapshotHash).not.toBe(sig.stateHash);
    });
  });

  describe("recovery preserves the chain (TODO #7/#8)", () => {
    it("reverting to a save restores its persisted predecessor", () => {
      store.save(fixture(), tmpDir);
      const a = store.getActiveSaveId(tmpDir)!;
      store.save(fixture(), tmpDir);
      const b = store.getActiveSaveId(tmpDir)!;
      store.save(fixture(), tmpDir);
      const c = store.getActiveSaveId(tmpDir)!;
      expect(store.getPreviousSaveId(tmpDir)).toBe(b);

      expect(RecoveryManager.revert(tmpDir, b)).toBe(true);
      expect(store.getActiveSaveId(tmpDir)).toBe(b);
      // b's predecessor (a) is reconstructed from b's metadata, not lost.
      expect(store.getPreviousSaveId(tmpDir)).toBe(a);
      expect(store.getActiveSaveId(tmpDir)).not.toBe(c);
    });
  });

  describe("shutdown-crash resilience (TODO cleanup)", () => {
    it("stale temp directories are ignored by list()", () => {
      store.save(fixture(), tmpDir);
      mkdirSync(join(tmpDir, ".tmp_stale"), { recursive: true });
      const saves = store.list(tmpDir);
      expect(saves.some((s) => s.saveId.startsWith(".tmp_"))).toBe(false);
    });
  });
});
