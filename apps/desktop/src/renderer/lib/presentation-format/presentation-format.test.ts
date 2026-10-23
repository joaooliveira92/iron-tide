import { describe, expect, it } from "vite-plus/test";

import { KNOTS_TO_UMS, MM_TO_UM, UM_PER_INCH } from "@bluewave/contracts";

import {
  PresentationFormatError,
  assertMeasurementSelection,
  formatFixed,
  formatMeasurement,
  formatNumber,
  formatPercent,
  formatTimestamp,
  resolveDisplayUnit,
} from "./index.js";

const LOCALE = "en-US" as const;
const IMPERIAL = "imperial" as const;
const METRIC = "metric" as const;

describe("presentation-format: measurements (U-3 ticket 01)", () => {
  it("renders speed in knots under both presets (naval default)", () => {
    expect(
      formatMeasurement(KNOTS_TO_UMS, { locale: LOCALE, category: "speed", preset: IMPERIAL }),
    ).toBe("1 kn");
    expect(
      formatMeasurement(KNOTS_TO_UMS, { locale: LOCALE, category: "speed", preset: METRIC }),
    ).toBe("1 kn");
  });

  it("renders calibre in inches (imperial) and millimetres (metric)", () => {
    expect(
      formatMeasurement(UM_PER_INCH, { locale: LOCALE, category: "calibre", preset: IMPERIAL }),
    ).toBe("1 in");
    expect(
      formatMeasurement(UM_PER_INCH, { locale: LOCALE, category: "calibre", preset: METRIC }),
    ).toBe("25.4 mm");
  });

  it("renders range in yards (imperial) and kilometres (metric)", () => {
    expect(
      formatMeasurement(UM_PER_INCH * 36, { locale: LOCALE, category: "range", preset: IMPERIAL }),
    ).toBe("1 yd");
    expect(
      formatMeasurement(10_000_000_000, { locale: LOCALE, category: "range", preset: METRIC }),
    ).toBe("10 km");
  });

  it("renders mass in tonnes and pounds", () => {
    expect(formatMeasurement(1_000, { locale: LOCALE, category: "mass", preset: IMPERIAL })).toBe(
      "1 t",
    );
    expect(
      formatMeasurement(1_000, {
        locale: LOCALE,
        category: "mass",
        preset: IMPERIAL,
        selections: { mass: "pounds" },
      }),
    ).toBe("2,205 lb");
  });

  it("renders volume and power", () => {
    expect(formatMeasurement(1_000, { locale: LOCALE, category: "volume", preset: METRIC })).toBe(
      "1 m³",
    );
    expect(
      formatMeasurement(745.699872, { locale: LOCALE, category: "power", preset: METRIC }),
    ).toBe("746 kW");
    expect(
      formatMeasurement(745.699872, { locale: LOCALE, category: "power", preset: IMPERIAL }),
    ).toBe("1,000 hp");
  });

  it("honours a per-category selection and degrades an invalid one to the default", () => {
    expect(
      formatMeasurement(UM_PER_INCH, {
        locale: LOCALE,
        category: "calibre",
        preset: IMPERIAL,
        selections: { calibre: "millimetres" },
      }),
    ).toBe("25.4 mm");
    expect(
      formatMeasurement(UM_PER_INCH, {
        locale: LOCALE,
        category: "calibre",
        preset: IMPERIAL,
        selections: { calibre: "tonnes" },
      }),
    ).toBe("1 in");
  });

  it("rejects an incompatible selection and an unknown category with a typed error", () => {
    expect(() => assertMeasurementSelection("calibre", "tonnes")).toThrow(PresentationFormatError);
    expect(() => resolveDisplayUnit("bogus" as never, IMPERIAL, {})).toThrow(
      PresentationFormatError,
    );
  });

  it("converts millimetres to canonical micrometres consistently", () => {
    expect(
      formatMeasurement(12 * UM_PER_INCH, { locale: LOCALE, category: "calibre", preset: METRIC }),
    ).toBe("304.8 mm");
    expect(305 * MM_TO_UM).toBe(305_000);
  });
});

describe("presentation-format: numbers and percentages (U-3 ticket 01)", () => {
  it("formats a number fully or abbreviated per the number scale", () => {
    expect(formatNumber(1_234, { locale: LOCALE, numberScale: "full" })).toBe("1,234");
    expect(formatNumber(1_234, { locale: LOCALE, numberScale: "abbreviated" })).toBe("1.2K");
  });

  it("formats basis points as a percentage", () => {
    expect(formatPercent(2_500, { locale: LOCALE })).toBe("25%");
    expect(formatPercent(10_000, { locale: LOCALE })).toBe("100%");
  });
});

describe("formatFixed and formatTimestamp", () => {
  it("keeps trailing zeros and never groups", () => {
    expect(formatFixed(1234.5, { locale: "en-US", digits: 1 })).toBe("1234.5");
    expect(formatFixed(12, { locale: "en-US", digits: 2 })).toBe("12.00");
    expect(formatFixed(2.15, { locale: "en-US", digits: 1 })).toBe("2.1");
    expect(formatFixed(131.6, { locale: "en-US", digits: 0 })).toBe("132");
  });

  it("renders a timestamp as en-US time or date-time", () => {
    const iso = "2026-10-22T21:13:46";
    expect(formatTimestamp(iso, { locale: "en-US", style: "time" })).toBe("9:13:46 PM");
    expect(formatTimestamp(iso, { locale: "en-US", style: "dateTime" })).toBe(
      "10/22/2026, 9:13:46 PM",
    );
  });
});
