import { describe, it, expect } from "vite-plus/test";
import { NavalProfileCatalogueSchema, decodeStrict } from "@bluewave/content-schema";
import { compileDesign } from "../src/index.js";
import { armamentAmmunitionFor } from "../src/armamentAmmunition.js";
import {
  components,
  earlyContext,
  hullRecords,
  readNavalProfileEntries,
  readReferenceDesignEntries,
} from "./helpers/earlyContext.js";
import { armamentContent } from "./helpers/armamentContext.js";
import { renderExplanation } from "./helpers/explanation.js";

const designs = readReferenceDesignEntries();
const tiger = designs.find((d) => d.id === "tiger_class_cl_1959");
const profiles = decodeStrict(NavalProfileCatalogueSchema, {
  navalProfiles: readNavalProfileEntries(),
}).navalProfiles;

describe("the 1959 UK Tiger light cruiser (issue #869)", () => {
  it("is authored as a UK light cruiser starter dated 1959-01", () => {
    expect(tiger).toBeDefined();
    expect(tiger?.draft.nationId).toBe("uk");
    expect(tiger?.starterFor).toBe("CL");
    expect(tiger?.month).toBe("1959-01");
  });

  it("uses its own postwar_light_cruiser_form and sits inside its length and L/B bands", () => {
    const hull = tiger?.draft.hull;
    expect(hull?.hullFormId).toBe("postwar_light_cruiser_form");
    expect(hull?.beam).toBe(19500);
    expect(hull?.draught).toBe(7000);
    const form = hullRecords.find((h) => h.id === "postwar_light_cruiser_form");
    expect(form).toBeDefined();
    const lbX100 = Math.round(((hull?.lengthWl ?? 0) * 100) / (hull?.beam ?? 1));
    expect(hull?.lengthWl).toBeGreaterThanOrEqual(form?.lengthMinMm ?? Infinity);
    expect(hull?.lengthWl).toBeLessThanOrEqual(form?.lengthMaxMm ?? 0);
    expect(lbX100).toBeGreaterThanOrEqual(form?.lbMinX100 ?? Infinity);
    expect(lbX100).toBeLessThanOrEqual(form?.lbMaxX100 ?? 0);
  });

  it("leaves the shared light_cruiser_form band unchanged", () => {
    const form = hullRecords.find((h) => h.id === "light_cruiser_form");
    expect(form?.lengthMinMm).toBe(190000);
    expect(form?.lengthMaxMm).toBe(210000);
    expect(form?.lbMinX100).toBe(900);
    expect(form?.lbMaxX100).toBe(980);
  });

  it("validates with no blocking finding and classifies as a light cruiser", () => {
    const r = compileDesign(tiger!.draft, earlyContext("1959-01"));
    const blocking = r.findings.filter(
      (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
    );
    expect(blocking.map((f) => `${f.id}: ${renderExplanation(f.what)}`)).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("CL");
  });

  it("closes on the sourced 11,700 t full-load displacement and reaches the sourced speed", () => {
    const r = compileDesign(tiger!.draft, earlyContext("1959-01"));
    expect(Math.abs(r.totalKg - 11_700_000)).toBeLessThan(120_000);
    expect(r.machinery?.maxSpeedMilliKnots).toBeGreaterThanOrEqual(31_500);
  });

  it("carries two twin 6-inch mounts and no torpedo tubes", () => {
    const guns = tiger?.draft.placements.filter((p) => p.componentId === "gun_qf_6in_50_twin");
    expect(guns).toHaveLength(2);
    expect(guns?.every((p) => p.params?.barrels === 2)).toBe(true);
    expect(
      tiger?.draft.placements.some((p) => p.componentId.startsWith("tube_")),
      "no tubes",
    ).toBe(false);
  });

  it("is not available before the 6-inch/50 twin mount", () => {
    const r = compileDesign(tiger!.draft, earlyContext("1958-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });

  it("opens the UK profile, and only the UK profile, to the postwar light cruiser form", () => {
    const uk = profiles.find((p) => p.nationId === "uk");
    expect(uk?.hardCapabilities.hullForms).toContain("postwar_light_cruiser_form");
    expect(uk?.hardCapabilities.hullForms).toContain("postwar_destroyer_form");
    for (const p of profiles.filter((q) => q.nationId !== "uk"))
      expect(p.hardCapabilities.hullForms).not.toContain("postwar_light_cruiser_form");
  });
});

describe("per-era ammunition for the 6-inch/50 (issue #869, builds on #856)", () => {
  const families = new Set(armamentContent.gunFamilies.map((f) => String(f.id)));
  const withoutTiger = {
    ...armamentContent,
    ammunition: armamentContent.ammunition.filter((a) => String(a.id) !== "uk_ap_6in_50"),
  };

  it("resolves the Tiger family to its own 1959 pattern from its introduction month", () => {
    expect(families.has("gun_qf_6in_50_twin")).toBe(true);
    const pattern = armamentAmmunitionFor(armamentContent, "uk", "gun_qf_6in_50_twin", "1959-06");
    expect(String(pattern?.id)).toBe("uk_ap_6in_50");
    expect(pattern?.shellMassG).toBe(58900);
    expect(pattern?.introductionMonth).toBe("1959-01");
  });

  it("keeps the 4.5-inch/45 Daring family on its own pattern", () => {
    const pattern = armamentAmmunitionFor(armamentContent, "uk", "gun_qf_45in_45_twin", "1955-06");
    expect(String(pattern?.id)).toBe("uk_he_45in_45");
  });

  it("moves no other design's resolved ammunition pattern, in any month or nation", () => {
    const moved: string[] = [];
    for (const d of designs.filter((x) => x.id !== "tiger_class_cl_1959")) {
      for (const p of d.draft.placements) {
        if (!families.has(p.componentId)) continue;
        for (const month of [d.month, "1885-06", "1899-06", "1952-06", "1960-06"]) {
          const after = armamentAmmunitionFor(
            armamentContent,
            d.draft.nationId,
            p.componentId,
            month,
          );
          const before = armamentAmmunitionFor(
            withoutTiger,
            d.draft.nationId,
            p.componentId,
            month,
          );
          if (String(after?.id) !== String(before?.id))
            moved.push(`${d.id}/${p.instanceId}@${month}`);
        }
      }
    }
    expect(moved).toEqual([]);
  });

  it("leaves no existing starter's compile result moved", () => {
    const usCl = designs.find((d) => d.id === "starter_cl_usa_1948")!;
    const r = compileDesign(usCl.draft, earlyContext(usCl.month));
    expect(r.totalKg).toBe(17_998_438);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("CL");
    expect(r.findings.map((f) => f.id).sort()).toEqual([
      "FIRE_CONTROL_NO_POSITIONS",
      "STABILITY_STIFF",
    ]);
    const known = components.find((c) => c.id === "gun_qf_6in_50_twin");
    expect(known?.introduction.fromMonth).toBe("1959-01");
  });
});
