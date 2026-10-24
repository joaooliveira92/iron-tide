import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { observeScenarios, SCENARIO_CASES, type ObservedScenarios } from "./scenarioCases.js";

const RECORDED = JSON.parse(
  readFileSync(new URL("./fixtures/scenario.legacy.json", import.meta.url), "utf8"),
) as Record<string, ObservedScenarios>;

function rejected(message: string): ObservedScenarios {
  return {
    accepted: false,
    returnsInputValues: undefined,
    diagnostics: [{ code: "INVALID_SCENARIO_DEFINITION", message, stage: "scenario-validation" }],
  };
}

const INTENDED_DEVIATIONS: Readonly<Record<string, ObservedScenarios>> = {
  "null scenarioContentHash": rejected("scen_1920: scenarioContentHash must be a string"),
  "numeric scenarioContentHash": rejected("scen_1920: scenarioContentHash must be a string"),
  "null participationManifestId": rejected("scen_1920: participationManifestId must be a string"),
  "numeric participationManifestId": rejected(
    "scen_1920: participationManifestId must be a string",
  ),
  "null continuityManifestId": rejected("scen_1920: continuityManifestId must be a string"),
  "numeric continuityManifestId": rejected("scen_1920: continuityManifestId must be a string"),
  "excess key": rejected("scen_1920: unknown field surprise"),
};

describe("scenario validation parity with the recorded legacy validator", () => {
  it("covers every recorded case", () => {
    expect(Object.keys(RECORDED)).toEqual(SCENARIO_CASES.map((c) => c.name));
  });

  it("deviates from the recording only where the schema is stricter", () => {
    for (const name of Object.keys(INTENDED_DEVIATIONS)) {
      expect(RECORDED[name]?.accepted).toBe(true);
      expect(INTENDED_DEVIATIONS[name]?.accepted).toBe(false);
    }
  });

  for (const { name, input } of SCENARIO_CASES) {
    it(name, () => {
      expect(observeScenarios(input)).toEqual(INTENDED_DEVIATIONS[name] ?? RECORDED[name]);
    });
  }
});
