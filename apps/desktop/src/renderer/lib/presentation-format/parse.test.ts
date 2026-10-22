import { describe, expect, it } from "vite-plus/test";

import { PresentationFormatError, formatMeasurement, parseMeasurement } from "./index.js";

const LOCALE = "en-US" as const;
const IMPERIAL = "imperial" as const;
const METRIC = "metric" as const;

describe("presentation-format: parse-once input (U-3 ticket 06)", () => {
  it("parses a display-unit value into the canonical integer once", () => {
    expect(parseMeasurement("12", { category: "calibre", preset: IMPERIAL })).toBe(304_800);
    expect(parseMeasurement("305 mm", { category: "calibre", preset: METRIC })).toBe(305_000);
  });

  it("round-trips through the formatter (no double conversion)", () => {
    const canonical = parseMeasurement("25.4", { category: "calibre", preset: METRIC });
    expect(canonical).toBe(25_400);
    expect(
      formatMeasurement(canonical, { locale: LOCALE, category: "calibre", preset: METRIC }),
    ).toBe("25.4 mm");
  });

  it("honours a per-category selection on parse", () => {
    expect(
      parseMeasurement("1", {
        category: "calibre",
        preset: IMPERIAL,
        selections: { calibre: "millimetres" },
      }),
    ).toBe(1_000);
  });

  it("tolerates grouping separators and throws on a non-number", () => {
    expect(parseMeasurement("1,000", { category: "range", preset: IMPERIAL })).toBe(
      Math.round(1_000 * 36 * 25_400),
    );
    expect(() => parseMeasurement("no digits", { category: "range", preset: IMPERIAL })).toThrow(
      PresentationFormatError,
    );
  });
});
