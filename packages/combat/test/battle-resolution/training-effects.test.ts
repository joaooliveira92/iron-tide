import { describe, expect, it } from "vite-plus/test";
import {
  NO_TRAINING_EFFECTS,
  buildDamageControlContexts,
  isNightTimeOfDay,
  scaleByTrainingBp,
  withNightTraining,
} from "@bluewave/combat/battleResolution";
import { autoSolutionQualityBp } from "../../src/battleResolution/torpedoDoctrine.js";
import { projectBattle } from "@bluewave/combat/battleResolution";
import { AREA_ID, CAMPAIGN_MONTH, makeNations, makeProjectionManifest } from "./fixtures.js";

const project = (attacker: Partial<typeof NO_TRAINING_EFFECTS>) => {
  const nations = makeNations();
  return projectBattle({
    manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
    areaId: AREA_ID,
    campaignMonth: CAMPAIGN_MONTH,
    attacker: { ...nations.attacker, trainingEffects: { ...NO_TRAINING_EFFECTS, ...attacker } },
    defender: nations.defender,
    rulesetVersion: "b6_ruleset_v1",
  });
};

describe("training effects in battle", () => {
  it("scales a base value by a basis-point bonus, flooring", () => {
    expect(scaleByTrainingBp(10_000, 1_000)).toBe(11_000);
    expect(scaleByTrainingBp(8_000, 2_000)).toBe(9_600);
    expect(scaleByTrainingBp(7, 1_000)).toBe(7);
    expect(scaleByTrainingBp(8_000, 0)).toBe(8_000);
  });

  it("counts night and night twilight as night, and nothing else", () => {
    expect(isNightTimeOfDay("NIGHT")).toBe(true);
    expect(isNightTimeOfDay("TWILIGHT_NIGHT")).toBe(true);
    expect(isNightTimeOfDay("DAY")).toBe(false);
    expect(isNightTimeOfDay("TWILIGHT_DAY")).toBe(false);
    expect(isNightTimeOfDay("DAWN_DUSK_TRANSITION")).toBe(false);
  });

  it("applies the night fighting bonus to the trained side's batteries at night only", () => {
    const out = project({});
    const bySide = {
      ATTACKER: { ...NO_TRAINING_EFFECTS, nightFightingBp: 1_000 },
      DEFENDER: NO_TRAINING_EFFECTS,
    };
    const training = (batteries: readonly { accuracyFactors: { training: number } }[]) =>
      batteries.map((b) => b.accuracyFactors.training);
    expect(training(withNightTraining(out.batteries, bySide, "DAY"))).toEqual(
      training(out.batteries),
    );
    const night = withNightTraining(out.batteries, bySide, "NIGHT");
    out.batteries.forEach((battery, index) => {
      const expected = battery.sideId === "ATTACKER" ? 11_000 : 10_000;
      expect(night[index]!.accuracyFactors.training).toBe(expected);
    });
    expect(out.batteries.every((b) => b.accuracyFactors.training === 10_000)).toBe(true);
  });

  it("raises the automatic torpedo solution quality with torpedo tactics, capped at the maximum", () => {
    expect(autoSolutionQualityBp(0)).toBe(8_000);
    expect(autoSolutionQualityBp(2_000)).toBe(9_600);
    expect(autoSolutionQualityBp(9_000)).toBe(10_000);
  });

  it("gives the trained side's ships more pumping and firefighting, and nobody else", () => {
    const out = project({ damageControlBp: 2_000 });
    const base = buildDamageControlContexts({
      battleId: out.state.battleId,
      minute: 1,
      units: out.units,
      damage: out.damage,
      movementStates: out.state.movementStates,
      engine: undefined as never,
    });
    const trained = buildDamageControlContexts({
      battleId: out.state.battleId,
      minute: 1,
      units: out.units,
      damage: out.damage,
      movementStates: out.state.movementStates,
      engine: undefined as never,
      trainingEffects: out.trainingEffects,
    });
    const sides = new Map(out.units.map((u) => [u.assetId, u.sideId]));
    for (const [shipId, context] of Object.entries(trained)) {
      const before = base[shipId]!.resources;
      if (sides.get(shipId) === "ATTACKER") {
        expect(context.resources.pumpingCapacity).toBe(
          scaleByTrainingBp(before.pumpingCapacity, 2_000),
        );
        expect(context.resources.firefightingCapacity).toBe(
          scaleByTrainingBp(before.firefightingCapacity, 2_000),
        );
      } else {
        expect(context.resources).toEqual(before);
      }
    }
    expect(Object.keys(trained).length).toBeGreaterThan(0);
  });
});
