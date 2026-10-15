// packages/combat/test/air-defense/damage-power.test.ts
// AC-14: Simplified damage/power state + local control multiplier (§21).
// Verifies the simplified system-level damage status thresholds, the damage/power
// multipliers, the damage×power fold into the formula's single "damage" term, and the
// 5_000 bp local-control multiplier.

import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  Category,
  Layer,
  classifySystemDamage,
  createAirDefenseSystemDefinition,
  damageMultiplierBp,
  effectiveDamageMultiplierBp,
  localControlMultiplierBp,
  powerMultiplierBp,
} from "../../src/air-defense/index.js";

function makeSystem(overrides: Record<string, unknown> = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_001",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
    ...overrides,
  });
}

describe("AC-14: simplified §21 damage status", () => {
  it("classifies damageBp into OPERATIONAL / DAMAGED / DESTROYED", () => {
    expect(classifySystemDamage(SafeInt(0))).toBe("OPERATIONAL");
    expect(classifySystemDamage(SafeInt(1))).toBe("DAMAGED");
    expect(classifySystemDamage(SafeInt(9_999))).toBe("DAMAGED");
    expect(classifySystemDamage(SafeInt(10_000))).toBe("DESTROYED");
    expect(classifySystemDamage(SafeInt(50_000))).toBe("DESTROYED");
  });

  it("damageMultiplierBp: OPERATIONAL 10_000 / DAMAGED 5_000 / DESTROYED 0", () => {
    expect(Number(damageMultiplierBp("OPERATIONAL"))).toBe(10_000);
    expect(Number(damageMultiplierBp("DAMAGED"))).toBe(5_000);
    expect(Number(damageMultiplierBp("DESTROYED"))).toBe(0);
  });

  it("powerMultiplierBp: 0 when unpowered, else 10_000", () => {
    expect(Number(powerMultiplierBp(SafeInt(0)))).toBe(0);
    expect(Number(powerMultiplierBp(SafeInt(-1)))).toBe(0);
    expect(Number(powerMultiplierBp(SafeInt(1)))).toBe(10_000);
    expect(Number(powerMultiplierBp(SafeInt(10_000)))).toBe(10_000);
  });
});

describe("AC-14: damage × power fold (§19 damage term)", () => {
  it("OPERATIONAL at full power → neutral 10_000", () => {
    expect(Number(effectiveDamageMultiplierBp(SafeInt(0), SafeInt(10_000)))).toBe(10_000);
  });

  it("DAMAGED at full power → 5_000", () => {
    expect(Number(effectiveDamageMultiplierBp(SafeInt(5_000), SafeInt(10_000)))).toBe(5_000);
    expect(Number(effectiveDamageMultiplierBp(SafeInt(12), SafeInt(10_000)))).toBe(5_000);
  });

  it("DESTROYED → 0 regardless of power", () => {
    expect(Number(effectiveDamageMultiplierBp(SafeInt(10_000), SafeInt(10_000)))).toBe(0);
  });

  it("unpowered → 0 regardless of damage", () => {
    expect(Number(effectiveDamageMultiplierBp(SafeInt(0), SafeInt(0)))).toBe(0);
    expect(Number(effectiveDamageMultiplierBp(SafeInt(2_000), SafeInt(0)))).toBe(0);
  });
});

describe("AC-14: local control multiplier (§21 lines 361-363)", () => {
  it("5000 bp when the system definition supports local control", () => {
    const system = makeSystem({ localControlSupported: true });
    expect(Number(localControlMultiplierBp(system))).toBe(5_000);
  });

  it("neutral 10_000 when local control is not supported", () => {
    const system = makeSystem({ localControlSupported: false });
    expect(Number(localControlMultiplierBp(system))).toBe(10_000);
  });

  it("defaults to not supporting local control", () => {
    expect(Number(localControlMultiplierBp(makeSystem()))).toBe(10_000);
  });
});
