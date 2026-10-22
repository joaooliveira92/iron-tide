import { describe, expect, it } from "vite-plus/test";
import {
  compileDesign,
  resolveConstructionModifiers,
  resolveNavalProfile,
  starterFor,
  validateDraftShape,
  type DesignDraft,
  type StarterDesign,
} from "../src/index.js";
import {
  components,
  navalProfiles,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";
import { armamentContent } from "./helpers/armamentContext.js";
import {
  FOREIGN_BUILT_B_STARTERS,
  HISTORICAL_B_STARTERS,
  REFERENCE_DESIGN_CLASSIFICATIONS,
} from "./helpers/referenceClassifications.js";

const OPENING_MONTH = "1880-01";
const OPENING_TYPES = ["B", "CA", "CL", "DD", "KE", "AMC"] as const;

const designs = readReferenceDesignEntries() as {
  id: string;
  name: string;
  month: string;
  starterFor?: string;
  draft: DesignDraft;
}[];
const byId = (id: string) => designs.find((d) => d.id === id)!;
const starters = designs.filter((d): d is StarterDesign => d.starterFor !== undefined);
const uk = designs.find((d) => d.id === "alexandra_1877")!;

const CONVERTED = Object.entries(HISTORICAL_B_STARTERS);

const mechanicalFingerprint = (draft: DesignDraft): string =>
  JSON.stringify({
    hullFormId: draft.hull.hullFormId,
    materialId: draft.hull.materialId,
    structuralSchemeId: draft.hull.structuralSchemeId,
    lengthWl: draft.hull.lengthWl,
    beam: draft.hull.beam,
    draught: draft.hull.draught,
    depthToMainDeck: draft.hull.depthToMainDeck,
    targetDisplacementKg: draft.hull.targetDisplacementKg,
    plantId: draft.machinery.plantId,
    installedKw: draft.machinery.installedKw,
    speedMilliKnots: draft.requirement.requiredSpeedMilliKnots,
    armour: draft.armour.regions.map((r) => `${r.region}:${r.materialId}:${r.thicknessUm}`).sort(),
    guns: draft.placements
      .filter((p) => p.componentId.startsWith("gun_"))
      .map((p) => `${p.componentId}:${p.params?.barrels ?? 0}`)
      .sort(),
  });

describe("promoted historical national starters", () => {
  it.each(CONVERTED)("%s begins with %s as its capital starter", (nation, id) => {
    const chosen = starterFor("B", starters, OPENING_MONTH, nation);
    expect(chosen?.id).toBe(id);
    expect(chosen?.draft.nationId).toBe(nation);
    expect(byId(id).starterFor).toBe("B");
  });

  it.each(CONVERTED)("%s: %s is classified HISTORICAL_RECONSTRUCTION", (_nation, id) => {
    expect(REFERENCE_DESIGN_CLASSIFICATIONS[id]).toBe("HISTORICAL_RECONSTRUCTION");
  });

  it("the cloned British capital starters were removed, not merely hidden", () => {
    for (const id of [
      "starter_b_italy_1880",
      "starter_b_russia_1880",
      "starter_b_ottoman_empire_1880",
      "starter_b_usa_1880",
      "starter_b_netherlands_1880",
      "starter_b_portugal_1880",
      "starter_b_brazil_1880",
      "starter_b_japan_1880",
      "starter_b_spain_1880",
      "starter_b_austria_hungary_1880",
    ])
      expect(designs.find((d) => d.id === id)).toBeUndefined();
  });

  it("leaves the still-deferred candidates on their doctrine template (no false substitution)", () => {
    for (const nation of ["qing"]) {
      const chosen = starterFor("B", starters, OPENING_MONTH, nation);
      expect(chosen, `${nation} B starter`).not.toBeNull();
      expect(chosen!.id.startsWith("starter_b_")).toBe(true);
      expect(REFERENCE_DESIGN_CLASSIFICATIONS[chosen!.id]).toBe("DOCTRINE_TEMPLATE");
      expect(HISTORICAL_B_STARTERS[nation]).toBeUndefined();
    }
  });

  it("never sets an import ceiling below the domestic one (it widens, never restricts)", () => {
    for (const profile of navalProfiles) {
      const caps = profile.hardCapabilities;
      if (caps.maxImportedGunCaliberUm !== undefined)
        expect(caps.maxImportedGunCaliberUm).toBeGreaterThanOrEqual(caps.maxGunCaliberUm);
    }
  });

  it.each(CONVERTED)(
    "%s: %s validates as a production draft and compiles legal as a capital ship",
    (nation, id) => {
      const draft = byId(id).draft;
      expect(validateDraftShape(JSON.parse(JSON.stringify(draft)))).toEqual([]);
      const { ctx } = shipBuildingContent.environmentFor(OPENING_MONTH, nation);
      const r = compileDesign(draft, ctx);
      expect(
        r.findings.filter((f) => f.severity === "BLOCKING" || f.severity === "CRITICAL"),
      ).toEqual([]);
      expect(r.valid).toBe(true);
      expect(r.naturalClass).toBe("B");
    },
  );

  it.each(CONVERTED)(
    "%s: %s does not exceed the nation's gun/armour/displacement ceilings",
    (nation, id) => {
      const profile = resolveNavalProfile(navalProfiles, nation, OPENING_MONTH)!;
      const caps = profile.hardCapabilities;
      const importCeiling = caps.maxImportedGunCaliberUm ?? caps.maxGunCaliberUm;
      const construction = resolveConstructionModifiers(profile, OPENING_MONTH);
      const draft = byId(id).draft;
      if (!FOREIGN_BUILT_B_STARTERS.has(id))
        expect(draft.hull.targetDisplacementKg).toBeLessThanOrEqual(
          construction.maxPracticalDisplacementKg,
        );
      for (const region of draft.armour.regions)
        expect(region.thicknessUm).toBeLessThanOrEqual(caps.maxArmourThicknessUm);
      const { ctx } = shipBuildingContent.environmentFor(OPENING_MONTH, nation);
      const r = compileDesign(draft, ctx);
      for (const c of r.components) {
        const caliber = c.attr.caliberUm;
        if (caliber === undefined) continue;
        const status = profile.componentAccess[c.componentId]?.status ?? "DOMESTIC";
        const ceiling = status === "DOMESTIC" ? caps.maxGunCaliberUm : importCeiling;
        expect(caliber).toBeLessThanOrEqual(ceiling);
      }
    },
  );

  it.each(CONVERTED)("%s: %s uses no equipment the nation cannot obtain", (nation, id) => {
    const profile = resolveNavalProfile(navalProfiles, nation, OPENING_MONTH)!;
    for (const placement of byId(id).draft.placements)
      expect(profile.componentAccess[placement.componentId]?.status).not.toBe("UNAVAILABLE");
  });

  it.each([
    ["italy", "gun_rml_11in_25ton", "IMPORTED"],
    ["italy", "gun_rml_10in_18ton_broadside", "IMPORTED"],
    ["ottoman_empire", "gun_rml_10in_18ton", "IMPORTED"],
    ["ottoman_empire", "gun_rml_7in_7ton", "IMPORTED"],
    ["russia", "gun_rml_12in_25ton", "DOMESTIC"],
    ["netherlands", "gun_bl_283mm_krupp", "IMPORTED"],
    ["portugal", "gun_bl_149mm_rkl22", "IMPORTED"],
    ["portugal", "gun_bl_67mm_krupp", "IMPORTED"],
    ["brazil", "gun_rml_229mm_whitworth", "IMPORTED"],
    ["japan", "gun_bl_235mm_rkl22", "IMPORTED"],
    ["japan", "gun_bl_173mm_rkl25", "IMPORTED"],
    ["spain", "gun_rml_10in_12ton_300pdr", "IMPORTED"],
    ["austria_hungary", "gun_bl_209mm_gl20", "IMPORTED"],
  ])("%s models %s as %s", (nation, familyId, status) => {
    const profile = resolveNavalProfile(navalProfiles, nation, OPENING_MONTH)!;
    expect(profile.componentAccess[familyId]?.status).toBe(status);
  });

  it.each(CONVERTED)(
    "%s: every gun in %s uses its correct rifling mechanism (no smoothbore/rifled substitution)",
    (nation, id) => {
      const guns = byId(id).draft.placements.filter((p) => p.componentId.startsWith("gun_"));
      expect(guns.length).toBeGreaterThan(0);
      for (const gun of guns)
        expect(gun.componentId, `${id} ${gun.componentId}`).toMatch(/^gun_(rml|sb|bl)_/);
      if (nation === "usa")
        expect(guns.every((g) => g.componentId.startsWith("gun_sb_"))).toBe(true);
      else expect(guns.some((g) => g.componentId.startsWith("gun_sb_"))).toBe(false);
    },
  );

  it.each(CONVERTED)(
    "%s: %s is mechanically distinct from the British capital starter",
    (nation, id) => {
      const promoted = mechanicalFingerprint(byId(id).draft);
      expect(promoted).not.toBe(mechanicalFingerprint(uk.draft));
      for (const [otherNation, otherId] of CONVERTED)
        if (otherNation !== nation)
          expect(promoted, `${id} vs ${otherId}`).not.toBe(
            mechanicalFingerprint(byId(otherId).draft),
          );
    },
  );

  it("leaves the British starter untouched", () => {
    expect(uk.draft.nationId).toBe("uk");
    expect(uk.starterFor).toBe("B");
    expect(uk.draft.hull.hullFormId).toBe("coast_defence_form");
    expect(uk.draft.hull.targetDisplacementKg).toBe(9492000);
    expect(
      uk.draft.placements.some(
        (p) => p.componentId === "gun_rml_11in_25ton" && p.params?.barrels === 2,
      ),
    ).toBe(true);
  });

  it("keeps every converted nation's full opening roster resolvable and legal", () => {
    for (const [nation] of CONVERTED) {
      const { ctx } = shipBuildingContent.environmentFor(OPENING_MONTH, nation);
      for (const type of OPENING_TYPES) {
        const chosen = starterFor(type, starters, OPENING_MONTH, nation);
        expect(chosen, `${nation} ${type}`).not.toBeNull();
        const r = compileDesign(chosen!.draft, ctx);
        expect(r.valid, `${nation} ${type}`).toBe(true);
        expect(r.naturalClass, `${nation} ${type}`).toBe(type);
      }
    }
  });

  it("resolves the reference-design set deterministically", () => {
    const ids = () => readReferenceDesignEntries().map((d) => d.id);
    expect(ids()).toEqual(ids());
    const { ctx } = shipBuildingContent.environmentFor(OPENING_MONTH, "italy");
    const first = compileDesign(byId("principe_amedeo_1874").draft, ctx);
    const again = compileDesign(byId("principe_amedeo_1874").draft, ctx);
    expect(again.hash).toBe(first.hash);
  });
});

describe("smoothbore ordnance (ADR-0117)", () => {
  it("models the US 15-in Dahlgren as a distinct smoothbore, never mapped onto rifled-RML ballistics", () => {
    const sb = components.find((c) => c.id === "gun_sb_15in_dahlgren")!;
    expect(sb.category).toBe("MAIN_GUN");
    expect(sb.tags).toContain("smoothbore");
    expect(Number(sb.attributes?.caliberUm)).toBe(381000);
    const usa = navalProfiles.find((p) => p.nationId === "usa")!;
    const overlay = usa.gunModels.find((g) => g.id === "us_dahlgren_15in")!;
    expect(overlay.familyId).toBe("gun_sb_15in_dahlgren");
    expect(overlay.familyId).not.toMatch(/^gun_rml_/);
    const rifle = components.find((c) => c.id === "gun_rml_11in_25ton")!;
    expect(Number(sb.attributes?.rofBaseX100)).toBeLessThan(Number(rifle.attributes?.rofBaseX100));
  });
});

const NEW_FAMILIES: ReadonlyArray<readonly [string, string, "MAIN_GUN" | "SECONDARY_GUN"]> = [
  ["gun_bl_283mm_krupp", "netherlands", "MAIN_GUN"],
  ["gun_bl_149mm_rkl22", "portugal", "SECONDARY_GUN"],
  ["gun_bl_67mm_krupp", "portugal", "SECONDARY_GUN"],
  ["gun_rml_229mm_whitworth", "brazil", "MAIN_GUN"],
  ["gun_bl_235mm_rkl22", "japan", "MAIN_GUN"],
  ["gun_bl_173mm_rkl25", "japan", "SECONDARY_GUN"],
  ["gun_rml_10in_12ton_300pdr", "spain", "MAIN_GUN"],
  ["gun_bl_209mm_gl20", "austria_hungary", "MAIN_GUN"],
];

describe("coast-defence / casemate ordnance (ADR-0119)", () => {
  it.each(NEW_FAMILIES)(
    "%s has a matching %s-category component and a first-class family record",
    (familyId, _nation, category) => {
      const component = components.find((c) => c.id === familyId);
      expect(component, `${familyId} component`).toBeDefined();
      expect(component!.category).toBe(category);
      const family = armamentContent.gunFamilies.find((f) => f.id === familyId);
      expect(family, `${familyId} family`).toBeDefined();
      expect(family!.category).toBe(category);
    },
  );

  it.each([
    ["netherlands", "nl_krupp_283", "gun_bl_283mm_krupp"],
    ["portugal", "pt_krupp_149", "gun_bl_149mm_rkl22"],
    ["brazil", "br_whitworth_229", "gun_rml_229mm_whitworth"],
    ["japan", "jp_krupp_235mm", "gun_bl_235mm_rkl22"],
    ["japan", "jp_krupp_173mm", "gun_bl_173mm_rkl25"],
    ["spain", "es_armstrong_254", "gun_rml_10in_12ton_300pdr"],
    ["austria_hungary", "ah_krupp_209", "gun_bl_209mm_gl20"],
  ])(
    "%s overlay %s points at its own family %s (no false substitution)",
    (nation, id, familyId) => {
      const profile = navalProfiles.find((p) => p.nationId === nation)!;
      expect(profile.gunModels.find((g) => g.id === id)?.familyId).toBe(familyId);
    },
  );

  it("the Spanish 254 mm 300-pdr is a distinct, lighter family from the 10-inch 18-ton", () => {
    const threeHundred = components.find((c) => c.id === "gun_rml_10in_12ton_300pdr")!;
    const eighteen = components.find((c) => c.id === "gun_rml_10in_18ton")!;
    expect(Number(threeHundred.attributes?.caliberUm)).toBe(Number(eighteen.attributes?.caliberUm));
    expect(Number(threeHundred.attributes?.shellMassG)).toBeLessThan(
      Number(eighteen.attributes?.shellMassG),
    );
    expect(Number(threeHundred.constants.gun_kg)).toBeLessThan(Number(eighteen.constants.gun_kg));
  });

  it("the Portuguese 263 mm is the existing Krupp family in a CASEMATE use", () => {
    const portugal = navalProfiles.find((p) => p.nationId === "portugal")!;
    const overlay = portugal.gunModels.find((g) => g.id === "pt_krupp_263")!;
    expect(overlay.familyId).toBe("gun_bl_263mm_rkl20");
    expect(overlay.mounts).toContain("CASEMATE");
  });

  it("leaves maxImportedGunCaliberUm absent for every import-dependent nation (no sourced domestic ceiling)", () => {
    for (const nation of [
      "netherlands",
      "portugal",
      "brazil",
      "japan",
      "spain",
      "austria_hungary",
      "qing",
    ]) {
      const profile = navalProfiles.find((p) => p.nationId === nation)!;
      expect(profile.hardCapabilities.maxImportedGunCaliberUm, nation).toBeUndefined();
      expect(profile.industrialProfile.heavyGunProduction).toBe("IMPORTED");
    }
  });
});
