import { describe, it, expect } from "vite-plus/test";
import { NavalProfileCatalogueSchema, decodeStrict } from "@bluewave/content-schema";
import { compileDesign } from "../src/index.js";
import {
  earlyContext,
  readNavalProfileEntries,
  readReferenceDesignEntries,
} from "./helpers/earlyContext.js";
import { renderExplanation } from "./helpers/explanation.js";

const kotlin = readReferenceDesignEntries().find((d) => d.id === "kotlin_class_dd_1954");

describe("the 1954 Soviet Kotlin destroyer (issue #851)", () => {
  it("is authored as a Russian destroyer starter dated 1954-01", () => {
    expect(kotlin).toBeDefined();
    expect(kotlin?.draft.nationId).toBe("russia");
    expect(kotlin?.starterFor).toBe("DD");
    expect(kotlin?.month).toBe("1954-01");
  });

  it("uses the shared destroyer_form unchanged and sits inside its length and L/B bands", () => {
    const hull = kotlin?.draft.hull;
    expect(hull?.hullFormId).toBe("destroyer_form");
    expect(hull?.lengthWl).toBe(108200);
    expect(hull?.beam).toBe(11800);
    const lbX100 = Math.round(((hull?.lengthWl ?? 0) * 100) / (hull?.beam ?? 1));
    expect(lbX100).toBeGreaterThanOrEqual(850);
    expect(lbX100).toBeLessThanOrEqual(1000);
  });

  it("validates with no blocking finding and classifies as a destroyer", () => {
    const r = compileDesign(kotlin!.draft, earlyContext("1954-01"));
    const blocking = r.findings.filter(
      (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
    );
    expect(blocking.map((f) => `${f.id}: ${renderExplanation(f.what)}`)).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("DD");
  });

  it("closes on the sourced 3,250 t full-load displacement and reaches the sourced speed", () => {
    const r = compileDesign(kotlin!.draft, earlyContext("1954-01"));
    expect(Math.abs(r.totalKg - 3_250_000)).toBeLessThan(50_000);
    expect(r.machinery?.maxSpeedMilliKnots).toBeGreaterThanOrEqual(36_500);
  });

  it("is not available before the 130 mm/50 twin mount", () => {
    const r = compileDesign(kotlin!.draft, earlyContext("1953-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });

  it("opens the Russia profile to the destroyer form, the geared turbine and the 533 mm tube", () => {
    const { navalProfiles } = decodeStrict(NavalProfileCatalogueSchema, {
      navalProfiles: readNavalProfileEntries(),
    });
    const profile = navalProfiles.find((p) => p.nationId === "russia");
    expect(profile?.hardCapabilities.hullForms).toContain("destroyer_form");
    expect(profile?.hardCapabilities.domesticPlants).toContain("hp_steam_geared_turbine");
    expect(profile?.componentAccess["tube_21in_above_water"]?.status).toBe("DOMESTIC");
    expect(profile?.componentAccess["gun_130mm_50_twin"]?.status).not.toBe("UNAVAILABLE");
  });
});
