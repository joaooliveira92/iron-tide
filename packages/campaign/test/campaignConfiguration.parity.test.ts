import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  HASH_CASES,
  IMMUTABILITY_CASES,
  observeHash,
  observeImmutability,
  observeValidate,
  VALIDATE_CASES,
  type Observed,
} from "./campaignConfigurationCases.js";

interface Recorded {
  readonly validate: Record<string, Observed>;
  readonly immutability: Record<string, Observed>;
  readonly hash: Record<string, string>;
}

const RECORDED = JSON.parse(
  readFileSync(new URL("./fixtures/campaignConfiguration.legacy.json", import.meta.url), "utf8"),
) as Recorded;

function rejected(message: string): Observed {
  return {
    accepted: false,
    diagnostics: [
      { code: "INVALID_CAMPAIGN_CONFIGURATION", message, stage: "campaign-configuration" },
    ],
  };
}

const INTENDED_DEVIATIONS: Readonly<Record<string, Observed>> = {
  "excess key": rejected("Unknown field surprise"),
  "number for playerSlotId": rejected("Invalid playerSlotId 5"),
  "number for archetype": rejected("Invalid archetype 5"),
};

describe("campaign configuration parity with the recorded legacy validator", () => {
  it("covers every recorded case", () => {
    expect(Object.keys(RECORDED.validate)).toEqual(VALIDATE_CASES.map((c) => c.name));
    expect(Object.keys(RECORDED.immutability)).toEqual(IMMUTABILITY_CASES.map((c) => c.name));
    expect(Object.keys(RECORDED.hash)).toEqual(HASH_CASES.map((c) => c.name));
  });

  describe("validateCampaignConfiguration", () => {
    for (const { name, input } of VALIDATE_CASES) {
      it(name, () => {
        expect(observeValidate(input)).toEqual(
          INTENDED_DEVIATIONS[name] ?? RECORDED.validate[name],
        );
      });
    }
  });

  it("deviates from the recording only where the schema is stricter", () => {
    for (const name of Object.keys(INTENDED_DEVIATIONS)) {
      expect(RECORDED.validate[name]?.accepted).toBe(true);
      expect(INTENDED_DEVIATIONS[name]?.accepted).toBe(false);
    }
  });

  describe("assertConfigurationImmutability", () => {
    for (const { name, input } of IMMUTABILITY_CASES) {
      it(name, () => {
        expect(observeImmutability(input)).toEqual(RECORDED.immutability[name]);
      });
    }
  });

  describe("hashConfiguration", () => {
    for (const { name, input } of HASH_CASES) {
      it(name, () => {
        expect(observeHash(input)).toBe(RECORDED.hash[name]);
      });
    }
  });
});
