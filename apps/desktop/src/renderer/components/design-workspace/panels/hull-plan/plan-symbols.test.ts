import { describe, expect, it } from "vite-plus/test";
import { planSymbolFor, turretRadius } from "./plan-symbols.js";

describe("planSymbolFor", () => {
  it("draws a multi-gun turret with one barrel per gun, capped at four", () => {
    const triple = planSymbolFor({
      kind: "gun",
      category: "MAIN_GUN",
      mountType: "TURRET",
      gunCount: 3,
    });
    expect(triple).toMatchObject({ shape: "gun", mountClass: "TURRET", barrels: 3 });
    const many = planSymbolFor({
      kind: "gun",
      category: "MAIN_GUN",
      mountType: "TURRET",
      gunCount: 9,
    });
    expect(many).toMatchObject({ barrels: 4 });
  });

  it("draws a shielded or open mount with a single barrel whatever its gun count", () => {
    const spec = planSymbolFor({
      kind: "gun",
      category: "SECONDARY_GUN",
      mountType: "DECK_SHIELDED",
      gunCount: 2,
    });
    expect(spec).toMatchObject({ mountClass: "SHIELDED", barrels: 1 });
  });

  it("draws a broadside battery as a casemate", () => {
    const spec = planSymbolFor({
      kind: "gun",
      category: "SECONDARY_GUN",
      mountType: "BROADSIDE_BATTERY",
    });
    expect(spec).toMatchObject({ mountClass: "CASEMATE" });
  });

  it("draws torpedo tubes as tubes, spaces as spaces, and leaves funnels to the topside layer", () => {
    expect(planSymbolFor({ kind: "torpedo" })).toEqual({ shape: "tube" });
    expect(planSymbolFor({ kind: "magazine" })).toEqual({ shape: "space", kind: "magazine" });
    expect(planSymbolFor({ kind: "other" })).toEqual({ shape: "space", kind: "other" });
    expect(planSymbolFor({ kind: "funnel" })).toEqual({ shape: "anchor" });
  });

  it("grows the mount with the calibre and clamps at both ends", () => {
    expect(turretRadius(12 * 25_400)).toBeGreaterThan(turretRadius(3 * 25_400));
    expect(turretRadius(100 * 25_400)).toBe(6.5);
    expect(turretRadius(undefined)).toBe(4);
  });
});
