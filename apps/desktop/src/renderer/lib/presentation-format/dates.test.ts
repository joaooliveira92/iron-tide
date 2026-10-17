import { describe, expect, it } from "vite-plus/test";

import { formatCampaignMonth, formatNumber, localizedMonthName } from "./index.js";

const LOCALE = "en-US" as const;

describe("presentation-format: campaign dates (U-3 ticket 03)", () => {
  it("formats a canonical month/year without a Date or wall clock", () => {
    expect(formatCampaignMonth({ year: 1880, month: 1 }, { locale: LOCALE })).toBe("January 1880");
    expect(formatCampaignMonth({ year: 1905, month: 12 }, { locale: LOCALE })).toBe(
      "December 1905",
    );
  });

  it("formats a short month style", () => {
    expect(formatCampaignMonth({ year: 1880, month: 3 }, { locale: LOCALE, style: "short" })).toBe(
      "Mar 1880",
    );
  });

  it("falls back to the numeric month when out of range, never a blank", () => {
    expect(localizedMonthName(13, LOCALE)).toBeUndefined();
    expect(formatCampaignMonth({ year: 1880, month: 13 }, { locale: LOCALE })).toBe("13 1880");
  });

  it("never groups the year", () => {
    expect(formatNumber(1880, { locale: LOCALE })).toBe("1,880");
    expect(formatCampaignMonth({ year: 1880, month: 6 }, { locale: LOCALE })).toBe("June 1880");
  });
});
