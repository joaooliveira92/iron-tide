import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  createForceRequirements,
  assignMandatoryRoles,
  assertMandatoryRoleFilled,
} from "../../src/generation/force.js";
import { BATTLE_MANDATORY_ROLE_UNFILLED } from "../../src/generation/reasonCodes.js";
import {
  optionalAssetSelectionV1,
  selectionWeightV1,
  OPTIONAL_ASSET_STREAM,
  optionalAssetStreamKey,
} from "../../src/generation/optional.js";

describe("mandatory role assignment (AC-8)", () => {
  it("fills deterministically by role-score then strength then readiness, no randomness", () => {
    const candidates = [
      {
        assetId: "s1",
        sideId: "ATTACKER",
        roleScore: 5,
        effectiveStrength: 100,
        readiness: 80,
        commanderSuitability: 0,
        assetIdentifier: "s1",
      },
      {
        assetId: "s2",
        sideId: "ATTACKER",
        roleScore: 5,
        effectiveStrength: 120,
        readiness: 70,
        commanderSuitability: 0,
        assetIdentifier: "s2",
      },
      {
        assetId: "s3",
        sideId: "ATTACKER",
        roleScore: 7,
        effectiveStrength: 50,
        readiness: 90,
        commanderSuitability: 0,
        assetIdentifier: "s3",
      },
    ];
    const a = assignMandatoryRoles(candidates, "CORE");
    const b = assignMandatoryRoles(candidates, "CORE");
    expect(a).toEqual(b);
    expect(a?.assetId).toBe("s3");
  });

  it("unfilled -> BATTLE_MANDATORY_ROLE_UNFILLED", () => {
    expect(() => assertMandatoryRoleFilled("CORE", "ATTACKER", undefined, {})).toThrow(
      new RegExp(BATTLE_MANDATORY_ROLE_UNFILLED),
    );
  });

  it("force requirements present for fleet + cruiser missions", () => {
    expect(createForceRequirements("FLEET_BATTLE").minEffectiveStrength).toBe(300);
    expect(createForceRequirements("CRUISER_BATTLE").minEffectiveStrength).toBe(150);
  });
});

describe("optional asset selection v1 (AC-8)", () => {
  it("selectionWeight integer formula with explicit inputs", () => {
    const w = selectionWeightV1({
      assetId: "s1",
      baseMissionWeight: 10_000,
      readinessMultiplierBp: 8_000,
      missionFitMultiplierBp: 10_000,
      commanderMultiplierBp: 10_000,
      objectiveMultiplierBp: 10_000,
      fatigueMultiplierBp: 10_000,
    });
    expect(w).toBe((10_000 * 8_000) / 10_000);
  });

  it("same inputs -> same selection (deterministic per keyed stream)", () => {
    const candidates = ["a", "b", "c"].map((id) => ({
      assetId: id,
      baseMissionWeight: 10_000,
      readinessMultiplierBp: 9_000,
      missionFitMultiplierBp: 10_000,
      commanderMultiplierBp: 10_000,
      objectiveMultiplierBp: 10_000,
      fatigueMultiplierBp: 10_000,
    }));
    const engine = new RandomEngine("seed");
    const stream = engine.stream(
      `${OPTIONAL_ASSET_STREAM}:1880-02:war_1:area_battle:FLEET_BATTLE:hash:SCOUT`,
    );
    const s1 = optionalAssetSelectionV1(candidates, "SCOUT", stream, 2);
    const engine2 = new RandomEngine("seed");
    const stream2 = engine2.stream(
      `${OPTIONAL_ASSET_STREAM}:1880-02:war_1:area_battle:FLEET_BATTLE:hash:SCOUT`,
    );
    const s2 = optionalAssetSelectionV1(candidates, "SCOUT", stream2, 2);
    expect(s1).toEqual(s2);
  });

  it("stream key includes ordered candidate-set hash + role id", () => {
    const key = optionalAssetStreamKey(
      "1880-02",
      "war_1",
      "area_battle",
      "FLEET_BATTLE",
      "abc",
      "SCOUT",
    );
    expect(key).toBe(`${OPTIONAL_ASSET_STREAM}:1880-02:war_1:area_battle:FLEET_BATTLE:abc:SCOUT`);
  });
});
