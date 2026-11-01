import { describe, expect, it } from "vite-plus/test";

import { cachedDateTimeFormat, cachedListFormat, cachedNumberFormat } from "./intl-cache.js";

const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR", "hi-IN"] as const;

const NUMBER_OPTIONS: readonly (Intl.NumberFormatOptions | undefined)[] = [
  undefined,
  { maximumFractionDigits: 0 },
  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  { notation: "compact" },
  { notation: "standard", maximumFractionDigits: 1, minimumFractionDigits: 1 },
  { style: "percent", maximumFractionDigits: 0 },
  { style: "percent", maximumFractionDigits: 3 },
  { useGrouping: false },
  { style: "currency", currency: "GBP", minimumFractionDigits: 0 },
  { style: "unit", unit: "kilometer", maximumFractionDigits: 1 },
  { style: "unit", unit: "mile", unitDisplay: "narrow" },
];

const DATE_OPTIONS: readonly Intl.DateTimeFormatOptions[] = [
  { hour: "numeric", minute: "numeric", second: "numeric" },
  { year: "numeric", month: "numeric", day: "numeric" },
  { year: "numeric", month: "long", day: "numeric", hour: "2-digit" },
  { year: "numeric", month: "short", day: "2-digit", era: "short" },
];

const LIST_OPTIONS: readonly Intl.ListFormatOptions[] = [
  { style: "long", type: "conjunction" },
  { style: "short", type: "conjunction" },
  { style: "narrow", type: "disjunction" },
  { style: "long", type: "unit" },
];

const VALUES = [
  0, 1, 7, 42, 999, 1234.5, 1880, 25000, -9876.54321, 1_000_000, 1_234_567_890, 0.0001, -0,
];

const TIMESTAMPS = ["1880-01-01T00:00:00.000Z", "1905-06-15T13:45:09.000Z", "1939-12-31T23:59:59Z"];

const ITEM_SETS: readonly (readonly string[])[] = [
  [],
  ["Qing"],
  ["Qing", "Russia"],
  ["Qing", "Russia", "UK", "France"],
];

describe("presentation-format: intl formatter cache", () => {
  it("reuses one number formatter per locale and option set", () => {
    for (const locale of LOCALES) {
      for (const options of NUMBER_OPTIONS) {
        expect(cachedNumberFormat(locale, options)).toBe(cachedNumberFormat(locale, options));
      }
    }
  });

  it("formats identically to a freshly constructed number formatter", () => {
    for (const locale of LOCALES) {
      for (const options of NUMBER_OPTIONS) {
        const fresh = new Intl.NumberFormat(locale, options);
        for (const value of VALUES) {
          expect(cachedNumberFormat(locale, options).format(value)).toBe(fresh.format(value));
        }
      }
    }
  });

  it("keys on option values, not option order, and never shares distinct option sets", () => {
    const ordered: Intl.NumberFormatOptions = {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    };
    const reversed: Intl.NumberFormatOptions = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
    expect(cachedNumberFormat("de-DE", ordered)).toBe(cachedNumberFormat("de-DE", reversed));
    expect(cachedNumberFormat("de-DE", ordered)).not.toBe(cachedNumberFormat("de-DE", undefined));
    expect(cachedNumberFormat("de-DE", { maximumFractionDigits: 2 })).not.toBe(
      cachedNumberFormat("de-DE", { minimumFractionDigits: 2 }),
    );
    expect(cachedNumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 })).not.toBe(
      cachedNumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
    );
    expect(cachedNumberFormat("de-DE", { style: "currency", currency: "EUR" })).not.toBe(
      cachedNumberFormat("de-DE", { style: "currency", currency: "USD" }),
    );
    expect(cachedNumberFormat("de-DE", { style: "unit", unit: "kilometer" })).not.toBe(
      cachedNumberFormat("de-DE", { style: "unit", unit: "mile" }),
    );
  });

  it("formats dates identically to a freshly constructed date formatter", () => {
    for (const locale of LOCALES) {
      for (const options of DATE_OPTIONS) {
        const fresh = new Intl.DateTimeFormat(locale, options);
        for (const timestamp of TIMESTAMPS) {
          const date = new Date(timestamp);
          expect(cachedDateTimeFormat(locale, options).format(date)).toBe(fresh.format(date));
        }
        expect(cachedDateTimeFormat(locale, options)).toBe(cachedDateTimeFormat(locale, options));
      }
    }
  });

  it("formats lists identically to a freshly constructed list formatter", () => {
    for (const locale of LOCALES) {
      for (const options of LIST_OPTIONS) {
        const fresh = new Intl.ListFormat(locale, options);
        for (const items of ITEM_SETS) {
          expect(cachedListFormat(locale, options).format(items)).toBe(fresh.format(items));
        }
        expect(cachedListFormat(locale, options)).toBe(cachedListFormat(locale, options));
      }
    }
  });

  it("keeps distinct locales in the cache apart", () => {
    for (const value of VALUES) {
      expect(cachedNumberFormat("en-US", { useGrouping: true }).format(value)).toBe(
        new Intl.NumberFormat("en-US", { useGrouping: true }).format(value),
      );
      expect(cachedNumberFormat("de-DE", { useGrouping: true }).format(value)).toBe(
        new Intl.NumberFormat("de-DE", { useGrouping: true }).format(value),
      );
    }
    expect(cachedNumberFormat("en-US", NUMBER_OPTIONS[1])).not.toBe(
      cachedNumberFormat("de-DE", NUMBER_OPTIONS[1]),
    );
  });
});
