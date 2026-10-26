import { describe, it, expect } from "vite-plus/test";
import { composeBpMultipliers, scaleByBp } from "../src/index.js";

describe("@bluewave/armament arithmetic", () => {
  it("scales a value by basis points", () => {
    const result = scaleByBp(45_000, 14_800);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(66_600);
  });

  it("reports scale overflow as a failure value", () => {
    const result = scaleByBp(Number.MAX_SAFE_INTEGER, 1_000_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure._tag).toBe("ArmamentArithmeticOverflow");
  });

  it("rejects a negative scale factor as a failure value", () => {
    const result = scaleByBp(1_000, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure._tag).toBe("ArmamentArithmeticInput");
  });

  it("composes two basis-point multipliers", () => {
    const result = composeBpMultipliers([10_000, 5_000]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(5_000);
  });

  it("reports compose overflow as a failure value", () => {
    const result = composeBpMultipliers([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure._tag).toBe("ArmamentArithmeticOverflow");
  });
});
