import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { ARMOUR_REGIONS, armourMaterialOptions } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import {
  PROTECTION_GROUPS,
  protectionGroupOf,
  protectionModel,
  regionLabel,
  schemeEdit,
} from "./protection-view.js";
import { schemeDiagram } from "./scheme-diagram.js";
import { ARMOUR_SCHEMES } from "@bluewave/ship-design";

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
    const model = protectionModel(ref.draft, view, materials, 1880);
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
    const model = protectionModel(ref.draft, view, materials, 1880);
    const threat = ref.draft.requirement.designThreatId;
    expect(model.designThreatId).toBe(threat);
    for (const field of model.fitted) {
      expect(field.marginBp).toBe(view.compiled.armour!.marginBp[field.region]?.[threat] ?? null);
      if (field.marginBp !== null) expect(field.defeatsDesignThreat).toBe(field.marginBp >= 0);
    }
  });

  it("reads effective thickness from the compile rather than recomputing it", () => {
    const model = protectionModel(ref.draft, view, materials, 1880);
    const compiled = view.compiled.armour!.effectiveThicknessByRegionUm;
    for (const field of model.fitted) {
      expect(field.effectiveThicknessMm).toBe((compiled[field.region] ?? 0) / 1000);
    }
    // A materials table that disagrees with the compile cannot move the readout.
    const tampered = materials.map((m) => ({ ...m, effBp: 1 }));
    const tamperedModel = protectionModel(ref.draft, view, tampered, 1880);
    const byRegion = new Map(model.fitted.map((f) => [f.region, f.effectiveThicknessMm]));
    for (const field of tamperedModel.fitted) {
      expect(field.effectiveThicknessMm).toBe(byRegion.get(field.region));
    }
  });

  it("lists the regions not yet fitted, and says what the model does not carry", () => {
    const model = protectionModel(ref.draft, view, materials, 1880);
    const fitted = new Set(ref.draft.armour.regions.map((r) => r.region));
    for (const region of ref.draft.armour.regions)
      expect(model.availableRegions).not.toContainEqual(
        expect.objectContaining({ id: region.region }),
      );
    expect(fitted.size).toBeGreaterThan(0);
    const notes = model.notes.join(" ").toLowerCase();
    expect(notes).toMatch(/subdivision|double bottom/);
    // The turret roof and secondary-gun armour are modelled now, so the notes no longer disclaim them.
    expect(notes).not.toMatch(/turret roof/);
  });

  it("offers the all-or-nothing scheme and the armour materials for the month", () => {
    const model = protectionModel(ref.draft, view, materials, 1880);
    expect(model.materials).toBe(materials);
    expect(model.coverageBp).toBe(view.compiled.armour!.coverageBp);
    expect(model.totalWeightKg).toBe(view.compiled.armour!.totalWeightKg);
  });

  it("carries the recommended starting plate for each fitted region", () => {
    const model = protectionModel(ref.draft, view, materials, 1880);
    expect(model.defaultMaterialId).not.toBe("");
    for (const field of model.fitted) {
      expect(field.recommended.region).toBe(field.region);
      expect(field.recommended.materialId).toBe(model.defaultMaterialId);
      expect(field.recommended.thicknessUm).toBeGreaterThan(0);
    }
  });
});

describe("armour schemes in the Protection section (#168 step 5)", () => {
  const at = (year: number, schemeId?: (typeof ARMOUR_SCHEMES)[number]["id"]) => {
    const draft = {
      ...ref.draft,
      armour: { ...ref.draft.armour, ...(schemeId ? { schemeId } : {}) },
    };
    return protectionModel(draft, view, materials, year);
  };

  it("lists the four schemes in order; in 1880 the later two are locked, with the year they unlock", () => {
    const m = at(1880);
    expect(m.schemes.map((x) => x.id)).toEqual(ARMOUR_SCHEMES.map((x) => x.id));
    expect(m.schemes.map((x) => x.locked)).toEqual([false, false, true, true]);
    for (const s of m.schemes.filter((x) => x.locked))
      expect(s.lockedReason).toMatch(/^Unlocks in \d{4}$/);
    for (const s of m.schemes.filter((x) => !x.locked)) expect(s.lockedReason).toBeNull();
    expect(at(1912).schemes.every((x) => !x.locked)).toBe(true);
  });
  it("labels the design Custom without a scheme, and by name with one", () => {
    expect(at(1880).schemeLabel).toBe("Custom");
    expect(at(1880, "PROTECTED_CRUISER").schemeLabel).toBe("Protected cruiser");
    expect(at(1880, "PROTECTED_CRUISER").schemes.find((x) => x.active)!.id).toBe(
      "PROTECTED_CRUISER",
    );
    expect(at(1880).schemes.some((x) => x.active)).toBe(false);
  });
  it("applying a scheme is one set_armour_scheme edit carrying the regions it produces", () => {
    const m = at(1880);
    const edit = schemeEdit(m, "FLAT_DECK_ON_BELT");
    expect(edit).toMatchObject({ kind: "set_armour_scheme", schemeId: "FLAT_DECK_ON_BELT" });
    const family = [
      "BELT_MAIN",
      "BELT_UPPER",
      "BELT_ENDS",
      "DECK_MAIN",
      "DECK_SLOPE",
      "DECK_EXTENDED",
    ];
    const fitted = edit!.regions.map((r) => r.region).filter((r) => family.includes(r));
    expect(fitted.sort()).toEqual(["BELT_ENDS", "BELT_MAIN", "DECK_MAIN"]);
  });
  it("refuses to apply a locked scheme", () => {
    expect(schemeEdit(at(1880), "ALL_OR_NOTHING")).toBeNull();
    expect(schemeEdit(at(1912), "ALL_OR_NOTHING")).not.toBeNull();
  });
});

describe("scheme diagrams", () => {
  it("draws one plate per region the scheme fits and none for regions it leaves out", () => {
    for (const s of ARMOUR_SCHEMES) {
      const drawn = new Set(schemeDiagram(s).plates.map((p) => p.region));
      expect([...drawn].sort()).toEqual([...s.layout].sort());
    }
  });
  it("is deterministic and keeps every plate inside the drawing", () => {
    for (const s of ARMOUR_SCHEMES) {
      const d = schemeDiagram(s);
      expect(schemeDiagram(s)).toEqual(d);
      for (const p of d.plates)
        for (const v of [p.x1, p.x2]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(d.width);
        }
    }
  });
});
