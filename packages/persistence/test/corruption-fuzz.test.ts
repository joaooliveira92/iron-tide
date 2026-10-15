import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";

/**
 * Corruption fuzz: a save file is attacker/mutation-controlled input. For a deterministic,
 * offline game the whole point of the persistence integrity contract (ADR-0032) is that a
 * tampered or truncated save is *rejected*, never executed and never crashes the loader.
 * This drives a fixed set of hostile mutations through the real store and asserts load()
 * always fails closed — a typed null + diagnostics — and never throws.
 */
function createFixtureState(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "fuzz-campaign",
    startYear: 1880,
    startMonth: 1,
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
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

/** [name, mutate, expectReject] — expectReject is false only where a mutation might legitimately survive. */
type Mutation = readonly [string, (s: string) => string, boolean];

describe("SaveStore — corruption fuzz", () => {
  let tmpDir: string;
  let store: SaveStore;
  let campaignPath: string;
  let valid: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-fuzz-"));
    store = new SaveStore();
    store.save(createFixtureState(), tmpDir);
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    campaignPath = join(tmpDir, pointer.activeSaveId, "campaign.json");
    valid = readFileSync(campaignPath, "utf8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const mutations: readonly Mutation[] = [
    ["empty file", () => "", true],
    ["truncated to one byte", () => "{", true],
    ["non-JSON garbage", () => "not json at all", true],
    ["JSON null", () => "null", true],
    ["JSON array", () => "[]", true],
    ["truncated mid-object", () => valid.slice(0, Math.floor(valid.length / 2)), true],
    ["half the bytes flipped", (s) => s.replace(/[\s\S]/g, (c, i) => (i % 2 ? "x" : c)), true],
    ["every digit zeroed", (s) => s.replace(/[0-9]/g, "0"), true],
    ["null byte spliced in", (s) => s.slice(0, 10) + "\u0000\u0000" + s.slice(10), true],
    [
      "snapshot field removed",
      (s) =>
        JSON.stringify(
          Object.fromEntries(
            Object.entries(JSON.parse(s) as object).filter(([k]) => k !== "snapshot"),
          ),
        ),
      true,
    ],
    ["top-level type swapped to string", () => '"a string where an object belongs"', true],
    [
      "turnNumber coerced to a string",
      (s) => s.replace(/"turnNumber":\s*[^,}]+/, '"turnNumber": "not-a-number"'),
      true,
    ],
    ["duplicated top-level keys", (s) => s.replace("{", '{"snapshot":{},"snapshot":{},'), true],
    // A padded unknown key may legitimately be stripped and load; it must still never throw.
    ["giant padded value", (s) => s.replace("{", `{"__pad":"${"A".repeat(200_000)}",`), false],
  ];

  it("never throws, and fails closed on a mutated save body", () => {
    for (const [name, mutate, expectReject] of mutations) {
      writeFileSync(campaignPath, mutate(valid), "utf8");
      const diagnostics = new DiagnosticCollector();

      let loaded: CampaignState | null | undefined;
      expect(() => {
        loaded = store.load(tmpDir, diagnostics);
      }, `mutation: ${name}`).not.toThrow();

      if (expectReject) {
        // The integrity contract: a mutated body is rejected, never returned as authoritative state.
        expect(loaded ?? null, `mutation: ${name} should be rejected`).toBeNull();
        expect(diagnostics.hasErrors, `mutation: ${name} should report an error`).toBe(true);
      }
    }
  });

  it("still loads the pristine save (the fuzz mutations did not move the goalposts)", () => {
    writeFileSync(campaignPath, valid, "utf8");
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);
    expect(loaded).not.toBeNull();
    expect(diagnostics.hasErrors).toBe(false);
  });
});
