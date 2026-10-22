import { describe, it, expect } from "vite-plus/test";
import { BattleResolver, StrengthCalculator } from "@bluewave/combat/battleResolution";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { buildTestState } from "../simulation/advance.test.js";

const ORDER = { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } };
const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";

const BASELINE_MINUTE_HASHES = [
  "9dad9e7afe95f50db01c5f320d98ae303f621ae8b3198cd026d49b58ccc1002b",
  "7364212a3a08d71ca5ef2727c11a009011f0be0e30b2d7f3f132bbf39272a17a",
  "c2001463797927b9f5dcb9424f472c17d2fe939d3e38282c1cbe667d6d8d8b20",
] as const;

describe("AC-17: BattleResolver unmodified boundary", () => {
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

describe("AC-17: StrengthCalculator unmodified boundary", () => {
  it("StrengthCalculator exists with expected static methods", () => {
    expect(typeof StrengthCalculator.totalFirepower).toBe("function");
    expect(typeof StrengthCalculator.averageArmor).toBe("function");
    expect(typeof StrengthCalculator.totalHitPoints).toBe("function");
    expect(typeof StrengthCalculator.maxHitPoints).toBe("function");
    expect(typeof StrengthCalculator.damagePotential).toBe("function");
    expect(typeof StrengthCalculator.survivability).toBe("function");
  });
});

describe("AC-13: no-weather strict no-op (pinned byte-identical baseline)", () => {
  it("weather-absent minute hashes are byte-identical to the pinned B-2/B-4 baseline", () => {
    const res = advanceMinutes({
      state: buildTestState(),
      minutes: 3,
      observationTime: OBSERVATION_TIME,
      orders: ORDER,
    });
    expect(res.hashes).toEqual([...BASELINE_MINUTE_HASHES]);
  });

  it("weather-absent runs append zero weather events", () => {
    const res = advanceMinutes({
      state: buildTestState(),
      minutes: 3,
      observationTime: OBSERVATION_TIME,
      orders: ORDER,
    });
    for (const r of res.results) {
      expect(r.events.filter((e) => e.eventType.startsWith("weather_"))).toHaveLength(0);
    }
  });
});
