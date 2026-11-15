import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { monthLabel, signed } from "./month-report-format.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("signed", () => {
  it("shows direction explicitly, with a real minus sign", () => {
    expect(signed(20, FORMAT)).toBe("+20");
    expect(signed(-56, FORMAT)).toBe("−56");
    expect(signed(0, FORMAT)).toBe("0");
    expect(signed(12345, FORMAT)).toBe("+12,345");
  });
});

describe("monthLabel", () => {
  it("formats the campaign month as a human-readable label", () => {
    expect(monthLabel({ year: 1900, month: 3 })).toBe("March 1900");
  });

  it("falls back to the numeric month when out of range", () => {
    expect(monthLabel({ year: 1900, month: 13 })).toBe("13 1900");
  });
});
