import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, CompiledDesignVersion } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import {
  StorableCompiledDesignVersionSchema,
  StorableDesignCapabilitiesSchema,
} from "../src/schemas.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const design = (): CompiledDesignVersion => ({
  designVersionId: "dv-capability",
  designFamilyId: "fam-capability",
  className: "Capability class",
  nationId: "nation-a",
  hullType: "KE",
  normalizedDisplacementKg: SafeInt(1_000_000),
  normalizedSpeedUms: SafeInt(10_000_000),
  normalizedArmorUm: SafeInt(0),
  hitPoints: SafeInt(100),
  mainGunsCaliber: SafeInt(0),
  mainGunsCount: SafeInt(0),
  machineryType: "steam",
  crewComplement: SafeInt(10),
  contentVersion: "t",
  compiledHash: "h",
  capabilities: [{ kind: "damage_control", effectBp: 500 }],
});

function state(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "design-capabilities-roundtrip",
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
    designs: new Map([["dv-capability", design()]]),
    designFamilies: new Map(),
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("compiled design capabilities persistence", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-design-capabilities-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the canonically ordered capability list unchanged", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded.state.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded.state.snapshot.designs.get("dv-capability")!.capabilities).toEqual([
      { kind: "damage_control", effectBp: 500 },
    ]);
  });

  it("decodes capabilities strictly and rejects an unsorted list", () => {
    const unsorted = Schema.decodeUnknownResult(StorableDesignCapabilitiesSchema, {
      onExcessProperty: "error",
    })([
      { kind: "fire_control_class", class: "heavy" },
      { kind: "damage_control", effectBp: 500 },
    ]);
    expect(unsorted._tag).toBe("Failure");

    const sorted = Schema.decodeUnknownResult(StorableDesignCapabilitiesSchema, {
      onExcessProperty: "error",
    })([
      { kind: "damage_control", effectBp: 500 },
      { kind: "fire_control_class", class: "heavy" },
    ]);
    expect(sorted._tag).toBe("Success");
  });

  it("rejects an excess key on the stored design", () => {
    const raw = {
      ...design(),
      unexpected: true,
    };
    const decoded = Schema.decodeUnknownResult(StorableCompiledDesignVersionSchema, {
      onExcessProperty: "error",
    })(raw);
    expect(decoded._tag).toBe("Failure");
  });
});
