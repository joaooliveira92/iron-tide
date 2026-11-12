import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  DiplomaticRelation,
  NationState,
} from "@bluewave/campaign";
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

function makeState(
  nation: NationState,
  version = CURRENT_COMPATIBILITY_VERSION,
  relations: DiplomaticRelation[] = [],
): CampaignState {
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
    politics: { relations, shells: {} },
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

  it("is stamped with compatibility 5.2.0", () => {
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("5.2.0");
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

  it("save -> load preserves a pending dilemma, and a nation without one stays without", () => {
    const pending = { eventId: "naval_scare", drawnMonth: "1881-04" };
    const withPending = makeNation({
      governmentType: "autocratic",
      eventHistory: { fired: [], flags: [], pending },
    });
    const state = makeState(withPending);
    const store = new SaveStore();
    store.save(state, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    expect(loaded.state.snapshot.nations.get("nation-a")?.eventHistory).toEqual({
      fired: [],
      flags: [],
      pending,
    });
    expect(loaded.state.rawHash).toBe(state.rawHash);

    const quiet = makeNation({ eventHistory: { fired: [], flags: [] } });
    const quietState = makeState(quiet);
    rmSync(tmpDir, { recursive: true, force: true });
    store.save(quietState, tmpDir);
    const reloaded = unwrapSuccess(runExit(store.load(tmpDir)));
    expect("pending" in reloaded.state.snapshot.nations.get("nation-a")!.eventHistory!).toBe(false);
  });

  it("save -> load preserves answer effects, unrest, budget modifiers and a content prestige reason", () => {
    const effects = {
      lines: [
        {
          source: "DECLARED" as const,
          budgetBp: 300,
          prestigeDelta: 2,
          unrestDelta: 2,
          tensionDelta: 2,
        },
        {
          source: "TRAIT" as const,
          trait: "cautious" as const,
          reasonCode: "CAUTIOUS_ADVENTURE",
          budgetBp: 0,
          prestigeDelta: -2,
          unrestDelta: 0,
          tensionDelta: 0,
        },
      ],
      budgetBp: 300,
      prestigeDelta: 0,
      unrestBefore: 0,
      unrestAfter: 2,
      tensionPartner: "nation-b",
      tensionBefore: 4,
      tensionAfter: 6,
    };
    const nation = makeNation({
      governmentType: "autocratic",
      eventHistory: {
        fired: [
          {
            eventId: "border_incident",
            month: "1880-02",
            answerId: "mobilise",
            resolvedBy: "AI",
            effects,
          },
        ],
        flags: [],
      },
      unrest: 2,
      budgetModifiers: [
        {
          eventId: "border_incident",
          answerId: "mobilise",
          firstMonth: "1880-03",
          initialBp: 300,
          decayMonths: 12,
          capBp: 600,
        },
      ],
      prestigeLastChange: {
        reasonCode: "BORDER_STAND",
        before: SafeInt(20),
        after: SafeInt(22),
        delta: SafeInt(2),
        month: "1880-02",
      },
    });
    const state = makeState(nation);
    const store = new SaveStore();
    store.save(state, tmpDir);

    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    const restored = loaded.state.snapshot.nations.get("nation-a")!;
    expect(restored.unrest).toBe(2);
    expect(restored.budgetModifiers).toEqual(nation.budgetModifiers);
    expect(restored.eventHistory!.fired[0]!.effects).toEqual(effects);
    expect(restored.prestigeLastChange?.reasonCode).toBe("BORDER_STAND");
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

  it("save -> load keeps a relation's authored friction, and a relation without it stays without", () => {
    const relations: DiplomaticRelation[] = [
      {
        nationA: "nation-a",
        nationB: "nation-b",
        relation: "neutral",
        tension: 6,
        nap: false,
        frictionBp: 60,
        since: "1880-01",
      },
      {
        nationA: "nation-a",
        nationB: "nation-c",
        relation: "allied",
        tension: 1,
        nap: true,
        since: "1880-01",
      },
    ];
    const state = makeState(makeNation({}), CURRENT_COMPATIBILITY_VERSION, relations);
    const store = new SaveStore();
    store.save(state, tmpDir);

    const restored = unwrapSuccess(runExit(store.load(tmpDir))).state.snapshot.politics.relations;
    expect(restored[0]?.frictionBp).toBe(60);
    expect("frictionBp" in restored[1]!).toBe(false);
    expect(restored).toEqual(relations);
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
