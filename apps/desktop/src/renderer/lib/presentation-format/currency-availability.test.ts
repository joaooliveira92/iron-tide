import { describe, expect, it } from "vite-plus/test";

import {
  computeNationalCurrencyAvailability,
  currencyFallbackMessageKey,
  resolveCurrencyDisplay,
  type NationalCurrencyConfiguration,
} from "./index.js";

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

const source = { configurations: [POUNDS] };

describe("presentation-format: currency availability (U-3 ticket 05)", () => {
  it("is noActiveNation with no campaign", () => {
    expect(computeNationalCurrencyAvailability({}, source)).toEqual({ kind: "noActiveNation" });
  });

  it("is configured for a supported nation inside its period", () => {
    expect(computeNationalCurrencyAvailability({ nationId: "uk", year: 1900 }, source)).toEqual({
      kind: "configured",
    });
  });

  it("is notConfigured when the nation has no configuration", () => {
    expect(
      computeNationalCurrencyAvailability({ nationId: "germany", year: 1900 }, source),
    ).toEqual({ kind: "nationalCurrencyNotConfigured" });
  });

  it("is invalid when the nation's configuration failed validation", () => {
    expect(
      computeNationalCurrencyAvailability(
        { nationId: "france", year: 1900 },
        { configurations: [], invalidNationIds: ["france"] },
      ),
    ).toEqual({ kind: "nationalCurrencyInvalid" });
  });

  it("is outsideSupportedPeriod when the year is out of range", () => {
    expect(computeNationalCurrencyAvailability({ nationId: "uk", year: 1945 }, source)).toEqual({
      kind: "nationalCurrencyOutsideSupportedPeriod",
    });
  });
});

describe("presentation-format: requested→effective resolution (U-3 ticket 05)", () => {
  it("honours Naval Credits and Budget Points unconditionally", () => {
    expect(resolveCurrencyDisplay("navalCredits", { kind: "noActiveNation" })).toEqual({
      mode: "navalCredits",
    });
    expect(resolveCurrencyDisplay("budgetPoints", { kind: "noActiveNation" })).toEqual({
      mode: "budgetPoints",
    });
  });

  it("falls back to Naval Credits with the reason, never rewriting the request", () => {
    const request = "nationalHistorical" as const;
    expect(resolveCurrencyDisplay(request, { kind: "nationalCurrencyNotConfigured" })).toEqual({
      mode: "navalCredits",
      fallbackReason: "nationalCurrencyNotConfigured",
    });
    expect(request).toBe("nationalHistorical");
  });

  it("resolves National Historical when configured", () => {
    expect(resolveCurrencyDisplay("nationalHistorical", { kind: "configured" })).toEqual({
      mode: "nationalHistorical",
    });
  });

  it("maps each reason to a stable message key", () => {
    expect(currencyFallbackMessageKey("noActiveNation")).toBe(
      "settings.currency.unavailable.noActiveNation",
    );
  });
});
