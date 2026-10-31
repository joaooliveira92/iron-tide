import { describe, expect, it } from "vite-plus/test";
import {
  GOVERNMENT_TYPES,
  GovernmentTypeSchema,
  NATION_TRAIT_IDS,
  NationSchema,
  NationTraitSchema,
} from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";
import { fixtureNations } from "./nation-fixtures.js";

describe("government type", () => {
  it("is a closed six-value enum", () => {
    expect([...GOVERNMENT_TYPES]).toEqual([
      "liberal_democracy",
      "limited_democracy",
      "autocratic",
      "fascist",
      "communist",
      "eastern",
    ]);
    for (const value of GOVERNMENT_TYPES) {
      expect(decodeOk(GovernmentTypeSchema, value)).toBe(true);
    }
    expect(decodeOk(GovernmentTypeSchema, "monarchy")).toBe(false);
  });

  it("is required on every nation regime", () => {
    const [nation] = fixtureNations();
    const { governmentType: _removed, ...regime } = nation!.regime;
    expect(decodeOk(NationSchema, { ...nation, regime })).toBe(false);
    expect(decodeIssue(NationSchema, { ...nation, regime })).toContain("governmentType");
  });
});

describe("national traits", () => {
  it("covers every trait the manual lists on pp.59-60", () => {
    expect([...NATION_TRAIT_IDS]).toEqual([
      "efficient_shipbuilding",
      "undeveloped_shipbuilding",
      "global_naval_power",
      "cautious",
      "poor_education",
      "surprise_attack",
      "inconsistent_naval_policy",
      "attention_to_detail",
      "technology_leader",
      "hidden_faults",
      "kamikaze",
    ]);
    for (const value of NATION_TRAIT_IDS) {
      expect(decodeOk(NationTraitSchema, value)).toBe(true);
    }
    expect(decodeOk(NationTraitSchema, "reckless")).toBe(false);
  });

  it("are required and closed on every nation", () => {
    const [nation] = fixtureNations();
    const { traits: _removed, ...withoutTraits } = nation!;
    expect(decodeOk(NationSchema, withoutTraits)).toBe(false);
    expect(decodeOk(NationSchema, { ...nation, traits: ["cautious", "cautious"] })).toBe(false);
    expect(decodeOk(NationSchema, { ...nation, traits: ["reckless"] })).toBe(false);
    expect(decodeOk(NationSchema, { ...nation, traits: ["cautious"] })).toBe(true);
  });
});
