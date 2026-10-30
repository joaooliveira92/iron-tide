import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function state(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "month-input",
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
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign_state", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("SaveStore month input", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-month-input-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("round-trips the month input and records its hash in the metadata", () => {
    const store = new SaveStore();
    const input = { commands: [{ id: "c1", body: { b: 2, a: 1 } }], contentHash: "abc" };
    const { metadata } = store.save(state(), dir, { monthInput: input });
    expect(metadata.monthInputHash).toBe(sha256Hex(canonicalSerialize(input)));
    expect(unwrapSuccess(runExit(store.loadMonthInput(dir, metadata.saveId)))).toEqual({
      status: "present",
      value: input,
    });
    expect(unwrapSuccess(runExit(store.loadById(dir, metadata.saveId))).warnings).toHaveLength(0);
  });

  it("is absent on a save written without one (older saves, compile saves)", () => {
    const store = new SaveStore();
    const { metadata } = store.save(state(), dir);
    expect(metadata.monthInputHash).toBeUndefined();
    expect(unwrapSuccess(runExit(store.loadMonthInput(dir, metadata.saveId)))).toEqual({
      status: "absent",
    });
  });

  it("reports an altered, missing or escaping month input as corrupt, never as absent", () => {
    const store = new SaveStore();
    const { metadata, savePath } = store.save(state(), dir, { monthInput: { n: 1 } });
    writeFileSync(join(savePath, "month-input.json"), canonicalSerialize({ n: 2 }), "utf8");
    const error = expectFailureTag(
      runExit(store.loadMonthInput(dir, metadata.saveId)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expect(error.message).toMatch(/does not match its hash/);
    rmSync(join(savePath, "month-input.json"));
    expectFailureTag(
      runExit(store.loadMonthInput(dir, metadata.saveId)),
      "PERSISTENCE_CORRUPT_SAVE",
    );
    expectFailureTag(runExit(store.loadMonthInput(dir, "../x")), "PERSISTENCE_CORRUPT_SAVE");
  });
});
