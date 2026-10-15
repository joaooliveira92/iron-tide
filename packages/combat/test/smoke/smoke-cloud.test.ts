import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  createSmokeCloud,
  smokeCloudHash,
  SMOKE_SOURCE_TYPES,
  SMOKE_RULESET_VERSION,
  SMOKE_FORMULA_VERSION,
} from "../../src/smoke/index.js";

function validFunnelCloudParams() {
  return {
    smokeCloudId: "funnel-001",
    sourceType: "FUNNEL" as const,
    sourceId: "ship-123",
    owner: "PLAYER_1",
    creationMinute: 120,
    creationSubstep: 0,
    centroidPosition: [500, 300] as [number, number],
    densityBp: 7_500,
    verticalExtentM: 50,
    driftVector: [0.5, -0.3] as [number, number],
    expansionRate: 0.1,
    densityDecayRate: 0.01,
    fuelComposition: "oil",
    active: true,
  };
}

describe("SmokeCloud creation", () => {
  it("creates a valid funnel-type smoke cloud with all fields set", () => {
    const cloud = createSmokeCloud(validFunnelCloudParams());
    expect(cloud).toBeDefined();
    expect(cloud.smokeCloudId).toBe("funnel-001");
    expect(cloud.sourceType).toBe("FUNNEL");
    expect(cloud.sourceId).toBe("ship-123");
    expect(cloud.owner).toBe("PLAYER_1");
    expect(cloud.creationMinute).toBe(120);
    expect(cloud.creationSubstep).toBe(0);
    expect(cloud.centroidPosition).toEqual([500, 300]);
    expect(cloud.densityBp).toBe(7_500);
    expect(cloud.verticalExtentM).toBe(50);
    expect(cloud.driftVector).toEqual([0.5, -0.3]);
    expect(cloud.expansionRate).toBe(0.1);
    expect(cloud.densityDecayRate).toBe(0.01);
    expect(cloud.fuelComposition).toBe("oil");
    expect(cloud.active).toBe(true);
    expect(cloud.rulesetVersion).toBe(SMOKE_RULESET_VERSION);
    expect(cloud.formulaVersion).toBe(SMOKE_FORMULA_VERSION);
  });

  it("computes a deterministic cloudHash", () => {
    const a = createSmokeCloud(validFunnelCloudParams());
    const b = createSmokeCloud(validFunnelCloudParams());
    expect(a.cloudHash).toBeTruthy();
    expect(typeof a.cloudHash).toBe("string");
    expect(a.cloudHash).toBe(b.cloudHash);
  });

  it("different params produce different hashes", () => {
    const a = createSmokeCloud(validFunnelCloudParams());
    const b = createSmokeCloud({ ...validFunnelCloudParams(), densityBp: 8_000 });
    expect(a.cloudHash).not.toBe(b.cloudHash);
  });

  it("creates smoke clouds with all source types", () => {
    const base = validFunnelCloudParams();
    for (const sourceType of SMOKE_SOURCE_TYPES) {
      const cloud = createSmokeCloud({ ...base, sourceType, smokeCloudId: `cloud-${sourceType}` });
      expect(cloud.sourceType).toBe(sourceType);
    }
  });

  it("rejects unknown source type with INVALID_SMOKE_CLOUD", () => {
    expect(() =>
      createSmokeCloud({ ...validFunnelCloudParams(), sourceType: "INVALID" }),
    ).toThrowError(BluewaveError);
  });

  it("rejects density below 1 with INVALID_SMOKE_CLOUD", () => {
    expect(() => createSmokeCloud({ ...validFunnelCloudParams(), densityBp: 0 })).toThrowError(
      BluewaveError,
    );
  });

  it("rejects density above 10_000 with INVALID_SMOKE_CLOUD", () => {
    expect(() => createSmokeCloud({ ...validFunnelCloudParams(), densityBp: 10_001 })).toThrowError(
      BluewaveError,
    );
  });

  it("accepts boundary densities 1 and 10_000", () => {
    const low = createSmokeCloud({ ...validFunnelCloudParams(), densityBp: 1 });
    expect(low.densityBp).toBe(1);
    const high = createSmokeCloud({ ...validFunnelCloudParams(), densityBp: 10_000 });
    expect(high.densityBp).toBe(10_000);
  });

  it("rejects invalid centroid position (not array)", () => {
    expect(() =>
      createSmokeCloud({
        ...validFunnelCloudParams(),
        centroidPosition: null as unknown as [number, number],
      }),
    ).toThrowError(BluewaveError);
  });

  it("rejects zero or negative vertical extent", () => {
    expect(() =>
      createSmokeCloud({ ...validFunnelCloudParams(), verticalExtentM: 0 }),
    ).toThrowError(BluewaveError);
    expect(() =>
      createSmokeCloud({ ...validFunnelCloudParams(), verticalExtentM: -5 }),
    ).toThrowError(BluewaveError);
  });
});

describe("smokeCloudHash helper", () => {
  it("produces deterministic output", () => {
    const h1 = smokeCloudHash({
      sourceType: "FUNNEL",
      sourceId: "ship-123",
      owner: "PLAYER_1",
      creationMinute: 120,
      creationSubstep: 0,
      centroidPosition: [500, 300],
      densityBp: 7_500,
      verticalExtentM: 50,
      driftVector: [0.5, -0.3],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "oil",
      active: true,
    });
    const h2 = smokeCloudHash({
      sourceType: "FUNNEL",
      sourceId: "ship-123",
      owner: "PLAYER_1",
      creationMinute: 120,
      creationSubstep: 0,
      centroidPosition: [500, 300],
      densityBp: 7_500,
      verticalExtentM: 50,
      driftVector: [0.5, -0.3],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "oil",
      active: true,
    });
    expect(h1).toBe(h2);
  });
});
