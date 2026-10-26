import { describe, expect, it } from "vite-plus/test";
import { monthLabel, monthsPhrase } from "./research-calendar.js";

describe("monthLabel", () => {
  it("names the month an offset away, rolling the year over", () => {
    expect(monthLabel({ month: 1, year: 1880 }, 0)).toBe("Jan 1880");
    expect(monthLabel({ month: 11, year: 1880 }, 3)).toBe("Feb 1881");
    expect(monthLabel({ month: 1, year: 1880 }, 14)).toBe("Mar 1881");
  });
});

describe("monthsPhrase", () => {
  it("pluralises", () => {
    expect(monthsPhrase(1)).toBe("1 month");
    expect(monthsPhrase(5)).toBe("5 months");
  });
});
