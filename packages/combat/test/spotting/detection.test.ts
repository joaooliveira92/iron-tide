import { describe, it, expect } from "vite-plus/test";
import {
  isDetected,
  hasLineOfSight,
  distanceSq,
  NAUTICAL_MILE_UM,
  VISUAL_DETECTION_RANGE_NMI,
  NEUTRAL_VISIBILITY_MULTIPLIER_BP,
  validateSpottingSensorContract,
  SHIPPED_SPOTTING_SENSOR_CONTRACT,
} from "../../src/spotting/index.js";

const RANGE_UM = VISUAL_DETECTION_RANGE_NMI * NAUTICAL_MILE_UM;

describe("AC-8 line-of-sight", () => {
  it("flat open sea always has line of sight", () => {
    expect(hasLineOfSight([0, 0], [RANGE_UM, 0])).toBe(true);
    expect(hasLineOfSight([0, 0], [0, 0])).toBe(true);
  });

  it("honours an injected geometry resolver through isDetected (seam)", () => {
    const blockedLos = () => false;
    expect(
      isDetected({
        observer: [0, 0],
        target: [0, 0],
        rangeUm: RANGE_UM,
        los: blockedLos,
      }),
    ).toBe(false);
  });
});

describe("AC-7 detection model", () => {
  it("detects a target within range with line of sight (baseline clear daylight)", () => {
    expect(
      isDetected({ observer: [0, 0], target: [RANGE_UM - 3_000_000, 0], rangeUm: RANGE_UM }),
    ).toBe(true);
  });

  it("does not detect a target beyond range", () => {
    expect(
      isDetected({ observer: [0, 0], target: [RANGE_UM + 3_000_000, 0], rangeUm: RANGE_UM }),
    ).toBe(false);
  });

  it("uses the neutral visibility multiplier (1.0 baseline)", () => {
    expect(NEUTRAL_VISIBILITY_MULTIPLIER_BP).toBe(10_000);
    expect(
      isDetected({
        observer: [0, 0],
        target: [0, 0],
        rangeUm: RANGE_UM,
        visibilityMultiplierBp: NEUTRAL_VISIBILITY_MULTIPLIER_BP,
      }),
    ).toBe(true);
  });

  it("detection comparison stays within safe-integer fixed-point (AC-7 / DESIGN-07)", () => {
    const sq = distanceSq([0, 0], [40_000_000_000, 40_000_000_000]);
    expect(Number.isSafeInteger(sq)).toBe(true);
    expect(sq).toBeGreaterThan(0);
  });

  it("flips at the metre-quantized range boundary", () => {
    expect(
      isDetected({ observer: [0, 0], target: [RANGE_UM - 1_000_000, 0], rangeUm: RANGE_UM }),
    ).toBe(true);
    expect(
      isDetected({ observer: [0, 0], target: [RANGE_UM + 1_000_000, 0], rangeUm: RANGE_UM }),
    ).toBe(false);
  });
});

describe("AC-14 spotting contract shipping + validate guard", () => {
  it("ships the *_v1 contract and validates it", () => {
    expect(SHIPPED_SPOTTING_SENSOR_CONTRACT.policyId).toBe("spotting_sensor_v1");
    let thrown = false;
    validateSpottingSensorContract(SHIPPED_SPOTTING_SENSOR_CONTRACT);
    try {
      validateSpottingSensorContract({ ...SHIPPED_SPOTTING_SENSOR_CONTRACT, policyId: "x" });
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
