import { describe, expect, it } from "vite-plus/test";
import { formatPowerBoth, shaftHorsepower } from "./power.js";

describe("power in both kW and horsepower (#168 step 6)", () => {
  it("derives shaft horsepower from the ruleset's kW-per-shp constant, rounding to the nearest hp", () => {
    // 3_300 kW * 10_000 / 7_457 = 4_425.4 hp
    expect(shaftHorsepower(3_300, 7_457)).toBe(4_425);
    expect(shaftHorsepower(0, 7_457)).toBe(0);
    expect(shaftHorsepower(7_457, 7_457)).toBe(10_000);
  });
  it("shows kW first and horsepower beside it", () => {
    expect(formatPowerBoth(3_300, 7_457)).toBe("3,300 kW (4,425 hp)");
    expect(formatPowerBoth(0, 7_457)).toBe("0 kW (0 hp)");
  });
  it("rejects a non-positive constant rather than dividing by it", () => {
    expect(() => shaftHorsepower(100, 0)).toThrow(/kwPerShpBp/);
    expect(() => formatPowerBoth(100, -1)).toThrow(/kwPerShpBp/);
  });
});
