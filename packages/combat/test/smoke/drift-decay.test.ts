import { describe, expect, it } from "vite-plus/test";
import { resolveSmokeDriftDecay, getWindRetentionMultiplier } from "../../src/smoke/driftDecay.js";
import {
  WIND_RETENTION_LT_5_BP,
  WIND_RETENTION_5_TO_15_BP,
  WIND_RETENTION_15_TO_25_BP,
  WIND_RETENTION_GE_25_BP,
} from "../../src/smoke/constants.js";
import { createSmokeCloud } from "../../src/smoke/model.js";
import type { SmokeCloud } from "../../src/smoke/model.js";

function makeCloud(overrides: Partial<SmokeCloud> & { smokeCloudId: string }): SmokeCloud {
  return createSmokeCloud({
    sourceType: "FUNNEL",
    sourceId: "ship-001",
    owner: "PLAYER_1",
    creationMinute: 100,
    creationSubstep: 0,
    centroidPosition: [0, 0] as [number, number],
    densityBp: 5_000,
    verticalExtentM: 50,
    driftVector: [0, 0] as [number, number],
    expansionRate: 0,
    densityDecayRate: 0,
    fuelComposition: "oil",
    active: true,
    ...overrides,
  });
}

describe("getWindRetentionMultiplier", () => {
  it("returns LT_5_BP for speed < 5", () => {
    expect(getWindRetentionMultiplier(0)).toBe(WIND_RETENTION_LT_5_BP);
    expect(getWindRetentionMultiplier(4)).toBe(WIND_RETENTION_LT_5_BP);
  });

  it("returns 5_TO_15_BP for speed 5-14", () => {
    expect(getWindRetentionMultiplier(5)).toBe(WIND_RETENTION_5_TO_15_BP);
    expect(getWindRetentionMultiplier(10)).toBe(WIND_RETENTION_5_TO_15_BP);
    expect(getWindRetentionMultiplier(14)).toBe(WIND_RETENTION_5_TO_15_BP);
  });

  it("returns 15_TO_25_BP for speed 15-24", () => {
    expect(getWindRetentionMultiplier(15)).toBe(WIND_RETENTION_15_TO_25_BP);
    expect(getWindRetentionMultiplier(20)).toBe(WIND_RETENTION_15_TO_25_BP);
    expect(getWindRetentionMultiplier(24)).toBe(WIND_RETENTION_15_TO_25_BP);
  });

  it("returns GE_25_BP for speed >= 25", () => {
    expect(getWindRetentionMultiplier(25)).toBe(WIND_RETENTION_GE_25_BP);
    expect(getWindRetentionMultiplier(100)).toBe(WIND_RETENTION_GE_25_BP);
  });
});

describe("resolveSmokeDriftDecay", () => {
  it("cloud drifts with wind in correct direction (90 deg = East)", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 10, 90);
    expect(nextClouds[0].centroidPosition[0]).toBeGreaterThan(0);
    expect(nextClouds[0].centroidPosition[1]).toBeCloseTo(0, 5);
  });

  it("cloud drifts with wind in correct direction (0 deg = North)", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 10, 0);
    expect(nextClouds[0].centroidPosition[1]).toBeGreaterThan(0);
    expect(nextClouds[0].centroidPosition[0]).toBeCloseTo(0, 5);
  });

  it("density decays with wind band multiplier", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 10_000 });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 10, 0);
    // Band: 5-15 knots -> 9_000 retention
    // density = floor(10_000 * 9_000 / 10_000) = 9_000
    expect(nextClouds[0].densityBp).toBe(9_000);
  });

  it("multiple clouds each drift independently", () => {
    const c1 = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] });
    const c2 = makeCloud({ smokeCloudId: "c2", centroidPosition: [1000, 1000] });
    const { nextClouds } = resolveSmokeDriftDecay([c1, c2], 10, 90);
    expect(nextClouds.length).toBe(2);
    // Both drift east by same amount since wind is same
    expect(nextClouds[0].centroidPosition[0]).not.toBe(nextClouds[1].centroidPosition[0]);
    expect(nextClouds[0].centroidPosition[0]).toBeGreaterThan(c1.centroidPosition[0]);
    expect(nextClouds[1].centroidPosition[0]).toBeGreaterThan(c2.centroidPosition[0]);
  });

  it("cloud removed when density < 1 after decay", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 1 });
    // With retention multiplier 9_500 (light wind):
    // floor(1 * 9_500 / 10_000) = 0 < 1 -> removed
    const { nextClouds, removedCloudIds } = resolveSmokeDriftDecay([cloud], 3, 0);
    expect(nextClouds.length).toBe(0);
    expect(removedCloudIds).toContain("c1");
  });

  it("multiple removals work", () => {
    const c1 = makeCloud({ smokeCloudId: "c1", densityBp: 1 });
    const c2 = makeCloud({ smokeCloudId: "c2", densityBp: 1 });
    const c3 = makeCloud({ smokeCloudId: "c3", densityBp: 5_000 });
    const { nextClouds, removedCloudIds } = resolveSmokeDriftDecay([c1, c2, c3], 3, 0);
    expect(nextClouds.length).toBe(1);
    expect(nextClouds[0].smokeCloudId).toBe("c3");
    expect(removedCloudIds).toContain("c1");
    expect(removedCloudIds).toContain("c2");
  });

  it("strong wind causes faster decay", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 10_000 });
    // Strong wind (>=25): retention = 6_500
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 30, 0);
    // floor(10_000 * 6_500 / 10_000) = 6_500
    expect(nextClouds[0].densityBp).toBe(6_500);
  });

  it("light wind preserves density", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 10_000 });
    // Light wind (<5): retention = 9_500
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 3, 0);
    // floor(10_000 * 9_500 / 10_000) = 9_500
    expect(nextClouds[0].densityBp).toBe(9_500);
  });

  it("precipitation adds decay", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 10_000 });
    // wind 3 -> retention 9_500 -> density = 9_500
    // precipitation 5_000 -> density = floor(9_500 * 5_000 / 10_000) = 4_750
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 3, 0, 5_000);
    expect(nextClouds[0].densityBp).toBe(4_750);
  });

  it("no precipitation = no additional decay", () => {
    const noPrecip = resolveSmokeDriftDecay(
      [makeCloud({ smokeCloudId: "c1", densityBp: 10_000 })],
      3,
      0,
    );
    const withDefault = resolveSmokeDriftDecay(
      [makeCloud({ smokeCloudId: "c2", densityBp: 10_000 })],
      3,
      0,
      10_000,
    );
    expect(noPrecip.nextClouds[0].densityBp).toBe(withDefault.nextClouds[0].densityBp);
  });

  it("drift direction follows wind direction (180 deg = South)", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 10, 180);
    expect(nextClouds[0].centroidPosition[1]).toBeLessThan(0);
    expect(nextClouds[0].centroidPosition[0]).toBeCloseTo(0, 5);
  });

  it("already-inactive clouds are removed", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", active: false });
    const { nextClouds, removedCloudIds } = resolveSmokeDriftDecay([cloud], 5, 0);
    expect(nextClouds.length).toBe(0);
    expect(removedCloudIds).toContain("c1");
  });

  it("cloud hash changes after drift", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] });
    const originalHash = cloud.cloudHash;
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 10, 90);
    expect(nextClouds[0].cloudHash).not.toBe(originalHash);
  });

  it("edge: wind speed exactly at boundary 5", () => {
    const bandLow = getWindRetentionMultiplier(4);
    const bandAt = getWindRetentionMultiplier(5);
    expect(bandLow).not.toBe(bandAt);
    expect(bandLow).toBe(WIND_RETENTION_LT_5_BP);
    expect(bandAt).toBe(WIND_RETENTION_5_TO_15_BP);
  });

  it("edge: wind speed exactly at boundary 15", () => {
    const bandLow = getWindRetentionMultiplier(14);
    const bandAt = getWindRetentionMultiplier(15);
    expect(bandLow).toBe(WIND_RETENTION_5_TO_15_BP);
    expect(bandAt).toBe(WIND_RETENTION_15_TO_25_BP);
  });

  it("edge: wind speed exactly at boundary 25", () => {
    const bandLow = getWindRetentionMultiplier(24);
    const bandAt = getWindRetentionMultiplier(25);
    expect(bandLow).toBe(WIND_RETENTION_15_TO_25_BP);
    expect(bandAt).toBe(WIND_RETENTION_GE_25_BP);
  });

  it("edge: wind speed 0", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [10, 20] });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 0, 90);
    // No drift, retention = LT_5_BP = 9_500
    expect(nextClouds[0].centroidPosition).toEqual([10, 20]);
    expect(nextClouds[0].densityBp).toBe(Math.floor((5_000 * 9_500) / 10_000));
  });

  it("edge: wind speed very high", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", densityBp: 10_000 });
    const { nextClouds } = resolveSmokeDriftDecay([cloud], 100, 0);
    // retention = GE_25_BP = 6_500
    // density = floor(10_000 * 6_500 / 10_000) = 6_500
    expect(nextClouds[0].densityBp).toBe(6_500);
  });
});
