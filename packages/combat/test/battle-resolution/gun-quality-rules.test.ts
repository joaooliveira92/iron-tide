import { describe, expect, it } from "vite-plus/test";
import {
  gunQualityLevelFor,
  gunQualityRateFactors,
  gunQualityRulesFor,
  projectBattle,
  type GunQualityRules,
} from "@bluewave/combat/battleResolution";
import { computeEffectiveReloadMs, neutralRateFactors } from "@bluewave/combat/gunnery";
import {
  ATTACKER_NATION,
  AREA_ID,
  CAMPAIGN_MONTH,
  DEFENDER_NATION,
  makeNations,
  makeProjectionManifest,
} from "./fixtures.js";

const LIGHT = { minCaliberUm: 1, maxCaliberUm: 152_000, quality: 1 };
const MEDIUM = { minCaliberUm: 152_000, maxCaliberUm: 254_000, quality: -1 };
const HEAVY = { minCaliberUm: 254_000, maxCaliberUm: 1_000_000, quality: 2 };

const RULES: GunQualityRules = {
  bandsByNation: { [ATTACKER_NATION]: [LIGHT, MEDIUM, HEAVY] },
};

const BASE_RELOAD_MS = 1_000;
const reloadOf = (rateFactors: ReturnType<typeof neutralRateFactors>): number =>
  computeEffectiveReloadMs(BASE_RELOAD_MS, rateFactors).effectiveReloadMs;

describe("gun quality lookup: nation and caliber to level to table factor", () => {
  it("picks the band by half-open caliber range", () => {
    expect(gunQualityLevelFor(RULES, ATTACKER_NATION, 151_999)).toBe(1);
    expect(gunQualityLevelFor(RULES, ATTACKER_NATION, 152_000)).toBe(-1);
    expect(gunQualityLevelFor(RULES, ATTACKER_NATION, 253_999)).toBe(-1);
    expect(gunQualityLevelFor(RULES, ATTACKER_NATION, 254_000)).toBe(2);
  });

  it("is neutral for an unknown nation, a missing rule set and an uncovered caliber", () => {
    expect(gunQualityLevelFor(RULES, DEFENDER_NATION, 343_000)).toBe(0);
    expect(gunQualityLevelFor(undefined, ATTACKER_NATION, 343_000)).toBe(0);
    expect(gunQualityLevelFor(RULES, ATTACKER_NATION, 1_000_000)).toBe(0);
  });

  it("looks up each caliber band on its own", () => {
    const light = gunQualityRateFactors(RULES, ATTACKER_NATION, 120_000);
    const medium = gunQualityRateFactors(RULES, ATTACKER_NATION, 203_000);
    const heavy = gunQualityRateFactors(RULES, ATTACKER_NATION, 343_000);
    expect(reloadOf(light)).toBe(950);
    expect(reloadOf(medium)).toBe(1_050);
    expect(reloadOf(heavy)).toBe(900);
  });

  it("leaves the factors identical to neutral at level 0 so neutral hashes cannot move", () => {
    const zero: GunQualityRules = {
      bandsByNation: { [ATTACKER_NATION]: [{ ...HEAVY, quality: 0 }] },
    };
    expect(gunQualityRateFactors(zero, ATTACKER_NATION, 343_000)).toEqual(neutralRateFactors());
    expect(gunQualityRateFactors(zero, ATTACKER_NATION, 343_000).gunQuality).toBe(10_000);
    expect(gunQualityRateFactors(undefined, ATTACKER_NATION, 343_000)).toEqual(
      neutralRateFactors(),
    );
    expect(gunQualityRateFactors(RULES, DEFENDER_NATION, 343_000)).toEqual(neutralRateFactors());
  });
});

describe("gunQualityRulesFor: profile source to rules", () => {
  const profiles = {
    [ATTACKER_NATION]: { gunQuality: { bands: [{ ...HEAVY, id: "heavy" }] } },
    [DEFENDER_NATION]: {},
  };
  const profileFor = (nationId: string) => profiles[nationId as keyof typeof profiles] ?? null;

  it("keeps only nations that author bands, stripped to the lookup fields", () => {
    const rules = gunQualityRulesFor(
      [DEFENDER_NATION, ATTACKER_NATION, "n-none"],
      profileFor,
      "1880-01",
    );
    expect(Object.keys(rules.bandsByNation)).toEqual([ATTACKER_NATION]);
    expect(rules.bandsByNation[ATTACKER_NATION]).toEqual([HEAVY]);
  });

  it("resolves the profile for the requested month", () => {
    const months: string[] = [];
    gunQualityRulesFor(
      [ATTACKER_NATION],
      (_nation, month) => {
        months.push(month);
        return null;
      },
      "1885-07",
    );
    expect(months).toEqual(["1885-07"]);
  });
});

describe("projectBattle feeds the nation's own caliber band to each battery", () => {
  const nations = makeNations();
  const manifest = () => makeProjectionManifest(["a1", "a2", "d1", "d2"]);
  const project = (gunQuality?: GunQualityRules) =>
    projectBattle({
      manifest: manifest(),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: "b6_ruleset_v1",
      ...(gunQuality === undefined ? {} : { gunQuality }),
    });

  it("without rules every battery keeps the neutral factors", () => {
    for (const battery of project().batteries) {
      expect(battery.rateFactors).toEqual(neutralRateFactors());
    }
  });

  it("a +2 attacker reloads faster than a neutral defender", () => {
    const out = project(RULES);
    const attacker = out.batteries.filter((b) => b.sideId === "ATTACKER");
    const defender = out.batteries.filter((b) => b.sideId === "DEFENDER");
    expect(attacker.length).toBeGreaterThan(0);
    expect(defender.length).toBeGreaterThan(0);
    for (const battery of attacker) {
      expect(reloadOf(battery.rateFactors)).toBe(900);
    }
    for (const battery of defender) {
      expect(battery.rateFactors).toEqual(neutralRateFactors());
    }
  });

  it("a -3 defender reloads slower and a different caliber band changes the factor", () => {
    const rules: GunQualityRules = {
      bandsByNation: { [DEFENDER_NATION]: [{ ...HEAVY, quality: -3 }] },
    };
    const out = project(rules);
    for (const battery of out.batteries.filter((b) => b.sideId === "DEFENDER")) {
      expect(reloadOf(battery.rateFactors)).toBe(1_150);
    }

    const lightOnly: GunQualityRules = {
      bandsByNation: { [DEFENDER_NATION]: [{ ...LIGHT, quality: -3 }] },
    };
    for (const battery of project(lightOnly).batteries) {
      expect(battery.rateFactors).toEqual(neutralRateFactors());
    }
  });
});
