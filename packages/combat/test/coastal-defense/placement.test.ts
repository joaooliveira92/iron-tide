import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  selectCoastalDefensePositions,
  validatePlacementZone,
  type CoastalDefenseZone,
} from "../../src/coastal-defense/index.js";

const sampleZones: readonly CoastalDefenseZone[] = [
  {
    zoneId: "z1",
    areaId: "area_a",
    validBatteryModels: ["GENERIC_HEAVY", "GENERIC_MEDIUM"],
    maxBatteries: SafeInt(3),
  },
  {
    zoneId: "z2",
    areaId: "area_a",
    validBatteryModels: ["GENERIC_LIGHT"],
    maxBatteries: SafeInt(2),
  },
];

describe("validatePlacementZone", () => {
  it("passes for zones in the valid set", () => {
    expect(() => validatePlacementZone(sampleZones[0], sampleZones)).not.toThrow();
  });

  it("rejects zones not in the valid set", () => {
    const badZone: CoastalDefenseZone = {
      zoneId: "z_bad",
      areaId: "area_a",
      validBatteryModels: [],
      maxBatteries: SafeInt(0),
    };
    expect(() => validatePlacementZone(badZone, sampleZones)).toThrowError(BluewaveError);
  });

  it("rejects zones for different area", () => {
    const wrongArea: CoastalDefenseZone = {
      zoneId: "z1",
      areaId: "area_b",
      validBatteryModels: [],
      maxBatteries: SafeInt(0),
    };
    expect(() => validatePlacementZone(wrongArea, sampleZones)).toThrowError(BluewaveError);
  });
});

describe("selectCoastalDefensePositions", () => {
  it("returns empty for empty zones", () => {
    const result = selectCoastalDefensePositions("area_a", [], "seed-1");
    expect(result).toEqual([]);
  });

  it("returns positions for valid zones", () => {
    const result = selectCoastalDefensePositions("area_a", sampleZones, "seed-1");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].areaId).toBe("area_a");
    expect(result[0].zoneId).toBe("z1");
  });

  it("produces deterministic output for same seed", () => {
    const a = selectCoastalDefensePositions("area_a", sampleZones, "fixed-seed");
    const b = selectCoastalDefensePositions("area_a", sampleZones, "fixed-seed");
    expect(a.length).toBe(b.length);
    expect(a[0].positionIndex.valueOf()).toBe(b[0].positionIndex.valueOf());
  });

  it("produces different output for different seeds", () => {
    const a = selectCoastalDefensePositions("area_a", sampleZones, "seed-x");
    const b = selectCoastalDefensePositions("area_a", sampleZones, "seed-y");
    const lengthsMatch = a.length === b.length;
    const indicesMatch = a.every(
      (p, i) => p.positionIndex.valueOf() === b[i].positionIndex.valueOf(),
    );
    expect(lengthsMatch && indicesMatch).toBe(false);
  });

  it("respects maxBatteries upper bound", () => {
    const singleZone: readonly CoastalDefenseZone[] = [
      {
        zoneId: "z_single",
        areaId: "area_a",
        validBatteryModels: ["GENERIC_HEAVY"],
        maxBatteries: SafeInt(1),
      },
    ];
    for (let i = 0; i < 10; i++) {
      const result = selectCoastalDefensePositions("area_a", singleZone, `seed-${i}`);
      expect(result.length).toBeLessThanOrEqual(1);
    }
  });
});
