import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  addSupport,
  buildManifest,
  composeSupportForce,
  generateBattles,
  maximumAlliedStrength,
  supportForceDrawPresent,
  supportForceStrengthCap,
  withSupportForce,
  type AlliedCandidate,
} from "@bluewave/combat/generation";
import { defaultTwoNationFixture } from "../fixtures/generation-fixture.js";

const candidate = (
  assetId: string,
  nationId: string,
  effectiveStrength: number,
): AlliedCandidate => ({
  assetId,
  nationId,
  effectiveStrength,
  treatyCommitmentPriority: 0,
  missionFit: 0,
});

describe("supportForceStrengthCap (T-1 08)", () => {
  it("is floor(home * share / 10000) and never exceeds the existing allied cap", () => {
    expect(supportForceStrengthCap(1_001, 2_500)).toBe(250);
    expect(supportForceStrengthCap(1_000, 5_000)).toBe(maximumAlliedStrength(1_000));
    expect(supportForceStrengthCap(1_000, 9_999)).toBe(maximumAlliedStrength(1_000));
    expect(supportForceStrengthCap(0, 5_000)).toBe(0);
    expect(supportForceStrengthCap(1_000, 0)).toBe(0);
  });
});

describe("composeSupportForce (T-1 08)", () => {
  it("takes candidates in the existing ordering while they fit under the cap, skipping one that does not", () => {
    const pool = [
      candidate("c", "ITA", 100),
      candidate("a", "AUS", 300),
      candidate("b", "AUS", 200),
      candidate("d", "ITA", 50),
    ];
    expect(composeSupportForce(pool, 550).map((x) => x.assetId)).toEqual(["a", "b", "d"]);
    expect(composeSupportForce(pool, 250).map((x) => x.assetId)).toEqual(["b", "d"]);
    expect(composeSupportForce(pool, 49)).toEqual([]);
  });
});

describe("supportForceDrawPresent (T-1 08)", () => {
  it("is present only when the draw falls under the chance", () => {
    expect(supportForceDrawPresent(2_499, 2_500)).toBe(true);
    expect(supportForceDrawPresent(2_500, 2_500)).toBe(false);
    expect(supportForceDrawPresent(0, 0)).toBe(false);
  });
});

describe("withSupportForce (T-1 08)", () => {
  const manifest = buildManifest({
    battleId: "b1",
    opportunityId: "o1",
    warId: "w1",
    areaId: "a-1",
    missionType: "FLEET_BATTLE",
    attackerId: "GBR",
    defenderId: "FRA",
    acceptanceClass: "OPTIONAL",
    missionObjectives: [],
    sides: [
      { sideId: "ATTACKER", participantIds: ["GBR"] },
      { sideId: "DEFENDER", participantIds: ["FRA"] },
    ],
    persistentAssets: ["g1", "f1"],
    temporaryAssets: [],
    permanentDivisionIds: [],
    tacticalDivisions: [],
    commanders: [],
    weather: "clear",
    seaState: "calm",
    visibility: "good",
    environment: "day",
    sourceStateHashes: {},
    reservations: [],
    autoResolutionProof: "",
    provenanceRecords: [],
    rulesetVersion: "r",
    formulaVersion: "f",
    aiPolicyVersion: "1",
    rngVersion: "1",
    contentVersion: "c",
  });
  const seed = {
    rngVersion: "1",
    campaignSeed: "s",
    campaignMonth: "1880-01",
    battleGenerationFormulaVersion: "1",
  };

  it("adds support ships as temporary assets and their nations to the player's side only", () => {
    const next = withSupportForce(manifest, "GBR", ["i2", "i1"], ["ITA"], seed);
    expect(next.temporaryAssets).toEqual(["i1", "i2"]);
    expect(next.persistentAssets).toEqual(manifest.persistentAssets);
    expect(next.sides).toEqual([
      { sideId: "ATTACKER", participantIds: ["GBR", "ITA"] },
      { sideId: "DEFENDER", participantIds: ["FRA"] },
    ]);
    expect(next.manifestHash).not.toBe(manifest.manifestHash);
    expect(next.battleSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(withSupportForce(manifest, "GBR", ["i1", "i2"], ["ITA"], seed)).toEqual(next);
  });

  it("joins the defender side when the player defends", () => {
    const next = withSupportForce(manifest, "FRA", ["i1"], ["ITA"], seed);
    expect(next.sides[1]?.participantIds).toEqual(["FRA", "ITA"]);
  });
});

describe("addSupport (T-1 08)", () => {
  const generated = generateBattles({
    snapshot: defaultTwoNationFixture(),
    campaignMonth: "1880-02",
    campaignSeed: "seed",
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: "1",
    contentVersion: "0.3.0",
    resolveStrength: () => 200,
    resolveShipType: () => "BB",
    resolveReadiness: () => 80,
  });
  const manifest = generated.manifests[0]!;
  const battleId = manifest.battleId;
  const seed = {
    rngVersion: "1",
    campaignSeed: "seed",
    campaignMonth: "1880-02",
    battleGenerationFormulaVersion: "1",
  };

  it("adds the support to the manifest and records it in the generation record", () => {
    const next = addSupport(generated, {
      battleId,
      playerNationId: manifest.attackerId,
      support: [
        { nationId: "ITA", assetId: "i2" },
        { nationId: "ITA", assetId: "i1" },
      ],
      ...seed,
    });
    const added = next.manifests[0]!;
    expect(added.temporaryAssets).toEqual(["i1", "i2"]);
    expect(added.sides[0]?.participantIds).toEqual([manifest.attackerId, "ITA"]);
    expect(next.records[0]).toMatchObject({
      alliedSupportDecisions: ["ITA:i2", "ITA:i1"],
      manifests: [added.manifestHash],
      battleSeeds: [added.battleSeed],
    });
    expect(next.records[0]!.recordHash).not.toBe(generated.records[0]!.recordHash);
    expect(next.records[0]!.recordHash).toBe(
      sha256Hex(canonicalSerialize({ ...next.records[0]!, recordHash: "" })),
    );
    expect(next.battleIds).toEqual(generated.battleIds);
    expect(generated.manifests[0]!.temporaryAssets).toEqual([]);
  });

  it("leaves the result untouched for a battle it does not hold", () => {
    const next = addSupport(generated, {
      battleId: "unknown",
      playerNationId: manifest.attackerId,
      support: [{ nationId: "ITA", assetId: "i1" }],
      ...seed,
    });
    expect(next).toBe(generated);
  });
});
