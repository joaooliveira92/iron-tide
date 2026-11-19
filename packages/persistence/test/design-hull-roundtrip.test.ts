import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, CompiledDesignVersion } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { StorableCompiledDesignVersionSchema } from "../src/schemas.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const design = (withHull: boolean): CompiledDesignVersion => ({
  designVersionId: "dv-hull",
  designFamilyId: "fam-hull",
  className: "Hull class",
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
  ...(withHull ? { hullLengthMm: SafeInt(95_000), hullBeamMm: SafeInt(12_500) } : {}),
});

function state(withHull: boolean): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "design-hull-roundtrip",
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
    designs: new Map([["dv-hull", design(withHull)]]),
    designFamilies: new Map(),
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("compiled design hull dimensions persistence", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-design-hull-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the hull length and beam unchanged", () => {
    const saved = state(true);
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    const stored = loaded.state.snapshot.designs.get("dv-hull")!;

    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded.state.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(stored.hullLengthMm).toBe(95_000);
    expect(stored.hullBeamMm).toBe(12_500);
  });

  it("round-trips a design that carries no hull dimensions without inventing them", () => {
    const saved = state(false);
    store.save(saved, tmpDir);
    const stored = unwrapSuccess(runExit(store.load(tmpDir))).state.snapshot.designs.get(
      "dv-hull",
    )!;

    expect(stored.hullLengthMm).toBeUndefined();
    expect(stored.hullBeamMm).toBeUndefined();
  });

  it("rejects a non-numeric hull length", () => {
    const decoded = Schema.decodeUnknownResult(StorableCompiledDesignVersionSchema, {
      onExcessProperty: "error",
    })({ ...design(true), hullLengthMm: "long" });
    expect(decoded._tag).toBe("Failure");
  });
});
