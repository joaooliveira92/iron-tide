import { describe, it, expect } from "vite-plus/test";
import {
  buildShipBuildingContent,
  checkRevisionBalance,
  unlockedTechIds,
  compileDesign,
} from "../src/index.js";
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
});
