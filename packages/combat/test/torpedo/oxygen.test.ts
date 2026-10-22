import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  OXYGEN_CHAIN_REACTION_BASE_BP,
  OXYGEN_RANGE_MULTIPLIER_BP,
  OXYGEN_SPEED_MULTIPLIER_BP,
  OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
  OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
  resolveOxygenPerformanceEffects,
  SHIPPED_OXYGEN_EFFECTS,
  tubeHitPropulsionMultiplierBp,
} from "../../src/torpedoes/index.js";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";

const TYPE93 = "jpn_61cm_type93_1935";
const G7A = "ger_533mm_g7a_1934";

describe("AC-18 §23: the exact shipped effects", () => {
  it("pins 15_000 / 11_000 / 7_500 / 15_000 / 3_000 bp", () => {
    expect(OXYGEN_RANGE_MULTIPLIER_BP).toBe(15_000);
    expect(OXYGEN_SPEED_MULTIPLIER_BP).toBe(11_000);
    expect(OXYGEN_WAKE_DETECTION_MULTIPLIER_BP).toBe(7_500);
    expect(OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP).toBe(15_000);
    expect(OXYGEN_CHAIN_REACTION_BASE_BP).toBe(3_000);
    expect(SHIPPED_OXYGEN_EFFECTS).toEqual({
      rangeMultiplierBp: 15_000,
      speedMultiplierBp: 11_000,
      wakeDetectionMultiplierBp: 7_500,
      tubeHitSevereFloodingMultiplierBp: 15_000,
      chainReactionBaseBp: 3_000,
    });
  });
});

describe("AC-18 §23: gains apply only when the setting + launcher are compatible", () => {
  it("a compatible setting + launcher on the Type 93 applies every gain", () => {
    const r = resolveOxygenPerformanceEffects({
      model: compiledTorpedoOf(TYPE93),
      selectedSettingId: "48kn",
      launcherFamilyId: "61cm_above_water_trainable",
    });
    expect(r.applicable).toBe(true);
    expect(r.rangeMultiplierBp).toBe(15_000);
    expect(r.speedMultiplierBp).toBe(11_000);
    expect(r.wakeDetectionMultiplierBp).toBe(7_500);
    expect(r.declared.tubeHitSevereFloodingMultiplierBp).toBe(15_000);
    expect(r.declared.chainReactionBaseBp).toBe(3_000);
    expect(r.incompatibility).toBeNull();
  });

  it("an incompatible launcher family yields NO gains (neutral 10_000)", () => {
    const r = resolveOxygenPerformanceEffects({
      model: compiledTorpedoOf(TYPE93),
      selectedSettingId: "48kn",
      launcherFamilyId: "533mm_above_water_trainable",
    });
    expect(r.applicable).toBe(false);
    expect(r.rangeMultiplierBp).toBe(10_000);
    expect(r.speedMultiplierBp).toBe(10_000);
    expect(r.wakeDetectionMultiplierBp).toBe(10_000);
    expect(r.incompatibility).toContain("launcher family");
  });

  it("an unknown setting yields NO gains (neutral 10_000)", () => {
    const r = resolveOxygenPerformanceEffects({
      model: compiledTorpedoOf(TYPE93),
      selectedSettingId: "99kn",
      launcherFamilyId: "61cm_above_water_trainable",
    });
    expect(r.applicable).toBe(false);
    expect(r.rangeMultiplierBp).toBe(10_000);
    expect(r.incompatibility).toContain("setting");
  });

  it("a non-oxygen model can never apply §23 gains", () => {
    const r = resolveOxygenPerformanceEffects({
      model: compiledTorpedoOf(G7A),
      selectedSettingId: "44kn",
      launcherFamilyId: "533mm_above_water_trainable",
    });
    expect(r.applicable).toBe(false);
    expect(r.rangeMultiplierBp).toBe(10_000);
    expect(r.incompatibility).toContain("not an OXYGEN");
  });

  it("rejects malformed setting/launcher ids (fail closed)", () => {
    expect(() =>
      resolveOxygenPerformanceEffects({
        model: compiledTorpedoOf(TYPE93),
        selectedSettingId: "",
        launcherFamilyId: "61x_above_water_trainable",
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-18 §23: the §21 propulsion multiplier rides the model's oxygen class", () => {
  it("OXYGEN propulsion pins the 15_000 severe-flooding multiplier", () => {
    expect(tubeHitPropulsionMultiplierBp("OXYGEN")).toBe(15_000);
  });
});
