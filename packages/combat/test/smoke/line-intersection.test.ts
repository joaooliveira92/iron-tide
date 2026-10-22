import { describe, expect, it } from "vite-plus/test";
import { computeLineSmokeIntersection } from "../../src/smoke/lineIntersection.js";
import { SMOKESCREEN_REFERENCE_WIDTH_M, SMOKE_OPTICAL_MIN } from "../../src/smoke/constants.js";
import { createSmokeCloud } from "../../src/smoke/model.js";
import type { SmokeCloud } from "../../src/smoke/model.js";

const _CLOUD_RADIUS = SMOKESCREEN_REFERENCE_WIDTH_M / 2;

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

describe("computeLineSmokeIntersection", () => {
  it("ray intersecting one cloud returns valid contributions", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 5_000 });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(1);
    expect(result.pathDensityContributions[0].cloudId).toBe("c1");
    expect(result.pathDensityContributions[0].contributionBp).toBeGreaterThan(0);
  });

  it("ray intersecting multiple clouds sums density contributions", () => {
    const c1 = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 5_000 });
    const c2 = makeCloud({ smokeCloudId: "c2", centroidPosition: [600, 0], densityBp: 5_000 });
    const result = computeLineSmokeIntersection([-500, 0], [1500, 0], [c1, c2]);
    expect(result.pathDensityContributions.length).toBe(2);
    expect(result.totalPathDensityBp).toBeGreaterThan(0);
  });

  it("no intersection returns 10_000 (no penalty)", () => {
    const cloud = makeCloud({
      smokeCloudId: "c1",
      centroidPosition: [1000, 1000],
      densityBp: 10_000,
    });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(0);
    expect(result.totalPathDensityBp).toBe(0);
    expect(result.smokeOpticalMultiplierBp).toBe(10_000);
  });

  it("dense cloud reduces multiplier more", () => {
    const dense = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 10_000 });
    const sparse = makeCloud({ smokeCloudId: "c2", centroidPosition: [0, 0], densityBp: 1_000 });
    const resultDense = computeLineSmokeIntersection([-500, 0], [500, 0], [dense]);
    const resultSparse = computeLineSmokeIntersection([-500, 0], [500, 0], [sparse]);
    expect(resultDense.smokeOpticalMultiplierBp).toBeLessThan(
      resultSparse.smokeOpticalMultiplierBp,
    );
  });

  it("sparse cloud reduces multiplier less", () => {
    const sparse = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 100 });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [sparse]);
    expect(result.smokeOpticalMultiplierBp).toBeGreaterThan(9_000);
  });

  it("optical multiplier floor at 1_000", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 10_000 });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.smokeOpticalMultiplierBp).toBeGreaterThanOrEqual(SMOKE_OPTICAL_MIN);
  });

  it("various cloud positions affect intersection", () => {
    const onRay = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 5_000 });
    const offRay = makeCloud({ smokeCloudId: "c2", centroidPosition: [0, 500], densityBp: 5_000 });
    const resultOn = computeLineSmokeIntersection([-500, 0], [500, 0], [onRay]);
    const resultOff = computeLineSmokeIntersection([-500, 0], [500, 0], [offRay]);
    expect(resultOn.pathDensityContributions.length).toBe(1);
    expect(resultOff.pathDensityContributions.length).toBe(0);
  });

  it("path inside cloud increases contribution", () => {
    const cloudCenter = makeCloud({
      smokeCloudId: "c1",
      centroidPosition: [0, 0],
      densityBp: 5_000,
    });
    const resultCenter = computeLineSmokeIntersection([-500, 0], [500, 0], [cloudCenter]);

    const cloudEdge = makeCloud({
      smokeCloudId: "c2",
      centroidPosition: [0, 200],
      densityBp: 5_000,
    });
    const resultEdge = computeLineSmokeIntersection([-500, 0], [500, 0], [cloudEdge]);

    expect(resultCenter.pathDensityContributions[0].contributionBp).toBeGreaterThan(
      resultEdge.pathDensityContributions[0].contributionBp,
    );
  });

  it("boundary: cloud very far from ray", () => {
    const cloud = makeCloud({
      smokeCloudId: "c1",
      centroidPosition: [5000, 5000],
      densityBp: 10_000,
    });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(0);
    expect(result.smokeOpticalMultiplierBp).toBe(10_000);
  });

  it("edge: zero density cloud", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 1 });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(1);
    expect(result.pathDensityContributions[0].contributionBp).toBeGreaterThanOrEqual(0);
  });

  it("edge: maximum density (10_000)", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 10_000 });
    const result = computeLineSmokeIntersection([-500, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions[0].contributionBp).toBeGreaterThan(0);
    expect(result.totalPathDensityBp).toBeLessThanOrEqual(10_000);
  });

  it("edge: start == end (zero-length ray)", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 5_000 });
    const result = computeLineSmokeIntersection([0, 0], [0, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(1);
    expect(result.pathDensityContributions[0].contributionBp).toBe(2_500);
    expect(result.totalPathDensityBp).toBe(2_500);
  });

  it("multiple clouds, some on ray, some not", () => {
    const onRay = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 5_000 });
    const offRay = makeCloud({ smokeCloudId: "c2", centroidPosition: [0, 500], densityBp: 5_000 });
    const onRay2 = makeCloud({ smokeCloudId: "c3", centroidPosition: [800, 0], densityBp: 5_000 });
    const result = computeLineSmokeIntersection([-500, 0], [1500, 0], [onRay, offRay, onRay2]);
    expect(result.pathDensityContributions.length).toBe(2);
    const ids = result.pathDensityContributions.map((c) => c.cloudId);
    expect(ids).toContain("c1");
    expect(ids).toContain("c3");
    expect(ids).not.toContain("c2");
  });

  it("cloud right at endpoint", () => {
    const cloud = makeCloud({ smokeCloudId: "c1", centroidPosition: [500, 0], densityBp: 5_000 });
    const result = computeLineSmokeIntersection([0, 0], [500, 0], [cloud]);
    expect(result.pathDensityContributions.length).toBe(1);
    expect(result.pathDensityContributions[0].contributionBp).toBeGreaterThan(0);
  });

  it("different cloud densities produce expected multipliers", () => {
    const low = makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 100 });
    const med = makeCloud({ smokeCloudId: "c2", centroidPosition: [0, 0], densityBp: 5_000 });
    const high = makeCloud({ smokeCloudId: "c3", centroidPosition: [0, 0], densityBp: 10_000 });
    const resultLow = computeLineSmokeIntersection([-500, 0], [500, 0], [low]);
    const resultMed = computeLineSmokeIntersection([-500, 0], [500, 0], [med]);
    const resultHigh = computeLineSmokeIntersection([-500, 0], [500, 0], [high]);
    expect(resultLow.smokeOpticalMultiplierBp).toBeGreaterThan(resultMed.smokeOpticalMultiplierBp);
    expect(resultMed.smokeOpticalMultiplierBp).toBeGreaterThan(resultHigh.smokeOpticalMultiplierBp);
  });
});
