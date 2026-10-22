import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  COASTAL_DEFENSE_BATTERY_MODELS,
  COASTAL_BATTERY_ERA_BANDS,
  createCoastalBatteryDefinition,
  batteryContentHash,
} from "@bluewave/combat/coastal-defense";

function validBatteryParams() {
  return {
    model: "GENERIC_HEAVY",
    caliberMm: 305,
    eraBand: "PRE_WAR",
    hasAA: false,
  };
}

describe("CoastalBatteryDefinition", () => {
  it("creates a valid coastal battery definition", () => {
    const b = createCoastalBatteryDefinition(validBatteryParams());
    expect(b.model).toBe("GENERIC_HEAVY");
    expect(b.caliberMm.valueOf()).toBe(305);
    expect(b.eraBand).toBe("PRE_WAR");
    expect(b.hasAA).toBe(false);
  });

  it("accepts all battery models", () => {
    for (const model of COASTAL_DEFENSE_BATTERY_MODELS) {
      const b = createCoastalBatteryDefinition({ ...validBatteryParams(), model });
      expect(b.model).toBe(model);
    }
  });

  it("accepts all era bands", () => {
    for (const band of COASTAL_BATTERY_ERA_BANDS) {
      const b = createCoastalBatteryDefinition({ ...validBatteryParams(), eraBand: band });
      expect(b.eraBand).toBe(band);
    }
  });

  it("rejects unknown battery model", () => {
    expect(() =>
      createCoastalBatteryDefinition({ ...validBatteryParams(), model: "UNKNOWN_MODEL" }),
    ).toThrowError(BluewaveError);
  });

  it("rejects unknown era band", () => {
    expect(() =>
      createCoastalBatteryDefinition({ ...validBatteryParams(), eraBand: "FUTURE" }),
    ).toThrowError(BluewaveError);
  });

  it("rejects caliber below minimum", () => {
    expect(() =>
      createCoastalBatteryDefinition({ ...validBatteryParams(), caliberMm: 74 }),
    ).toThrowError(BluewaveError);
  });

  it("rejects caliber above maximum", () => {
    expect(() =>
      createCoastalBatteryDefinition({ ...validBatteryParams(), caliberMm: 461 }),
    ).toThrowError(BluewaveError);
  });

  it("accepts boundary calibers", () => {
    const low = createCoastalBatteryDefinition({ ...validBatteryParams(), caliberMm: 75 });
    expect(low.caliberMm.valueOf()).toBe(75);
    const high = createCoastalBatteryDefinition({ ...validBatteryParams(), caliberMm: 460 });
    expect(high.caliberMm.valueOf()).toBe(460);
  });

  it("creates a deterministic content hash", () => {
    const a = createCoastalBatteryDefinition(validBatteryParams());
    const b = createCoastalBatteryDefinition(validBatteryParams());
    expect(batteryContentHash(a)).toBe(batteryContentHash(b));
  });

  it("different params produce different hashes", () => {
    const a = createCoastalBatteryDefinition(validBatteryParams());
    const b = createCoastalBatteryDefinition({ ...validBatteryParams(), caliberMm: 150 });
    expect(batteryContentHash(a)).not.toBe(batteryContentHash(b));
  });
});
