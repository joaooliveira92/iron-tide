import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  NO_ACTIVE_NATION_AVAILABILITY,
  resolveEffectiveCurrencyDisplayMode,
  type CurrencyDisplayMode,
  type NationalCurrencyAvailability,
} from "./preferences-contract.js";

describe("currency-display request vs effective (ADR-0211)", () => {
  it("defaults the request to Naval Credits", () => {
    expect(DEFAULT_APP_PREFERENCES.currencyDisplayMode).toBe("navalCredits");
  });

  it("honours Naval Credits and Budget Points whatever the availability", () => {
    const availabilities: readonly NationalCurrencyAvailability[] = [
      { kind: "noActiveNation" },
      { kind: "configured" },
      { kind: "nationalCurrencyInvalid" },
    ];
    for (const availability of availabilities) {
      for (const mode of ["navalCredits", "budgetPoints"] as const) {
        expect(resolveEffectiveCurrencyDisplayMode(mode, availability)).toEqual({ mode });
      }
    }
  });

  it("honours National Historical only when a validated configuration applies", () => {
    expect(
      resolveEffectiveCurrencyDisplayMode("nationalHistorical", { kind: "configured" }),
    ).toEqual({ mode: "nationalHistorical" });
  });

  it("with no active campaign resolves National Historical to Naval Credits", () => {
    expect(
      resolveEffectiveCurrencyDisplayMode("nationalHistorical", NO_ACTIVE_NATION_AVAILABILITY),
    ).toEqual({ mode: "navalCredits", fallbackReason: "noActiveNation" });
  });

  it("falls back with the matching reason for each unavailability", () => {
    const cases: readonly (readonly [NationalCurrencyAvailability, string])[] = [
      [{ kind: "noActiveNation" }, "noActiveNation"],
      [{ kind: "nationalCurrencyNotConfigured" }, "nationalCurrencyNotConfigured"],
      [{ kind: "nationalCurrencyInvalid" }, "nationalCurrencyInvalid"],
      [
        { kind: "nationalCurrencyOutsideSupportedPeriod" },
        "nationalCurrencyOutsideSupportedPeriod",
      ],
    ];
    for (const [availability, fallbackReason] of cases) {
      const request: CurrencyDisplayMode = "nationalHistorical";
      const result = resolveEffectiveCurrencyDisplayMode(request, availability);
      expect(result).toEqual({ mode: "navalCredits", fallbackReason });
      expect(request).toBe("nationalHistorical");
    }
  });
});
