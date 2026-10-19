import { describe, expect, it } from "vite-plus/test";

import { buildTrend, TREND_MONTHS, type TrendReport } from "./status-strip-trend.js";

/** A stored report for the month `from` -> `from + 1`, treasury `open` -> `open + net`. */
function report(fromMonth: number, open: number, net: number): TrendReport {
  const to = fromMonth + 1;
  return {
    period: {
      from: { year: 1880, month: fromMonth },
      to: { year: 1880 + (to > 12 ? 1 : 0), month: to > 12 ? 1 : to },
    },
    treasury: { openingTreasury: open, closingTreasury: open + net, netChange: net },
  };
}

describe("buildTrend", () => {
  it("has no trend when no month has been advanced or the reports could not be read", () => {
    expect(buildTrend(null)).toBeNull();
    expect(buildTrend([])).toBeNull();
  });

  it("reads one advanced month as an opening and a closing treasury with no net delta yet", () => {
    const trend = buildTrend([report(1, 1_000, 35)]);
    expect(trend?.months).toBe(1);
    expect(trend?.treasury.values).toEqual([1_000, 1_035]);
    expect(trend?.treasury.labels).toEqual(["Jan 1880", "Feb 1880"]);
    expect(trend?.treasury.delta).toBe("+£35");
    expect(trend?.treasury.direction).toBe("up");
    // One month of net has nothing to compare with.
    expect(trend?.net.values).toEqual([35]);
    expect(trend?.net.delta).toBeNull();
    expect(trend?.net.direction).toBeNull();
  });

  it("orders the series oldest to newest from newest-first reports", () => {
    const trend = buildTrend([report(3, 1_070, -20), report(2, 1_035, 35), report(1, 1_000, 35)]);
    expect(trend?.treasury.values).toEqual([1_000, 1_035, 1_070, 1_050]);
    expect(trend?.net.values).toEqual([35, 35, -20]);
    expect(trend?.net.labels).toEqual(["Jan 1880", "Feb 1880", "Mar 1880"]);
    expect(trend?.treasury.current).toBe("£1,050");
  });

  it("states a worsening net as a signed amount with a down direction", () => {
    const trend = buildTrend([report(3, 1_070, -20), report(2, 1_035, 35)]);
    expect(trend?.net.current).toBe("-£20");
    expect(trend?.net.delta).toBe("-£55");
    expect(trend?.net.direction).toBe("down");
    expect(trend?.treasury.delta).toBe("-£20");
  });

  it("reads an unchanged value as flat, not up or down", () => {
    const trend = buildTrend([report(2, 1_000, 0), report(1, 1_000, 0)]);
    expect(trend?.net.direction).toBe("flat");
    expect(trend?.net.delta).toBe("£0");
  });

  it("looks back only over the most recent months", () => {
    const reports = Array.from({ length: 10 }, (_, i) => report(10 - i, 1_000, 10));
    const trend = buildTrend(reports);
    expect(trend?.months).toBe(TREND_MONTHS);
    expect(trend?.net.values).toHaveLength(TREND_MONTHS);
    expect(trend?.treasury.values).toHaveLength(TREND_MONTHS + 1);
    // The newest month is last.
    expect(trend?.net.labels.at(-1)).toBe("Oct 1880");
  });

  it("labels a December close as January of the next year", () => {
    const trend = buildTrend([report(12, 1_000, 10)]);
    expect(trend?.treasury.labels).toEqual(["Dec 1880", "Jan 1881"]);
  });
});
