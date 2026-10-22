import { describe, expect, it } from "vite-plus/test";
import {
  createCoastalDefenseOperationsRecord,
  type CoastalDefenseAreaRecord,
  type CoastalDefensePositionRecord,
  type CoastalDefenseBatteryRecord,
} from "@bluewave/combat/coastal-defense";

function sampleBattery(
  overrides: Partial<CoastalDefenseBatteryRecord> = {},
): CoastalDefenseBatteryRecord {
  return {
    model: "GENERIC_HEAVY",
    caliberMm: 305,
    eraBand: "PRE_WAR",
    hasAA: false,
    targetType: "COASTAL_BATTERY",
    damageState: "INTACT",
    effectivenessBp: 8_000,
    minePressureIncrement: 500,
    ...overrides,
  };
}

function samplePosition(
  overrides: Partial<CoastalDefensePositionRecord> = {},
): CoastalDefensePositionRecord {
  return {
    zoneId: "z1",
    areaId: "area_a",
    positionIndex: 0,
    batteries: [sampleBattery()],
    ...overrides,
  };
}

function sampleArea(overrides: Partial<CoastalDefenseAreaRecord> = {}): CoastalDefenseAreaRecord {
  return {
    areaId: "area_a",
    positions: [samplePosition()],
    totalMinePressureIncrement: 500,
    ...overrides,
  };
}

describe("CoastalDefenseOperationsRecord", () => {
  it("creates a record with deterministic hash", () => {
    const a = createCoastalDefenseOperationsRecord([sampleArea()], "2026-08-28T23:00:00Z");
    const b = createCoastalDefenseOperationsRecord([sampleArea()], "2026-08-28T23:00:00Z");
    expect(a.recordHash).toBe(b.recordHash);
  });

  it("different inputs produce different hashes", () => {
    const a = createCoastalDefenseOperationsRecord([sampleArea()], "2026-08-28T23:00:00Z");
    const b = createCoastalDefenseOperationsRecord(
      [sampleArea({ totalMinePressureIncrement: 1000 })],
      "2026-08-28T23:00:00Z",
    );
    expect(a.recordHash).not.toBe(b.recordHash);
  });

  it("sorts areas by areaId", () => {
    const areaB = sampleArea({ areaId: "area_b" });
    const areaA = sampleArea({ areaId: "area_a" });
    const record = createCoastalDefenseOperationsRecord([areaB, areaA], "2026-08-28T23:00:00Z");
    expect(record.areas[0].areaId).toBe("area_a");
    expect(record.areas[1].areaId).toBe("area_b");
  });

  it("sorts positions by zoneId then positionIndex", () => {
    const posB = samplePosition({ zoneId: "z2", positionIndex: 0 });
    const posA = samplePosition({ zoneId: "z1", positionIndex: 1 });
    const area = sampleArea({ positions: [posB, posA] });
    const record = createCoastalDefenseOperationsRecord([area], "2026-08-28T23:00:00Z");
    expect(record.areas[0].positions[0].zoneId).toBe("z1");
    expect(record.areas[0].positions[1].zoneId).toBe("z2");
  });

  it("multiple areas produce correct ordering", () => {
    const areas = [
      sampleArea({ areaId: "area_c" }),
      sampleArea({ areaId: "area_a" }),
      sampleArea({ areaId: "area_b" }),
    ];
    const record = createCoastalDefenseOperationsRecord(areas, "2026-08-28T23:00:00Z");
    expect(record.areas.map((a) => a.areaId)).toEqual(["area_a", "area_b", "area_c"]);
  });
});
