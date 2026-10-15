import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { advanceMonth, assertCanAdvance, fromLinear, isAtEnd, toLinear } from "../src/timeline.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}

describe("timeline: §2 integer arithmetic + exact 1 month", () => {
  it("toLinear/fromLinear round-trip", () => {
    expect(toLinear(1970, 12)).toBe(1970 * 12 + 11);
    expect(fromLinear(toLinear(1970, 12))).toEqual({ year: 1970, month: 12 });
  });
  it("advanceMonth uses integer arithmetic", () => {
    expect(advanceMonth(1970, 11, 1)).toEqual({ year: 1970, month: 12 });
    expect(advanceMonth(1970, 12, 1)).toEqual({ year: 1971, month: 1 });
  });
  it("rejects delta !=1 within the timeline", () => {
    const c = collector();
    expect(assertCanAdvance(1965, 1, 1965, 3, c)).toBe(false);
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("rejects Jan 1971 with SIMULATION_END_REACHED", () => {
    const c = collector();
    expect(assertCanAdvance(1970, 12, 1971, 1, c)).toBe(false);
    expect(hasCode(c, "SIMULATION_END_REACHED")).toBe(true);
    expect(isAtEnd(1970, 12)).toBe(true);
  });
  it("allows Nov->Dec", () => {
    const c = collector();
    expect(assertCanAdvance(1970, 11, 1970, 12, c)).toBe(true);
    expect(c.hasErrors).toBe(false);
  });
});
