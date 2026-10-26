import { describe, expect, it } from "vite-plus/test";
import { CATEGORY_PLACE } from "./design-sections.js";

describe("E-1 designer tabs", () => {
  it("puts radar and sonar in the systems sensor tab", () => {
    expect(CATEGORY_PLACE.RADAR).toEqual({ section: "systems", tab: "sensors" });
    expect(CATEGORY_PLACE.SONAR).toEqual({ section: "systems", tab: "sensors" });
  });

  it("puts AA and ASW weapons in the armament other tab", () => {
    expect(CATEGORY_PLACE.AA_WEAPON).toEqual({ section: "armament", tab: "other" });
    expect(CATEGORY_PLACE.ASW_WEAPON).toEqual({ section: "armament", tab: "other" });
    expect(CATEGORY_PLACE.MISSILE_LAUNCHER).toEqual({ section: "armament", tab: "other" });
  });

  it("puts hangars in the systems aviation tab", () => {
    expect(CATEGORY_PLACE.AIRCRAFT_FACILITY).toEqual({ section: "systems", tab: "aviation" });
  });
});
