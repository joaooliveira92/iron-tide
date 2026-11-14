import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, PeaceOffer } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const STATUS_QUO: PeaceOffer = {
  warId: "war_1",
  proposerId: "FRA",
  targetId: "GBR",
  month: "1880-02",
  term: { _tag: "StatusQuo" },
  reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
};

const CEDE_AREA: PeaceOffer = {
  warId: "war_2",
  proposerId: "DEU",
  targetId: "GBR",
  month: "1880-03",
  term: { _tag: "CedeArea", areaId: "a-1" },
  reasonCode: "PROPOSER_LEADS_BY_MARGIN",
};

function state(offers: readonly PeaceOffer[] | undefined): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "peace-offer-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
      ...(offers === undefined ? {} : { peaceOffers: [...offers] }),
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

describe("pending peace offer save/load parity", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-peace-offer-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function tamper(edit: (wars: Record<string, unknown>) => void): void {
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const file = join(tmpDir, pointer.activeSaveId, "campaign.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      snapshot: { wars: Record<string, unknown> };
    };
    edit(raw.snapshot.wars);
    writeFileSync(file, JSON.stringify(raw));
  }

  it("round-trips both offer terms and the hash exactly", () => {
    const saved = state([STATUS_QUO, CEDE_AREA]);
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded.state.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded.state.snapshot.wars.peaceOffers).toEqual([STATUS_QUO, CEDE_AREA]);
  });

  it("loads a save without offers with the field absent, under the unchanged compatibility version", () => {
    const saved = state(undefined);
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect("peaceOffers" in loaded.state.snapshot.wars).toBe(false);
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("5.2.0");
  });

  it("refuses, rather than silently loading, a save whose offers a reader without them would drop (R15)", () => {
    store.save(state([STATUS_QUO]), tmpDir);
    tamper((wars) => {
      delete wars["peaceOffers"];
    });
    expectFailureTag(runExit(store.load(tmpDir)), "PERSISTENCE_CORRUPT_SAVE");
  });

  it("refuses a save holding a malformed, short or over-keyed offer", () => {
    for (const bad of [
      { ...STATUS_QUO, warId: "" },
      { ...STATUS_QUO, proposerId: "" },
      { ...STATUS_QUO, month: "1880-13" },
      { ...STATUS_QUO, term: { _tag: "Annex" } },
      { ...CEDE_AREA, term: { _tag: "CedeArea" } },
      { ...CEDE_AREA, term: { _tag: "CedeArea", areaId: "" } },
      { ...STATUS_QUO, extra: "x" },
      { warId: "war_1" },
      "not-an-object",
    ]) {
      store.save(state([STATUS_QUO]), tmpDir);
      tamper((wars) => {
        wars["peaceOffers"] = [bad];
      });
      expectFailureTag(runExit(store.load(tmpDir)), "PERSISTENCE_CORRUPT_SAVE");
    }
  });
});
