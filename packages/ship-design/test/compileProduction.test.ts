// The production parts compile boundary (ship-part-model ticket 11d, AC 7). A design carried as
// a `DesignHeader` + `DesignLoadout` compiles through `compileDesignFromLoadout`: the inverse
// readers rebuild the draft, `validateLoadoutFit` runs first, and `compileDesign` is reached only
// through `deriveAfterFit`. An invalid loadout exposes fit information and no derived metric, so
// no production caller can obtain metrics for a loadout that does not fit.

import {
  LoadoutSchema,
  decodeStrict,
  type FlattenedPart,
  type LoadoutData,
  type LoadoutEntryData,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  buildArmourPartModel,
  buildFittingPartModel,
  buildLauncherPartModel,
  buildPlantPartModel,
  buildProductionPartModel,
  catalogueForNation,
  compileDesign,
  compileDesignFromLoadout,
  headerFromDraft,
  translateArmourRegion,
  translateFittingPlacement,
  translateMachinery,
  translateTubePlacement,
  type FitMountCountRanges,
  type ProductionCompile,
} from "../src/index.js";
import {
  components,
  navalProfiles,
  nationalContext,
  plants,
  shipBalance,
} from "./helpers/earlyContext.js";
import {
  compatibility,
  designs,
  gunPlacements,
  present,
  resolveRow,
  type Design,
} from "./helpers/gunReadPath.js";
import { torpedoDiameterUm } from "./helpers/torpedoModels.js";

const WEAPON = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);
const categoryOf = (id: string) => components.find((c) => c.id === id)?.category;

const fittingModel = buildFittingPartModel({ components });
const plantModel = buildPlantPartModel({ plants });
const armourModel = buildArmourPartModel({ armour: shipBalance.armour });
const launcherModel = buildLauncherPartModel({
  components,
  profiles: navalProfiles,
  torpedoDiameterUm,
});

interface ProductionDesign {
  readonly design: Design;
  readonly loadout: LoadoutData;
  readonly header: ReturnType<typeof headerFromDraft>;
  readonly parts: readonly FlattenedPart[];
  readonly ranges: FitMountCountRanges;
}

function productionDesign(design: Design): ProductionDesign {
  const nationId = design.draft.nationId;
  const profile = present(
    navalProfiles.find((p) => p.nationId === nationId),
    nationId,
  );
  const applied = catalogueForNation(components, profile, design.month).appliedModels;
  const entries: LoadoutEntryData[] = [];
  const parts: FlattenedPart[] = [];
  const ranges: Record<string, { min: number; max: number; step: number }> = {};
  for (const placement of design.draft.placements) {
    const category = categoryOf(placement.componentId);
    if (category === "TORPEDO_TUBE") {
      const t = present(
        translateTubePlacement({
          designId: design.id,
          placement,
          nationId,
          model: launcherModel,
          appliedModels: applied,
        }).translation,
        placement.instanceId,
      );
      entries.push(t.entry);
      parts.push(t.launcherPart);
      const tubes = components.find((c) => c.id === placement.componentId)?.parameters["tubes"];
      if (tubes !== undefined) ranges[t.launcherPart.id] = tubes;
    } else if (WEAPON.has(category ?? "")) {
      const row = present(
        gunPlacements.find((g) => g.design.id === design.id && g.placement === placement),
        placement.instanceId,
      );
      const t = present(resolveRow(row).translation, placement.instanceId);
      entries.push(t.entry);
      parts.push(t.mountPart, t.gunPart);
    } else {
      const t = present(
        translateFittingPlacement({ designId: design.id, placement, model: fittingModel })
          .translation,
        placement.instanceId,
      );
      entries.push(t.entry);
      parts.push(t.record.part);
      const counted = t.record.countParameter;
      const range = counted === null ? undefined : t.record.legacy.parameters[counted];
      if (range !== undefined) ranges[t.record.part.id] = range;
    }
  }
  const machinery = present(
    translateMachinery({
      designId: design.id,
      machinery: design.draft.machinery,
      model: plantModel,
    }).translation,
    `${design.id} machinery`,
  );
  entries.push(machinery.entry);
  parts.push(machinery.plantPart);
  design.draft.armour.regions.forEach((region, index) => {
    const t = present(
      translateArmourRegion({ designId: design.id, index, region, model: armourModel }).translation,
      `${design.id} armour ${index}`,
    );
    entries.push(t.entry);
    parts.push(t.materialPart);
  });
  return {
    design,
    header: headerFromDraft(design.draft),
    loadout: decodeStrict(LoadoutSchema, { platform: design.draft.hull.hullFormId, entries }),
    parts,
    ranges,
  };
}

const uniqueParts = (parts: readonly FlattenedPart[]): FlattenedPart[] => {
  const byId = new Map<string, FlattenedPart>();
  for (const part of parts) byId.set(part.id, part);
  return [...byId.values()].sort((a, b) => compareCodePoints(a.id, b.id));
};

const all: readonly ProductionDesign[] = designs.map(productionDesign);

const modelFor = (d: ProductionDesign) =>
  buildProductionPartModel({
    parts: uniqueParts(d.parts),
    slotTemplates: compatibility.slotTemplates,
    platforms: compatibility.platforms,
  });

const compile = (d: ProductionDesign, loadout: LoadoutData = d.loadout): ProductionCompile =>
  compileDesignFromLoadout({
    designId: d.design.id,
    header: d.header,
    loadout,
    model: modelFor(d),
    month: d.design.month,
    nation: { nationId: d.design.draft.nationId },
    mountCountRanges: d.ranges,
    ctx: nationalContext(d.design.month, d.design.draft.nationId),
  });

describe("production compile from a parts loadout (ticket 11d)", () => {
  it("compiles every production design through the barrier and matches the legacy result", () => {
    for (const d of all) {
      const result = compile(d);
      expect(result.status, d.design.id).toBe("ACCEPTED");
      if (result.status !== "ACCEPTED") continue;
      const legacy = compileDesign(
        d.design.draft,
        nationalContext(d.design.month, d.design.draft.nationId),
      );
      expect(canonicalSerialize(result.compiled), d.design.id).toBe(canonicalSerialize(legacy));
    }
  });

  it("exposes no derived metric for a loadout that does not fit", () => {
    const d = present(all[0], "a design");
    const broken: LoadoutData = {
      ...d.loadout,
      entries: d.loadout.entries.map((entry) =>
        entry.params?.["installedKw"] === undefined
          ? entry
          : { ...entry, params: { installedKw: 99_999_999 } },
      ),
    };
    const result = compile(d, broken);
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.findings.length).toBeGreaterThan(0);
    expect("compiled" in result).toBe(false);
  });

  it("refuses a loadout whose parts the inverse readers cannot rebuild", () => {
    const d = present(all[0], "a design");
    const unknown: LoadoutData = {
      ...d.loadout,
      entries: d.loadout.entries.map((entry) =>
        entry.part === d.loadout.entries[0]!.part ? { ...entry, part: "no_such_part" } : entry,
      ),
    };
    const result = compile(d, unknown);
    expect(result.status).toBe("UNTRANSLATED");
    if (result.status !== "UNTRANSLATED") return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("a visual-only change leaves every derived metric and the compiled design identical (I-14)", () => {
    const d = present(all[0], "a design");
    const baseline = compile(d);
    expect(baseline.status).toBe("ACCEPTED");
    if (baseline.status !== "ACCEPTED") return;
    const target = d.parts[0]!.id;
    const withVisual = d.parts.map((p) =>
      p.id === target
        ? {
            ...p,
            visual: { traits: { enclosure: { value: "enclosed" as const, reason: "I-14" } } },
          }
        : p,
    );
    const model = buildProductionPartModel({
      parts: uniqueParts(withVisual),
      slotTemplates: compatibility.slotTemplates,
      platforms: compatibility.platforms,
    });
    const result = compileDesignFromLoadout({
      designId: d.design.id,
      header: d.header,
      loadout: d.loadout,
      model,
      month: d.design.month,
      nation: { nationId: d.design.draft.nationId },
      mountCountRanges: d.ranges,
      ctx: nationalContext(d.design.month, d.design.draft.nationId),
    });
    expect(result.status).toBe("ACCEPTED");
    if (result.status !== "ACCEPTED") return;
    expect(canonicalSerialize(result.compiled)).toBe(canonicalSerialize(baseline.compiled));
  });

  it("reaches derivation only through the barrier: REJECTED never carries compiled metrics", () => {
    const d = present(all[0], "a design");
    const broken = compile(d, {
      ...d.loadout,
      entries: d.loadout.entries.map((entry) =>
        entry.params?.["installedKw"] === undefined
          ? entry
          : { ...entry, params: { installedKw: 0 } },
      ),
    });
    expect(["REJECTED", "NOT_EVALUABLE"]).toContain(broken.status);
    expect(Object.hasOwn(broken, "compiled")).toBe(false);
  });
});
