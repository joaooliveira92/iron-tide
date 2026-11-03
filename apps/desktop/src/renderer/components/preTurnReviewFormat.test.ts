import { describe, expect, it } from "vite-plus/test";

import { formatCount } from "../lib/presentation-format/format.js";
import { formatMonth, formatOptional } from "./preTurnReviewFormat.js";

describe("preTurnReviewFormat", () => {
  it("labels a month as abbreviated name plus year", () => {
    expect(formatMonth({ year: 1900, month: 3 })).toBe("Mar 1900");
  });

  it("falls back to the numeric month when out of range", () => {
    expect(formatMonth({ year: 1900, month: 13 })).toBe("13 1900");
  });

  it("shows the pending dash or ellipsis when a figure is absent, through the injected formatter", () => {
    expect(formatOptional(null, true, formatCount)).toBe("…");
    expect(formatOptional(null, false, formatCount)).toBe("—");
    expect(formatOptional(7, true, formatCount)).toBe("7");
  });
});
