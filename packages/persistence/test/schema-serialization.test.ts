import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  canonicalSerialize,
  createEnvelope,
  sha256Hex,
  verifyEnvelope,
} from "@bluewave/deterministic";
import { Result, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import {
  decodeStorableCampaignState,
  PointerFileSchema,
  StorableCampaignStateSchema,
} from "../src/schemas.js";
import { fromStorableSnapshot } from "../src/snapshotSerialization.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function createFixtureState(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "schema-roundtrip",
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

describe("Effect Schema save-boundary serialization (MIG-WIRE-4)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-schema-wire-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("decodes the on-disk campaign.json with Effect Schema and canonicalizes to identical bytes", () => {
    const state = createFixtureState();
    store.save(state, tmpDir);
    const id = store.getActiveSaveId(tmpDir)!;
    const raw = readFileSync(join(tmpDir, id, "campaign.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);

    const decoded = Schema.decodeUnknownSync(StorableCampaignStateSchema)(parsed);

    expect(canonicalSerialize(decoded)).toBe(canonicalSerialize(parsed));

    const reconstituted = fromStorableSnapshot(
      decoded.snapshot as unknown as Parameters<typeof fromStorableSnapshot>[0],
    );
    expect(verifyEnvelope(decoded.envelope, reconstituted)).toBe(true);
    const { rawHash, ...stateForHash } = { ...decoded, snapshot: reconstituted };
    expect(sha256Hex(canonicalSerialize(stateForHash))).toBe(rawHash);
  });

  it("reloads a save after the on-disk artifact has been round-tripped through Effect Schema", () => {
    const state = createFixtureState();
    store.save(state, tmpDir);

    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.rawHash).toBe(state.rawHash);
    expect(loaded.state.envelope.bodyHash).toBe(state.envelope.bodyHash);
    expect(loaded.state.snapshot.campaignId).toBe("schema-roundtrip");
  });

  const minimalStorableState = () => ({
    snapshot: {
      version: "1.0.0",
      turnNumber: 1,
      campaignId: "minimal",
      startYear: 1880,
      startMonth: 1,
      world: {},
      nations: {},
      wars: {
        wars: [],
        battles: [],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
      politics: { relations: [], shells: {} },
      intelligence: { shells: {} },
      designs: {},
      designFamilies: {},
      prestigeRules: FIXTURE_PRESTIGE_RULES,
      rulesetVersion: "1.0.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    envelope: {
      algorithm: "sha256",
      artifactKind: "campaign-snapshot",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      bodyHash: "x",
      bodyLength: 1,
    },
    rawHash: "x",
  });

  it("fills the decoding defaults for absent collections", () => {
    const decoded = Schema.decodeUnknownSync(StorableCampaignStateSchema)(minimalStorableState());

    expect(decoded.snapshot.slots).toEqual([]);
    expect(decoded.snapshot.world.areas).toEqual([]);
    expect(decoded.snapshot.world.routes).toEqual([]);
    expect(decoded.snapshot.world.ports).toEqual([]);
    expect(decoded.snapshot.strategicWeather).toEqual([]);
  });

  it("rejects an unmodeled key at the top level and inside a struct (ADR-0278)", () => {
    const minimal = minimalStorableState();

    expect(Result.isSuccess(decodeStorableCampaignState(minimal))).toBe(true);
    expect(Result.isFailure(decodeStorableCampaignState({ ...minimal, __unmodeled: true }))).toBe(
      true,
    );
    expect(
      Result.isFailure(
        decodeStorableCampaignState({
          ...minimal,
          snapshot: { ...minimal.snapshot, __unmodeled: true },
        }),
      ),
    ).toBe(true);
  });

  it("rejects non-finite numbers, matching Zod v4 z.number() (Schema.Finite)", () => {
    const minimal = () => ({
      snapshot: {
        version: "1.0.0",
        turnNumber: 1,
        campaignId: "non-finite",
        startYear: 1880,
        startMonth: 1,
        world: {},
        nations: {},
        wars: {
          wars: [],
          battles: [],
          participantMemberships: [],
          blockadeState: [],
          battleManifests: [],
        },
        politics: { relations: [], shells: {} },
        intelligence: { shells: {} },
        designs: {},
        designFamilies: {},
        prestigeRules: FIXTURE_PRESTIGE_RULES,
        rulesetVersion: "1.0.0",
        compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      },
      envelope: {
        algorithm: "sha256",
        artifactKind: "campaign-snapshot",
        compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
        bodyHash: "x",
        bodyLength: 1,
      },
      rawHash: "x",
    });

    for (const bad of [Infinity, -Infinity, NaN]) {
      const crafted = minimal();
      crafted.snapshot.turnNumber = bad;
      expect(
        Result.isFailure(Schema.decodeUnknownResult(StorableCampaignStateSchema)(crafted)),
      ).toBe(true);
    }
  });

  it("keeps optional pointer fields optional (absent, not defaulted)", () => {
    expect(Schema.decodeUnknownSync(PointerFileSchema)({ activeSaveId: "s" })).toEqual({
      activeSaveId: "s",
    });
    expect(
      Schema.decodeUnknownSync(PointerFileSchema)({
        activeSaveId: "s",
        previousSaveId: "p",
        recoveredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      activeSaveId: "s",
      previousSaveId: "p",
      recoveredAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
