import { describe, expect, it } from "vite-plus/test";
import { formatMonthYear, monthName, MONTH_NAMES, MONTH_NAMES_SHORT } from "./campaign-month.js";

describe("campaign-month", () => {
  it("names every month, long and short, in calendar order", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES_SHORT).toHaveLength(12);
    expect(monthName(1)).toBe("January");
    expect(monthName(12)).toBe("December");
    expect(monthName(1, "short")).toBe("Jan");
    expect(monthName(12, "short")).toBe("Dec");
  });

  it("returns undefined for a month outside 1–12 so callers choose the fallback", () => {
    expect(monthName(0)).toBeUndefined();
    expect(monthName(13)).toBeUndefined();
  });

  it("formats a month and year, falling back to the numeric month when out of range", () => {
    expect(formatMonthYear({ year: 1880, month: 1 })).toBe("January 1880");
    expect(formatMonthYear({ year: 1900, month: 3 }, "short")).toBe("Mar 1900");
    expect(formatMonthYear({ year: 1900, month: 13 })).toBe("13 1900");
    expect(formatMonthYear({ year: 1900, month: 0 })).toBe("0 1900");
  });
});
