import { describe, expect, it } from "vite-plus/test";

import { formatMoney, type NationalCurrencyConfiguration } from "./index.js";

const LOCALE = "en-US" as const;

const POUNDS: NationalCurrencyConfiguration = {
  id: "gbr-gbp",
  nationId: "uk",
  displayName: "Pounds sterling",
  symbol: "£",
  symbolPosition: "prefix",
  spacing: false,
  decimals: 0,
  grouping: true,
  negatives: "minus",
  scale: null,
  period: { fromYear: 1880, toYear: 1939 },
  source: "fixture",
  interpretation: "relabel",
};

const FRANCS: NationalCurrencyConfiguration = {
  ...POUNDS,
  id: "fra-franc",
  nationId: "france",
  displayName: "Francs",
  symbol: "₣",
  symbolPosition: "suffix",
  spacing: true,
  decimals: 2,
  scale: { numerator: 25, denominator: 1 },
  interpretation: "transform",
};

describe("presentation-format: money modes (U-3 ticket 02)", () => {
  it("renders Naval Credits by default (a comparison unit, never historical)", () => {
    expect(formatMoney(1_200, { locale: LOCALE, mode: "navalCredits" })).toBe("1,200 NC");
  });

  it("renders Budget Points as the abstract unit", () => {
    expect(formatMoney(1_200, { locale: LOCALE, mode: "budgetPoints" })).toBe("1,200 BP");
  });

  it("accepts a resolved EffectiveCurrencyDisplayMode", () => {
    expect(formatMoney(1_200, { locale: LOCALE, mode: { mode: "navalCredits" } })).toBe("1,200 NC");
  });

  it("renders a relabel national-historical configuration (pounds sterling)", () => {
    expect(
      formatMoney(1_200, { locale: LOCALE, mode: "nationalHistorical", national: POUNDS }),
    ).toBe("£1,200");
  });

  it("renders a transform national-historical configuration (francs, exact integer scale)", () => {
    expect(formatMoney(100, { locale: LOCALE, mode: "nationalHistorical", national: FRANCS })).toBe(
      "2,500.00 ₣",
    );
  });

  it("renders negatives with a minus or parentheses", () => {
    expect(
      formatMoney(-1_200, { locale: LOCALE, mode: "nationalHistorical", national: POUNDS }),
    ).toBe("-£1,200");
    expect(
      formatMoney(-1_200, {
        locale: LOCALE,
        mode: "nationalHistorical",
        national: { ...POUNDS, negatives: "parentheses" },
      }),
    ).toBe("(£1,200)");
  });

  it("falls back to Naval Credits for malformed content with no configuration", () => {
    expect(formatMoney(1_200, { locale: LOCALE, mode: "nationalHistorical" })).toBe("1,200 NC");
  });
});
