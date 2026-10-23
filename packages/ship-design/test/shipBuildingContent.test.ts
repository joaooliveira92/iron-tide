import { describe, it, expect } from "vite-plus/test";
import {
  buildShipBuildingContent,
  compileDesign,
  shipBalanceFromRecord,
  unlockedTechIds,
} from "../src/index.js";
import { checkRevisionBalance } from "../src/revision.js";
import { shipBuildingData, shipBuildingContent } from "./helpers/earlyContext.js";
import { havock } from "./helpers/references.js";

describe("buildShipBuildingContent", () => {
  it("unlocks technology by year", () => {
    const techs = [
      { id: "a", year: 1880 },
      { id: "b", year: 1895 },
    ];
    expect([...unlockedTechIds(techs, "1890-06")]).toEqual(["a"]);
    expect([...unlockedTechIds(techs, "1895-01")].sort()).toEqual(["a", "b"]);
  });
  it("environmentFor is pure and compiles the reference destroyer", () => {
    const a = shipBuildingContent.environmentFor("1895-06");
    const b = shipBuildingContent.environmentFor("1895-06");
    expect(JSON.stringify([...a.ctx.unlockedTechs].sort())).toBe(
      JSON.stringify([...b.ctx.unlockedTechs].sort()),
    );
    expect(compileDesign(havock, a.ctx).valid).toBe(true);
    expect(compileDesign(havock, shipBuildingContent.environmentFor("1885-06").ctx).valid).toBe(
      false,
    );
  });
  it("AI environment needs an ai balance section", () => {
    expect(shipBuildingContent.aiEnvironmentFor("1895-06").archetypes.BALANCED).toBeDefined();
    const noAi = buildShipBuildingContent({
      ...shipBuildingData,
      balance: { ...shipBuildingData.balance, ai: undefined },
    });
    expect(() => noAi.aiEnvironmentFor("1895-06")).toThrow();
  });
  it("ships revision rules that pass the balance checks", () => {
    expect(shipBuildingContent.revision).not.toBeNull();
    expect(checkRevisionBalance(shipBuildingContent.revision!)).toEqual([]);
  });
  it("refuses a pack whose revision balance is invalid, naming the problem", () => {
    const bad = { ...shipBuildingData.balance.revision!, t1DelayMonths: 0, reworkBp: 20_000 };
    expect(() =>
      buildShipBuildingContent({
        ...shipBuildingData,
        balance: { ...shipBuildingData.balance, revision: bad },
      }),
    ).toThrow(/invalid ship-building revision balance:.*t1DelayMonths.*reworkBp/);
  });
  it("accepts a pack with no revision section (revisions are then refused, not crashed)", () => {
    const none = buildShipBuildingContent({
      ...shipBuildingData,
      balance: { ...shipBuildingData.balance, revision: undefined },
    });
    expect(none.revision).toBeNull();
  });
  describe("classification rules by month", () => {
    const shipBalance = shipBalanceFromRecord(shipBuildingData.balance.ship);
    const base = shipBalance.classification!;
    const withEras = (eras: unknown) =>
      buildShipBuildingContent({
        ...shipBuildingData,
        balance: {
          ...shipBuildingData.balance,
          ship: { ...shipBalance, classificationFromMonth: eras },
        },
      });
    const later = { ...base, ddMaxDisplacementKg: 3_000_000, clMinDisplacementKg: 3_000_000 };

    it("keeps the base rules before the first era and switches at its month", () => {
      const content = withEras([{ fromMonth: "1940-01", classification: later }]);
      expect(content.environmentFor("1939-12").ctx.balance.classification).toEqual(base);
      expect(content.environmentFor("1940-01").ctx.balance.classification).toEqual(later);
      expect(content.environmentFor("1970-12").ctx.balance.classification).toEqual(later);
    });

    it("refuses eras that are out of order or repeat a month", () => {
      const entry = (fromMonth: string) => ({ fromMonth, classification: later });
      expect(() => withEras([entry("1950-01"), entry("1940-01")])).toThrow(
        /classificationFromMonth/,
      );
      expect(() => withEras([entry("1940-01"), entry("1940-01")])).toThrow(
        /classificationFromMonth/,
      );
    });

    it("refuses an era whose rules are incomplete", () => {
      expect(() =>
        withEras([{ fromMonth: "1940-01", classification: { rulesetVersion: 2 } }]),
      ).toThrow(/classificationFromMonth/);
    });
  });
});
