import { describe, expect, it } from "vite-plus/test";
import { quantity } from "@bluewave/ship-design";
import { formatExplanation, formatExplanationValue } from "./explanation-text.js";

describe("formatExplanation", () => {
  it("passes a plain string through", () => {
    expect(formatExplanation("The ship has no propulsion.")).toBe("The ship has no propulsion.");
  });

  it("renders each unit code", () => {
    expect(formatExplanationValue(quantity(2000, 100, 1, "percent"))).toBe("20.0%");
    expect(formatExplanationValue(quantity(2000, 100, 1, "percentSpaced"))).toBe("20.0 %");
    expect(formatExplanationValue(quantity(800, 100, 0, "percentOfLimit"))).toBe("8 % of limit");
    expect(formatExplanationValue(quantity(250, 100, 1, "trimPercent"))).toBe("2.5 %L");
    expect(formatExplanationValue(quantity(12300, 1000, 1, "knots"))).toBe("12.3 kn");
    expect(formatExplanationValue(quantity(5000, 1000, 2, "metres"))).toBe("5.00 m");
    expect(formatExplanationValue(quantity(152400, 25400, 1, "inches"))).toBe("6.0 in");
    expect(formatExplanationValue(quantity(850, 100, 2, "ratio"))).toBe("8.50");
  });

  it("resolves unit suffixes for the requested locale, falling back to en-US", () => {
    expect(formatExplanationValue(quantity(12300, 1000, 1, "knots"), "en-US")).toBe("12.3 kn");
    expect(formatExplanationValue(quantity(12300, 1000, 1, "knots"), "xx-XX")).toBe("12.3 kn");
  });

  it("joins literal and token parts", () => {
    expect(
      formatExplanation(["Length/beam ratio ", quantity(850, 100, 2), " is outside the BB range."]),
    ).toBe("Length/beam ratio 8.50 is outside the BB range.");
  });

  it("keeps trailing zeros and no grouping, matching the former toFixed output", () => {
    expect(formatExplanationValue(quantity(2500, 100, 1, "percent"))).toBe("25.0%");
    expect(formatExplanationValue(quantity(1234, 1, 0))).toBe("1234");
  });
});
