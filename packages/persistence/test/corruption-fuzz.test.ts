import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore, type LoadFailure, type LoadedSave } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

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
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

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
    ["giant padded value", (s) => s.replace("{", `{"__pad":"${"A".repeat(200_000)}",`), false],
  ];

  it("never throws, and fails closed on a mutated save body", () => {
    for (const [name, mutate, expectReject] of mutations) {
      writeFileSync(campaignPath, mutate(valid), "utf8");

      let exit: Exit.Exit<LoadedSave, LoadFailure> | undefined;
      expect(() => {
        exit = runExit(store.load(tmpDir));
      }, `mutation: ${name}`).not.toThrow();

      if (expectReject) {
        expect(
          exit !== undefined && Exit.isFailure(exit),
          `mutation: ${name} should be rejected`,
        ).toBe(true);
      }
    }
  });

  it("still loads the pristine save (the fuzz mutations did not move the goalposts)", () => {
    writeFileSync(campaignPath, valid, "utf8");
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    expect(loaded.warnings).toEqual([]);
  });
});
