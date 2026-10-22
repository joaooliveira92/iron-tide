import { describe, it, expect } from "vite-plus/test";
import {
  floodingPolicyId,
  FLOODING_RESOLUTION_RULESET_VERSION,
  FLOODING_RESOLUTION_FORMULA_VERSION,
  FLOODING_SEVERITY_THRESHOLDS,
  FLOODING_SPEED_MULTIPLIERS,
  FLOODING_STABILITY_MULTIPLIERS,
  SPEED_PRESSURE_MULTIPLIERS,
  HIGH_SPEED_LOSS_PROBABILITY,
  CONTROL_SPEED_THRESHOLD_KT,
  BASE_PUMPING_RATE_KG_MIN,
  BASE_REPAIR_REDUCTION_KG_MIN,
  DEWATERING_RATE_KG_MIN,
} from "../../src/damage/index.js";

describe("INC-6: Flooding resolution policy & version IDs", () => {
  it("policy ID is stable (flooding_resolution_v1)", () => {
    expect(floodingPolicyId).toBe("flooding_resolution_v1");
  });

  it("ruleset version is stable", () => {
    expect(FLOODING_RESOLUTION_RULESET_VERSION).toBe("flooding_resolution_ruleset_v1");
  });

  it("formula version is stable", () => {
    expect(FLOODING_RESOLUTION_FORMULA_VERSION).toBe("flooding_resolution_formula_v1");
  });
});

describe("INC-6: Constants are non-negative", () => {
  it("all severity thresholds are non-negative", () => {
    expect(FLOODING_SEVERITY_THRESHOLDS.MINOR_MAX).toBeGreaterThanOrEqual(0);
    expect(FLOODING_SEVERITY_THRESHOLDS.SERIOUS_MAX).toBeGreaterThanOrEqual(0);
    expect(FLOODING_SEVERITY_THRESHOLDS.MAJOR_MAX).toBeGreaterThanOrEqual(0);
  });

  it("all speed multipliers are non-negative", () => {
    for (const key of Object.keys(FLOODING_SPEED_MULTIPLIERS)) {
      expect(FLOODING_SPEED_MULTIPLIERS[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it("all stability multipliers are non-negative", () => {
    for (const key of Object.keys(FLOODING_STABILITY_MULTIPLIERS)) {
      expect(FLOODING_STABILITY_MULTIPLIERS[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it("all speed-pressure multipliers are non-negative", () => {
    for (const band of SPEED_PRESSURE_MULTIPLIERS) {
      expect(band.multiplierBp).toBeGreaterThanOrEqual(0);
      expect(band.maxSpeedKt).toBeGreaterThan(0);
    }
  });

  it("all high-speed loss probabilities are non-negative and ≤ 10_000", () => {
    for (const severityKey of Object.keys(HIGH_SPEED_LOSS_PROBABILITY)) {
      for (const bandKey of Object.keys(HIGH_SPEED_LOSS_PROBABILITY[severityKey])) {
        const val = HIGH_SPEED_LOSS_PROBABILITY[severityKey][bandKey];
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(10_000);
      }
    }
  });

  it("base pumping rate is positive", () => {
    expect(BASE_PUMPING_RATE_KG_MIN).toBeGreaterThan(0);
  });

  it("base repair reduction is positive", () => {
    expect(BASE_REPAIR_REDUCTION_KG_MIN).toBeGreaterThan(0);
  });

  it("dewatering rate is positive", () => {
    expect(DEWATERING_RATE_KG_MIN).toBeGreaterThan(0);
  });

  it("control speed threshold is positive", () => {
    expect(CONTROL_SPEED_THRESHOLD_KT).toBe(10);
  });
});

describe("INC-6: Severity thresholds are ordered correctly", () => {
  it("MINOR_MAX < SERIOUS_MAX < MAJOR_MAX", () => {
    expect(FLOODING_SEVERITY_THRESHOLDS.MINOR_MAX).toBeLessThan(
      FLOODING_SEVERITY_THRESHOLDS.SERIOUS_MAX,
    );
    expect(FLOODING_SEVERITY_THRESHOLDS.SERIOUS_MAX).toBeLessThan(
      FLOODING_SEVERITY_THRESHOLDS.MAJOR_MAX,
    );
  });

  it("MINOR_MAX = 499", () => {
    expect(FLOODING_SEVERITY_THRESHOLDS.MINOR_MAX).toBe(499);
  });

  it("SERIOUS_MAX = 1499", () => {
    expect(FLOODING_SEVERITY_THRESHOLDS.SERIOUS_MAX).toBe(1_499);
  });

  it("MAJOR_MAX = 2999", () => {
    expect(FLOODING_SEVERITY_THRESHOLDS.MAJOR_MAX).toBe(2_999);
  });
});

describe("INC-6: Speed-pressure multiplier bands are ordered and complete", () => {
  it("has 5 bands", () => {
    expect(SPEED_PRESSURE_MULTIPLIERS.length).toBe(5);
  });

  it("bands are in ascending order of maxSpeedKt", () => {
    for (let i = 1; i < SPEED_PRESSURE_MULTIPLIERS.length; i++) {
      expect(SPEED_PRESSURE_MULTIPLIERS[i - 1].maxSpeedKt).toBeLessThan(
        SPEED_PRESSURE_MULTIPLIERS[i].maxSpeedKt,
      );
    }
  });

  it("last band has Infinity as maxSpeedKt", () => {
    expect(SPEED_PRESSURE_MULTIPLIERS[SPEED_PRESSURE_MULTIPLIERS.length - 1].maxSpeedKt).toBe(
      Infinity,
    );
  });
});
