// AC-13/AC-17 (L1): the B-5 `resolveWeather` stage must not disturb the B-2/B-3/
// B-4 baseline — `BattleResolver`/`StrengthCalculator` are verifiably
// unmodified, and the no-weather-context path appends zero events with minute
// hashes byte-identical to the pinned B-2/B-4 baseline. NOTE: the strict no-op
// is defined as "weather context absent" (rate-relevant, see ADR-0022 §11); the
// AC-13 phrase "no weather components change" refers to the no-context path.
import { describe, it, expect } from "vite-plus/test";
import { BattleResolver, StrengthCalculator } from "../../src/index.js";
import { advanceMinutes } from "../../src/simulation/engine.js";
import { buildTestState } from "../simulation/advance.test.js";

const ORDER = { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } };
const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";

// Pinned B-2/B-4 baseline minute hashes (3 minutes, buildTestState, a1 order).
// These literals are the byte-identical anchor proving the B-5 stage adds
// nothing to the no-weather path (L1).
// ADR-0007 re-pin (P-1 ticket 08, spawn heading 90/270 -> 0/180 so the spawn
// convention matches movement's directionBp). Verified heading-only: forcing the old
// 90/270 headings onto the new spawn reproduces the OLD hashes exactly. OLD -> NEW:
//   4fec82834e5434557526c71e075388880b627689084cb5866e85a25069fc693d ->
//   9dad9e7afe95f50db01c5f320d98ae303f621ae8b3198cd026d49b58ccc1002b
//   8d5a88b1bb8f43c9fe713900f8040c821b1984e11c66f13b25fedd87bac7c3d1 ->
//   7364212a3a08d71ca5ef2727c11a009011f0be0e30b2d7f3f132bbf39272a17a
//   eba05c9b89987d26e0e592c82071193c8a098b5018be7b3cd7b795bb9d3b0e49 ->
//   c2001463797927b9f5dcb9424f472c17d2fe939d3e38282c1cbe667d6d8d8b20
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
