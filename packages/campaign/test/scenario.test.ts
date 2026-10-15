import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { CANONICAL_SCENARIOS, validateScenarios } from "../src/scenario.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}

describe("scenario: §1 strict", () => {
  it("passes canonical", () => {
    const c = collector();
    expect(validateScenarios(CANONICAL_SCENARIOS, c)).toBeDefined();
    expect(c.hasErrors).toBe(false);
  });
  it("fails when endYear/endMonth not 1970/12", () => {
    const c = collector();
    const bad = JSON.parse(JSON.stringify(CANONICAL_SCENARIOS));
    bad[0].endYear = 1969;
    expect(validateScenarios(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("fails when supportedFleet contains invalid value", () => {
    const c = collector();
    const bad = JSON.parse(JSON.stringify(CANONICAL_SCENARIOS));
    bad[1].supportedFleetSizeSettingIds = ["small", "unknown"];
    expect(validateScenarios(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("fails when supported* not array", () => {
    const c = collector();
    const bad = JSON.parse(JSON.stringify(CANONICAL_SCENARIOS));
    (bad[2] as any).supportedResearchSpeedSettingIds = "slow";
    expect(validateScenarios(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("fails on null entry", () => {
    const c = collector();
    const bad: any = [...CANONICAL_SCENARIOS.slice(0, 4), null];
    expect(validateScenarios(bad, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
});
