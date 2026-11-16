import { describe, it, expect } from "vite-plus/test";
import { NavalProfileCatalogueSchema, decodeStrict } from "@bluewave/content-schema";
import { compileDesign } from "../src/index.js";
import {
  earlyContext,
  readNavalProfileEntries,
  readReferenceDesignEntries,
} from "./helpers/earlyContext.js";
import { renderExplanation } from "./helpers/explanation.js";

const designs = readReferenceDesignEntries();
const soldati = designs.find((d) => d.id === "soldati_class_dd_1942");

describe("the 1942 Italian Soldati-class destroyer, Mitragliere group (issue #249)", () => {
  it("is authored as an Italian destroyer starter dated 1942-02", () => {
    expect(soldati).toBeDefined();
    expect(soldati?.draft.nationId).toBe("italy");
    expect(soldati?.starterFor).toBe("DD");
    expect(soldati?.month).toBe("1942-02");
  });

  it("uses the shared destroyer_form unchanged and sits inside its length and L/B bands", () => {
    const hull = soldati?.draft.hull;
    expect(hull?.hullFormId).toBe("destroyer_form");
    expect(hull?.lengthWl).toBe(101600);
    expect(hull?.beam).toBe(10200);
    const lbX100 = Math.floor(((hull?.lengthWl ?? 0) * 100) / (hull?.beam ?? 1));
    expect(lbX100).toBeGreaterThanOrEqual(850);
    expect(lbX100).toBeLessThanOrEqual(1000);
  });

  it("validates with no blocking finding and classifies as a destroyer", () => {
    const r = compileDesign(soldati!.draft, earlyContext("1942-02"));
    const blocking = r.findings.filter(
      (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
    );
    expect(blocking.map((f) => `${f.id}: ${renderExplanation(f.what)}`)).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("DD");
  });

  it("closes on the sourced 2,460 t full-load displacement and reaches 34 knots", () => {
    const r = compileDesign(soldati!.draft, earlyContext("1942-02"));
    expect(Math.abs(r.totalKg - 2_460_000)).toBeLessThan(50_000);
    expect(r.machinery?.maxSpeedMilliKnots).toBeGreaterThanOrEqual(34_000);
  });

  it("is not available before the 1940 single mount", () => {
    const r = compileDesign(soldati!.draft, earlyContext("1939-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });

  it("opens the Italy profile to the destroyer form, the geared turbine and the 533 mm tube", () => {
    const { navalProfiles } = decodeStrict(NavalProfileCatalogueSchema, {
      navalProfiles: readNavalProfileEntries(),
    });
    const profile = navalProfiles.find((p) => p.nationId === "italy");
    expect(profile?.hardCapabilities.hullForms).toContain("destroyer_form");
    expect(profile?.hardCapabilities.domesticPlants).toContain("hp_steam_geared_turbine");
    expect(profile?.componentAccess["tube_21in_above_water"]?.status).toBe("DOMESTIC");
    expect(profile?.componentAccess["gun_120mm_50_twin"]?.status).not.toBe("UNAVAILABLE");
    expect(profile?.componentAccess["gun_120mm_50_single"]?.status).not.toBe("UNAVAILABLE");
  });

  it("leaves every earlier Italian starter valid and off the new gun families", () => {
    const earlier = designs.filter(
      (d) => d.draft.nationId === "italy" && d.id !== "soldati_class_dd_1942",
    );
    expect(earlier.length).toBeGreaterThan(0);
    for (const d of earlier) {
      const r = compileDesign(d.draft, earlyContext(d.month));
      const bad = r.findings.filter(
        (f) =>
          f.severity === "BLOCKING" ||
          f.severity === "CRITICAL" ||
          f.id.startsWith("ARMAMENT_AMMUNITION"),
      );
      expect(bad.map((f) => `${d.id} ${f.id}`)).toEqual([]);
      const guns = d.draft.placements.map((p) => p.componentId);
      expect(guns).not.toContain("gun_120mm_50_twin");
      expect(guns).not.toContain("gun_120mm_50_single");
    }
  });
});
