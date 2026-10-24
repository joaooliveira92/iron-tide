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

describe("campaign configuration parity with the recorded legacy validator", () => {
  it("covers every recorded case", () => {
    expect(Object.keys(RECORDED.validate)).toEqual(VALIDATE_CASES.map((c) => c.name));
    expect(Object.keys(RECORDED.immutability)).toEqual(IMMUTABILITY_CASES.map((c) => c.name));
    expect(Object.keys(RECORDED.hash)).toEqual(HASH_CASES.map((c) => c.name));
  });

  describe("validateCampaignConfiguration", () => {
    for (const { name, input } of VALIDATE_CASES) {
      it(name, () => {
        expect(observeValidate(input)).toEqual(RECORDED.validate[name]);
      });
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
