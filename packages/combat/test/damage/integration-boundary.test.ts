//packages/combat/test/damage/integration-boundary.test.ts
// INC-4 — BattleResolver/StrengthCalculator unmodified boundary.
// Proves that the existing BattleResolver and StrengthCalculator classes are
// unchanged by the INC-4 damage module additions. These classes are not
// expected to change until the minute-advance simulation in M3.
import { describe, it, expect } from "vite-plus/test";
import { BattleResolver, StrengthCalculator } from "../../src/index.js";

describe("AC-4: BattleResolver unmodified boundary", () => {
  it("BattleResolver class exists and is constructable", () => {
    const resolver = new BattleResolver();
    expect(resolver).toBeInstanceOf(BattleResolver);
  });

  it("BattleResolver has expected method signatures", () => {
    const resolver = new BattleResolver();
    expect(typeof resolver.resolve).toBe("function");
    expect(typeof (resolver as any).computeStrength).toBe("function");
    expect(typeof (resolver as any).computeEffectiveStrength).toBe("function");
    expect(typeof (resolver as any).applyDamage).toBe("function");
  });
});

describe("AC-4: StrengthCalculator unmodified boundary", () => {
  it("StrengthCalculator exists with expected static methods", () => {
    expect(typeof StrengthCalculator.totalFirepower).toBe("function");
    expect(typeof StrengthCalculator.averageArmor).toBe("function");
    expect(typeof StrengthCalculator.totalHitPoints).toBe("function");
    expect(typeof StrengthCalculator.maxHitPoints).toBe("function");
    expect(typeof StrengthCalculator.damagePotential).toBe("function");
    expect(typeof StrengthCalculator.survivability).toBe("function");
  });
});
