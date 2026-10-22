import { describe, expect, it } from "vite-plus/test";
import { formatCalibreInches, formatTonnes } from "./armament.js";

describe("armament readouts (the five sites moved out of ArmamentEditor and batteryView)", () => {
  it("shows a gun calibre in inches to one decimal", () => {
    expect(formatCalibreInches(304_800)).toBe("12.0-inch");
    expect(formatCalibreInches(254_000)).toBe("10.0-inch");
    expect(formatCalibreInches(120_650)).toBe("4.8-inch");
    expect(formatCalibreInches(0)).toBe("0.0-inch");
  });

  it("shows a mass in tonnes with grouping and at most one decimal", () => {
    expect(formatTonnes(0)).toBe("0");
    expect(formatTonnes(500)).toBe("0.5");
    expect(formatTonnes(1_234_567)).toBe("1,234.6");
    expect(formatTonnes(30_000)).toBe("30");
  });

  it("is locale-independent: always en-US grouping, as the readouts it replaced", () => {
    expect(formatTonnes(12_345_000)).toBe("12,345");
  });
});
