import { describe, expect, it } from "vite-plus/test";
import { resolveDamageControl, type DamageControlContext } from "@bluewave/combat/damage";
import type { FireRecord, FloodingSourceRecord } from "@bluewave/combat/damage";
import { createDefaultDamageControlResource } from "@bluewave/combat/damage";
import type { DamageControlResource } from "@bluewave/combat/damage";

function makeDefaultResource(): DamageControlResource {
  return createDefaultDamageControlResource();
}

const TEST_HULL_DISPLACEMENT_KG = 10_000_000;

function makeContext(overrides: Partial<DamageControlContext> = {}): DamageControlContext {
  return {
    fireRecords: [],
    floodingRecords: [],
    floodedWaterBp: 0,
    designDisplacementKg: TEST_HULL_DISPLACEMENT_KG,
    shipType: "ORDINARY",
    currentSpeedKt: 10,
    resources: makeDefaultResource(),
    keyedRng: null,
    ...overrides,
  };
}

function makeFire(locationId: string, intensityBp: number, cause = "gunnery"): FireRecord {
  return { locationId, intensityBp, cause };
}

function makeFlood(
  compartmentId: string,
  rateKgMin: number,
  cause = "gunnery",
): FloodingSourceRecord {
  return { compartmentId, rateKgMin, cause };
}

describe("resolveDamageControl", () => {
  it("returns empty results when no fires or floods", () => {
    const ctx = makeContext();
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.fireRecords.length).toBe(0);
    expect(result.floodingRecords.length).toBe(0);
    expect(result.allocations.length).toBe(0);
    expect(result.smokeEventRecords.length).toBe(0);
    expect(result.highSpeedLoss).toBe(false);
  });

  it("fire progression creates decayed records", () => {
    const fires = [makeFire("comp-1", 5_000)];
    const ctx = makeContext({ fireRecords: fires });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.fireRecords.length).toBe(1);
    expect(result.fireRecords[0].intensityBp).toBe(5_000 - 200);
    expect(result.fireRecords[0].locationId).toBe("comp-1");
  });

  it("fire with low intensity is extinguished", () => {
    const fires = [makeFire("comp-1", 100)];
    const ctx = makeContext({ fireRecords: fires });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.fireRecords.length).toBe(0);
  });

  it("multiple fires decay independently", () => {
    const fires = [makeFire("comp-1", 10_000), makeFire("comp-2", 1_000)];
    const ctx = makeContext({ fireRecords: fires });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.fireRecords.length).toBe(2);
    expect(result.fireRecords[0].intensityBp).toBe(10_000 - 200);
    expect(result.fireRecords[1].intensityBp).toBe(1_000 - 200);
  });

  it("flooding progression updates flooded water mass", () => {
    const floods = [makeFlood("comp-1", 100)];
    const ctx = makeContext({ floodingRecords: floods, floodedWaterBp: 500_000 });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.nextFloodedWaterBp).toBeGreaterThanOrEqual(500_000);
  });

  it("damage-control resources are allocated", () => {
    const fires = [makeFire("comp-1", 8_000)];
    const floods = [makeFlood("comp-1", 500)];
    const ctx = makeContext({
      fireRecords: fires,
      floodingRecords: floods,
      floodedWaterBp: 3_000_000,
    });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.allocations.length).toBeGreaterThan(0);
    const fireAlloc = result.allocations.find(
      (a) => a.targetId === "comp-1" && a.allocatedFirefighting > 0,
    );
    expect(fireAlloc).toBeDefined();
  });

  it("combined fire + flood produces smoke records and allocations", () => {
    const fires = [makeFire("comp-1", 8_000)];
    const floods = [makeFlood("comp-1", 200)];
    const ctx = makeContext({
      fireRecords: fires,
      floodingRecords: floods,
      floodedWaterBp: 2_000_000,
    });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.smokeEventRecords.length).toBeGreaterThan(0);
    expect(result.smokeEventRecords[0].kind).toBe("FUNNEL_EMISSION");
    expect(result.smokeEventRecords[0].sourceType).toBe("FIRE");
    expect(result.smokeEventRecords[0].densityBp).toBeGreaterThan(0);

    expect(result.allocations.length).toBe(2);
  });

  it("fires with low intensity produce no smoke", () => {
    const fires = [makeFire("comp-1", 10)];
    const ctx = makeContext({ fireRecords: fires });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.smokeEventRecords.length).toBe(0);
  });

  it("high-speed loss false when no keyedRng provided", () => {
    const floods = [makeFlood("comp-1", 500)];
    const ctx = makeContext({
      floodingRecords: floods,
      floodedWaterBp: 3_000_000,
      currentSpeedKt: 25,
      keyedRng: null,
    });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.highSpeedLoss).toBe(false);
  });

  it("smoke records have correct FUNNEL_EMISSION kind", () => {
    const fires = [makeFire("comp-1", 8_000)];
    const ctx = makeContext({ fireRecords: fires });
    const result = resolveDamageControl(ctx, 1, 0);

    for (const sr of result.smokeEventRecords) {
      expect(sr.kind).toBe("FUNNEL_EMISSION");
      expect(sr.sourceType).toBe("FIRE");
    }
  });

  it("flooding records are unchanged by resolveDamageControl", () => {
    const floods = [makeFlood("comp-1", 100)];
    const ctx = makeContext({ floodingRecords: floods });
    const result = resolveDamageControl(ctx, 1, 0);

    expect(result.floodingRecords).toBe(floods);
    expect(result.floodingRecords.length).toBe(1);
  });

  it("fire smoke strength depends on fire intensity", () => {
    const intenseFire = resolveDamageControl(
      makeContext({ fireRecords: [makeFire("comp-1", 10_000)] }),
      1,
      0,
    );
    const weakFire = resolveDamageControl(
      makeContext({ fireRecords: [makeFire("comp-1", 1_000)] }),
      1,
      0,
    );

    const intenseSmoke = intenseFire.smokeEventRecords.reduce((sum, r) => sum + r.densityBp, 0);
    const weakSmoke = weakFire.smokeEventRecords.reduce((sum, r) => sum + r.densityBp, 0);
    expect(intenseSmoke).toBeGreaterThan(weakSmoke);
  });
});
