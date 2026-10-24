import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { observeScenarios, SCENARIO_CASES, type ObservedScenarios } from "./scenarioCases.js";

const RECORDED = JSON.parse(
  readFileSync(new URL("./fixtures/scenario.legacy.json", import.meta.url), "utf8"),
) as Record<string, ObservedScenarios>;

describe("scenario validation parity with the recorded legacy validator", () => {
  it("covers every recorded case", () => {
    expect(Object.keys(RECORDED)).toEqual(SCENARIO_CASES.map((c) => c.name));
  });

  for (const { name, input } of SCENARIO_CASES) {
    it(name, () => {
      expect(observeScenarios(input)).toEqual(RECORDED[name]);
    });
  }
});
