import { describe, expect, it } from "vite-plus/test";
import { resolveSmoke, type SmokeContext } from "../../src/smoke/engineWiring.js";
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

describe("resolveSmoke determinism", () => {
  it("same inputs produce same smoke event records", () => {
    const clouds = [makeCloud({ smokeCloudId: "c1", centroidPosition: [100, 200] })];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 10,
      windDirection: 90,
      precipitationIntensityBp: 10_000,
    };

    const result1 = resolveSmoke(ctx, 1, 0);
    const result2 = resolveSmoke(ctx, 1, 0);

    expect(result1.events.length).toBe(result2.events.length);
    for (let i = 0; i < result1.events.length; i++) {
      expect(result1.events[i].recordHash).toBe(result2.events[i].recordHash);
      expect(result1.events[i].recordId).toBe(result2.events[i].recordId);
    }
  });

  it("different inputs produce different records", () => {
    const ctx1: SmokeContext = {
      clouds: [makeCloud({ smokeCloudId: "c1", centroidPosition: [100, 200], densityBp: 5_000 })],
      windSpeedKnots: 10,
      windDirection: 90,
      precipitationIntensityBp: 10_000,
    };
    const ctx2: SmokeContext = {
      clouds: [makeCloud({ smokeCloudId: "c1", centroidPosition: [100, 200], densityBp: 8_000 })],
      windSpeedKnots: 10,
      windDirection: 90,
      precipitationIntensityBp: 10_000,
    };

    const result1 = resolveSmoke(ctx1, 1, 0);
    const result2 = resolveSmoke(ctx2, 1, 0);

    // Different density should produce different drift-decay event hashes
    expect(result1.events.length).toBeGreaterThan(0);
    expect(result2.events.length).toBeGreaterThan(0);
    let hashesDiffer = false;
    for (let i = 0; i < Math.min(result1.events.length, result2.events.length); i++) {
      if (result1.events[i].recordHash !== result2.events[i].recordHash) {
        hashesDiffer = true;
        break;
      }
    }
    expect(hashesDiffer).toBe(true);
  });

  it("empty smoke context produces no events", () => {
    const ctx: SmokeContext = {
      clouds: [],
      windSpeedKnots: 10,
      windDirection: 90,
      precipitationIntensityBp: 10_000,
    };

    const result = resolveSmoke(ctx, 1, 0);
    expect(result.events.length).toBe(0);
    expect(result.nextClouds.length).toBe(0);
  });

  it("smoke drift + decay cycle deterministic", () => {
    const clouds = [
      makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0], densityBp: 10_000 }),
      makeCloud({ smokeCloudId: "c2", centroidPosition: [500, 500], densityBp: 7_500 }),
    ];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 5,
      windDirection: 45,
      precipitationIntensityBp: 10_000,
    };

    // Run two cycles: the drift-decay changes cloud state, and the second
    // cycle should produce deterministic results when given the same input.
    const result1 = resolveSmoke(ctx, 1, 0);

    // Use the output clouds as input for a second minute
    const ctx2: SmokeContext = {
      clouds: result1.nextClouds,
      windSpeedKnots: 5,
      windDirection: 45,
      precipitationIntensityBp: 10_000,
    };
    const result2a = resolveSmoke(ctx2, 2, 0);
    const result2b = resolveSmoke(ctx2, 2, 0);

    expect(result2a.events.length).toBe(result2b.events.length);
    expect(result2a.nextClouds.length).toBe(result2b.nextClouds.length);
    for (let i = 0; i < result2a.events.length; i++) {
      expect(result2a.events[i].recordHash).toBe(result2b.events[i].recordHash);
    }
    for (let i = 0; i < result2a.nextClouds.length; i++) {
      expect(result2a.nextClouds[i].cloudHash).toBe(result2b.nextClouds[i].cloudHash);
    }
  });

  it("two smoke runs with same state produce identical output", () => {
    const clouds = [makeCloud({ smokeCloudId: "c1", centroidPosition: [0, 0] })];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 15,
      windDirection: 180,
      precipitationIntensityBp: 8_000,
    };

    const result1 = resolveSmoke(ctx, 1, 0);
    const result2 = resolveSmoke(ctx, 1, 0);

    // Same number of clouds
    expect(result1.nextClouds.length).toBe(result2.nextClouds.length);

    // Same cloud hashes
    for (let i = 0; i < result1.nextClouds.length; i++) {
      expect(result1.nextClouds[i].cloudHash).toBe(result2.nextClouds[i].cloudHash);
    }

    // Same record hashes
    for (let i = 0; i < result1.events.length; i++) {
      expect(result1.events[i].recordHash).toBe(result2.events[i].recordHash);
    }
  });

  it("cloud removal produces SMOKE_SOURCE_REMOVAL event", () => {
    // A cloud with density 1 at high wind will decay to 0 and be removed
    const clouds = [makeCloud({ smokeCloudId: "c1", densityBp: 1 })];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 30,
      windDirection: 0,
      precipitationIntensityBp: 10_000,
    };

    const result = resolveSmoke(ctx, 1, 0);

    // With density 1 and GE_25_BP retention (6_500), floor(1 * 6_500 / 10_000) = 0 < 1 → removed
    expect(result.nextClouds.length).toBe(0);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("SMOKE_SOURCE_REMOVAL");
  });

  it("surviving clouds produce DRIFT_DECAY events", () => {
    const clouds = [makeCloud({ smokeCloudId: "c1", densityBp: 10_000 })];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 5,
      windDirection: 0,
      precipitationIntensityBp: 10_000,
    };

    const result = resolveSmoke(ctx, 1, 0);

    expect(result.nextClouds.length).toBe(1);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("DRIFT_DECAY");
  });

  it("precipitation reduces density deterministically", () => {
    const clouds = [makeCloud({ smokeCloudId: "c1", densityBp: 10_000 })];
    const ctx: SmokeContext = {
      clouds,
      windSpeedKnots: 3,
      windDirection: 0,
      precipitationIntensityBp: 5_000,
    };

    const result = resolveSmoke(ctx, 1, 0);

    // wind < 5 → retention = 9_500
    // density after wind: floor(10_000 * 9_500 / 10_000) = 9_500
    // density after precip: floor(9_500 * 5_000 / 10_000) = 4_750
    expect(result.nextClouds[0].densityBp).toBe(4_750);
  });
});
