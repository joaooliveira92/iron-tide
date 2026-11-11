import { gunQualityLevelFor } from "@bluewave/combat/battleResolution";
import { describe, expect, it } from "vite-plus/test";
import { gunQualityRulesForBattle } from "../src/battleGunQuality.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const PLAYABLE = [
  "uk",
  "france",
  "germany",
  "italy",
  "austria_hungary",
  "russia",
  "spain",
  "qing",
  "japan",
  "usa",
];

describe("gunQualityRulesForBattle over the production 1880 content", () => {
  it("is undefined without ship-building content", () => {
    expect(gunQualityRulesForBattle(undefined, ["uk", "france"], "1880-01")).toBeUndefined();
  });

  it("the compiled naval profile reaches runtime with its authored gunQuality bands", () => {
    for (const nationId of PLAYABLE) {
      const bands = content.navalProfileFor(nationId, "1880-01")?.gunQuality?.bands;
      expect(bands?.length, nationId).toBe(3);
    }
  });

  it("maps each nation and caliber band to its authored level", () => {
    const rules = gunQualityRulesForBattle(content, ["uk", "usa"], "1880-01");
    expect(gunQualityLevelFor(rules, "uk", 120_000)).toBe(1);
    expect(gunQualityLevelFor(rules, "uk", 343_000)).toBe(0);
    expect(gunQualityLevelFor(rules, "usa", 203_000)).toBe(-2);
    expect(gunQualityLevelFor(rules, "france", 120_000)).toBe(0);
  });
});
