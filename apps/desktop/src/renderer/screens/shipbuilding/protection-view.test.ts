import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { ARMOUR_REGIONS, armourMaterialOptions } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import {
  PROTECTION_GROUPS,
  protectionGroupOf,
  protectionModel,
  regionLabel,
} from "./protection-view.js";

const content = loadDrawingBoardContent();
// The first reference (a destroyer) carries no armour; use the armoured reference with the most regions so the
// field readouts are exercised against a real scheme.
const ref = [...content.references].sort(
  (a, b) => b.draft.armour.regions.length - a.draft.armour.regions.length,
)[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const materials = armourMaterialOptions(env.ctx.balance.armour, ref.month, env.ctx.unlockedTechs);

describe("protection view model", () => {
  it("groups every armour region into exactly one spatial group", () => {
    const groups = new Set(PROTECTION_GROUPS.map((g) => g.id));
    for (const region of ref.draft.armour.regions) {
      expect(groups.has(protectionGroupOf(region.region))).toBe(true);
    }
    expect(PROTECTION_GROUPS.map((g) => g.id)).toEqual([
      "belt",
      "deck",
      "conning-tower",
      "armament",
      "underwater",
    ]);
  });

  it("labels each region in words rather than its enum name", () => {
    expect(regionLabel("BELT_MAIN")).toBe("Main belt");
    expect(regionLabel("DECK_SLOPE")).toBe("Deck slope");
    expect(regionLabel("CONNING_TOWER")).toBe("Conning tower");
    for (const region of ref.draft.armour.regions) {
      expect(regionLabel(region.region)).not.toContain("_");
    }
  });

  it("names every region, using the manual's terms for the parity fields (ADR-0232)", () => {
    expect(regionLabel("BELT_ENDS")).toBe("Belt extended (BE)");
    expect(regionLabel("DECK_EXTENDED")).toBe("Deck extended (DE)");
    expect(regionLabel("TURRET")).toBe("Turret + barbette (T)");
    expect(regionLabel("TURRET_TOP")).toBe("Turret top (TT)");
    expect(regionLabel("SECONDARY_GUN")).toBe("Secondary gun armour (SEC)");
    expect(protectionGroupOf("DECK_EXTENDED")).toBe("deck");
    for (const region of ["TURRET", "TURRET_TOP", "SECONDARY_GUN"] as const)
      expect(protectionGroupOf(region)).toBe("armament");
    const labels = ARMOUR_REGIONS.map(regionLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("reports each fitted field's thickness, coverage, area and weight from the design", () => {
    const model = protectionModel(ref.draft, view, materials);
    expect(model.groups.flatMap((g) => g.fields)).toHaveLength(ref.draft.armour.regions.length);
    const lengthWl = Number(ref.draft.hull.lengthWl);
    for (const field of model.fitted) {
      const region = ref.draft.armour.regions.find((r) => r.region === field.region)!;
      expect(field.thicknessMm).toBe(region.thicknessUm / 1000);
      expect(field.coveragePermille).toBe(Math.round((region.lengthMm * 1000) / lengthWl));
      expect(field.protectedAreaM2).toBeCloseTo((region.lengthMm * region.heightMm) / 1_000_000, 6);
      expect(field.weightKg).toBe(view.compiled.armour!.weightByRegionKg[field.region] ?? 0);
    }
  });

  it("reads the penetration margin against the design threat from the compile", () => {
    const model = protectionModel(ref.draft, view, materials);
    const threat = ref.draft.requirement.designThreatId;
    expect(model.designThreatId).toBe(threat);
    for (const field of model.fitted) {
      expect(field.marginBp).toBe(view.compiled.armour!.marginBp[field.region]?.[threat] ?? null);
      if (field.marginBp !== null) expect(field.defeatsDesignThreat).toBe(field.marginBp >= 0);
    }
  });

  it("derives effective thickness from thickness, material effectiveness and obliquity", () => {
    const model = protectionModel(ref.draft, view, materials);
    for (const field of model.fitted) {
      const eff = materials.find((m) => m.id === field.materialId)?.effBp ?? 10_000;
      const cos = field.inclined ? 8_660 : 10_000;
      expect(field.effectiveThicknessMm).toBeCloseTo(
        (field.thicknessMm * eff * cos) / (10_000 * 10_000),
        4,
      );
    }
  });

  it("lists the regions not yet fitted, and says what the model does not carry", () => {
    const model = protectionModel(ref.draft, view, materials);
    const fitted = new Set(ref.draft.armour.regions.map((r) => r.region));
    for (const region of ref.draft.armour.regions)
      expect(model.availableRegions).not.toContainEqual(
        expect.objectContaining({ id: region.region }),
      );
    expect(fitted.size).toBeGreaterThan(0);
    const notes = model.notes.join(" ").toLowerCase();
    expect(notes).toMatch(/turret (side|roof)/);
    expect(notes).toMatch(/subdivision|double bottom/);
  });

  it("offers the all-or-nothing scheme and the armour materials for the month", () => {
    const model = protectionModel(ref.draft, view, materials);
    expect(model.materials).toBe(materials);
    expect(model.coverageBp).toBe(view.compiled.armour!.coverageBp);
    expect(model.totalWeightKg).toBe(view.compiled.armour!.totalWeightKg);
  });

  it("carries the recommended starting plate for each fitted region", () => {
    const model = protectionModel(ref.draft, view, materials);
    expect(model.defaultMaterialId).not.toBe("");
    for (const field of model.fitted) {
      expect(field.recommended.region).toBe(field.region);
      expect(field.recommended.materialId).toBe(model.defaultMaterialId);
      expect(field.recommended.thicknessUm).toBeGreaterThan(0);
    }
  });
});
