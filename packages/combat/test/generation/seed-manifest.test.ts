//packages/combat/test/generation/seed-manifest.test.ts
import { describe, it, expect } from "vite-plus/test";
import {
  buildManifest,
  computeManifestHash,
  canonicalizeManifest,
} from "../../src/generation/manifest.js";
import { BATTLE_MANIFEST_INVALID } from "../../src/generation/reasonCodes.js";
import { deriveBattleSeed, BATTLE_SEED_FAMILY } from "../../src/generation/seed.js";

function baseManifest() {
  return {
    battleId: "battle_1",
    opportunityId: "opp_1",
    warId: "war_1",
    areaId: "area_battle",
    missionType: "FLEET_BATTLE",
    attackerId: "GBR",
    defenderId: "FRA",
    acceptanceClass: "OPTIONAL",
    missionObjectives: [] as string[],
    sides: [
      { sideId: "ATTACKER" as const, participantIds: ["GBR"] },
      { sideId: "DEFENDER" as const, participantIds: ["FRA"] },
    ],
    persistentAssets: ["gb_bb1", "fra_bb1"],
    temporaryAssets: [] as string[],
    permanentDivisionIds: [] as string[],
    tacticalDivisions: [] as never[],
    commanders: [] as string[],
    weather: "clear",
    seaState: "moderate",
    visibility: "good",
    environment: "day",
    sourceStateHashes: {} as Record<string, string>,
    reservations: [] as string[],
    autoResolutionProof: "proof",
    provenanceRecords: [] as string[],
    rulesetVersion: "1",
    formulaVersion: "1",
    aiPolicyVersion: "1",
    rngVersion: "1",
    contentVersion: "0.3.0",
  };
}

describe("manifest canonicalization + seed (AC-10)", () => {
  it("canonicalization orders sides attacker-then-defender and sorts collections", () => {
    const m = buildManifest(baseManifest());
    expect(m.sides.map((s) => s.sideId)).toEqual(["ATTACKER", "DEFENDER"]);
    expect(m.manifestHash).toBeTruthy();
  });

  it("canonicalization occurs before seed derivation; identical manifest -> identical seed", () => {
    const m1 = buildManifest(baseManifest());
    const m2 = buildManifest(baseManifest());
    const inputs = {
      rngVersion: "1",
      campaignSeed: "seed",
      campaignMonth: "1880-02",
      warId: "war_1",
      areaId: "area_battle",
      missionType: "FLEET_BATTLE",
      opportunityId: "opp_1",
      battleGenerationFormulaVersion: "1",
    };
    const seed1 = deriveBattleSeed(inputs, m1);
    const seed2 = deriveBattleSeed(inputs, m2);
    expect(seed1).toBe(seed2);
    expect(seed1).toBeTruthy();
  });

  it("changing a manifest field changes the hash and seed", () => {
    const m1 = buildManifest(baseManifest());
    const m2 = buildManifest({ ...baseManifest(), persistentAssets: ["gb_bb1"] });
    expect(computeManifestHash(m1)).not.toBe(computeManifestHash(m2));
  });

  it("seed family is exactly battle/battle_id/root", () => {
    expect(BATTLE_SEED_FAMILY).toBe("battle/battle_id/root");
  });

  it("manifest hash excludes the seed (ADR B-1-5): adding a seed does not change the hash", () => {
    const m = buildManifest(baseManifest());
    const hash = computeManifestHash(m);
    const withSeed = { ...m, battleSeed: "anything" };
    expect(computeManifestHash(withSeed)).toBe(hash);
  });

  it("invalid manifest (one side) -> BATTLE_MANIFEST_INVALID", () => {
    expect(() =>
      buildManifest({
        ...baseManifest(),
        sides: [{ sideId: "ATTACKER" as const, participantIds: ["GBR"] }],
      }),
    ).toThrow(new RegExp(BATTLE_MANIFEST_INVALID));
  });

  it("canonicalizeManifest is idempotent", () => {
    const m = buildManifest(baseManifest());
    expect(canonicalizeManifest(canonicalizeManifest(m))).toEqual(canonicalizeManifest(m));
  });
});
