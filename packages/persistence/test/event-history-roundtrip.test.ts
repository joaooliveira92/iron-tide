import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  COMPATIBILITY_MISMATCH_CODE,
  CURRENT_COMPATIBILITY_VERSION,
} from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function makeNation(extra: Partial<NationState>): NationState {
  return {
    id: "nation-a",
    name: "Nation A",
    tag: "NVA",
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(0),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: "nation-a",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...extra,
  };
}

function makeState(nation: NationState, version = CURRENT_COMPATIBILITY_VERSION): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "event-history-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Area One", type: "sea" }], routes: [], ports: [] },
    nations: new Map([["nation-a", nation]]),
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
    compatibilityVersion: version,
  };
  const envelope = createEnvelope("campaign-snapshot", version, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("SaveStore round-trips government type, traits and fired-event history", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-event-history-"));
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("is stamped with compatibility 5.0.0", () => {
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("5.0.0");
  });

  it("save -> load preserves the government, traits, fired events and flags exactly", () => {
    const eventHistory = {
      fired: [
        { eventId: "naval_scare", month: "1881-03", answerId: "arm", resolvedBy: "PLAYER" },
        { eventId: "press_campaign", month: "1882-07", answerId: "hold", resolvedBy: "DEFAULT" },
      ],
      flags: ["naval_scare_armed"],
    } as const;
    const nation = makeNation({
      governmentType: "liberal_democracy",
      traits: ["cautious", "global_naval_power"],
      eventHistory: { fired: [...eventHistory.fired], flags: [...eventHistory.flags] },
    });
    const state = makeState(nation);
    const store = new SaveStore();
    store.save(state, tmpDir);

    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    const restored = loaded.state.snapshot.nations.get("nation-a");
    expect(loaded.warnings).toEqual([]);
    expect(restored?.governmentType).toBe("liberal_democracy");
    expect(restored?.traits).toEqual(["cautious", "global_naval_power"]);
    expect(restored?.eventHistory).toEqual(eventHistory);
    expect(loaded.state.rawHash).toBe(state.rawHash);
  });

  it("save -> load keeps a nation without the new fields free of them", () => {
    const state = makeState(makeNation({}));
    const store = new SaveStore();
    store.save(state, tmpDir);

    const restored = unwrapSuccess(runExit(store.load(tmpDir))).state.snapshot.nations.get(
      "nation-a",
    );
    expect(restored).toBeDefined();
    expect("governmentType" in restored!).toBe(false);
    expect("eventHistory" in restored!).toBe(false);
  });

  it("refuses a 4.0.0 save with the stable mismatch code", () => {
    const previous = "4.0.0";
    new SaveStore(previous).save(makeState(makeNation({}), previous), tmpDir);

    const error = expectFailureTag(
      runExit(new SaveStore().load(tmpDir)),
      "PERSISTENCE_COMPATIBILITY_MISMATCH",
    );
    expect(error.code).toBe(COMPATIBILITY_MISMATCH_CODE);
  });
});
