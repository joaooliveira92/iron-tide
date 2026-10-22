import { describe, it, expect } from "vite-plus/test";
import {
  damageEventOrder,
  createDamageEventRecord,
  type DamageEventRecord,
} from "../../src/damage/index.js";

function makeRecord(overrides: Partial<DamageEventRecord> = {}): DamageEventRecord {
  return createDamageEventRecord({
    battleMinute: 10,
    substep: 2,
    sourceId: "BATTERY-A",
    targetShipId: "SHIP-001",
    causalWeaponId: "SHELL-AP-1",
    hitLocation: "BELT-1",
    protectionInteraction: {
      effectiveResistanceUm: 300_000,
      penetrationMargin: 50_000,
      outcome: "FULL_PENETRATION",
    },
    componentEffects: [],
    structureFlotationEffects: {
      structuralIntegrityAfter: 95_000,
      flotationReserveAfter: 48_000,
      uncappedStructuralDamage: 5_000,
      uncappedFlotationDamage: 2_000,
    },
    createdFireSources: [],
    createdFloodingSources: [],
    terminalTransition: null,
    ...overrides,
  });
}

describe("AC-4: Canonical ordering (§46)", () => {
  it("orders by battleMinute ascending", () => {
    const a = makeRecord({ battleMinute: 5 });
    const b = makeRecord({ battleMinute: 10 });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders by substep ascending when battleMinute equal", () => {
    const a = makeRecord({ battleMinute: 10, substep: 1 });
    const b = makeRecord({ battleMinute: 10, substep: 5 });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders by sourceId lexicographic when minute and substep equal", () => {
    const a = makeRecord({ battleMinute: 10, substep: 2, sourceId: "ALPHA" });
    const b = makeRecord({ battleMinute: 10, substep: 2, sourceId: "BRAVO" });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders by targetShipId lexicographic when earlier fields equal", () => {
    const a = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
    });
    const b = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-002",
    });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders by causalWeaponId lexicographic when earlier fields equal", () => {
    const a = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
    });
    const b = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-2",
    });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders by hitLocation lexicographic when earlier fields equal", () => {
    const a = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-1",
    });
    const b = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-2",
    });
    expect(damageEventOrder(a, b)).toBeLessThan(0);
    expect(damageEventOrder(b, a)).toBeGreaterThan(0);
  });

  it("tiebreaker uses recordHash lexicographic", () => {
    const a = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-1",
      componentEffects: [{ componentId: "TURRET-1", outcome: "DEGRADED", locationId: "TURRET-1" }],
    });
    const b = makeRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-1",
      componentEffects: [{ componentId: "TURRET-2", outcome: "DESTROYED", locationId: "TURRET-2" }],
    });
    const order = damageEventOrder(a, b);
    expect(order).not.toBe(0);
    expect(a.recordHash.localeCompare(b.recordHash)).toBe(order);
  });

  it("identical records compare as 0", () => {
    const a = makeRecord();
    const b = makeRecord();
    expect(a.recordHash).toBe(b.recordHash);
    expect(damageEventOrder(a, b)).toBe(0);
  });

  it("sorts an array of records correctly", () => {
    const records = [
      makeRecord({ battleMinute: 12, sourceId: "BATTERY-C" }),
      makeRecord({ battleMinute: 10, sourceId: "BATTERY-A" }),
      makeRecord({ battleMinute: 11, sourceId: "BATTERY-B" }),
    ];
    const sorted = [...records].sort(damageEventOrder);
    expect(sorted[0].battleMinute).toBe(10);
    expect(sorted[1].battleMinute).toBe(11);
    expect(sorted[2].battleMinute).toBe(12);
  });
});
