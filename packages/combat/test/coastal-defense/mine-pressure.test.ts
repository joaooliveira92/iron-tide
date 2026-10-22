import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  calculateCoastalArtilleryMinePressure,
  coastalArtilleryMinePressureHash,
  PER_BATTERY_MINE_PRESSURE_INCREMENT,
  COASTAL_ARTILLERY_MINE_PRESSURE_MISSING,
} from "@bluewave/combat/coastal-defense";

describe("calculateCoastalArtilleryMinePressure", () => {
  it("returns zero increment for zero batteries", () => {
    const result = calculateCoastalArtilleryMinePressure("area_north_sea", 0);
    expect(result.areaId).toBe("area_north_sea");
    expect(result.pressureIncrement).toBe(0);
    expect(result.batteryCount).toBe(0);
  });

  it("computes correct increment for positive battery count", () => {
    const result = calculateCoastalArtilleryMinePressure("area_north_sea", 3);
    expect(result.pressureIncrement).toBe(3 * PER_BATTERY_MINE_PRESSURE_INCREMENT);
    expect(result.batteryCount).toBe(3);
  });

  it("rejects negative battery count", () => {
    expect(() => calculateCoastalArtilleryMinePressure("area_north_sea", -1)).toThrowError(
      BluewaveError,
    );
  });

  it("error contains correct reason code for negative count", () => {
    try {
      calculateCoastalArtilleryMinePressure("area_north_sea", -1);
    } catch (e) {
      if (isBluewaveError(e)) {
        expect(e.message).toContain(COASTAL_ARTILLERY_MINE_PRESSURE_MISSING);
      }
    }
  });
});

describe("coastalArtilleryMinePressureHash", () => {
  it("produces deterministic hash for same inputs", () => {
    const a = coastalArtilleryMinePressureHash(
      calculateCoastalArtilleryMinePressure("area_north_sea", 3),
    );
    const b = coastalArtilleryMinePressureHash(
      calculateCoastalArtilleryMinePressure("area_north_sea", 3),
    );
    expect(a).toBe(b);
  });

  it("produces different hash for different inputs", () => {
    const a = coastalArtilleryMinePressureHash(
      calculateCoastalArtilleryMinePressure("area_north_sea", 3),
    );
    const b = coastalArtilleryMinePressureHash(
      calculateCoastalArtilleryMinePressure("area_baltic", 3),
    );
    expect(a).not.toBe(b);
  });
});
