import {
  FlattenedPartSchema,
  LoadoutEntrySchema,
  LoadoutSchema,
  decodeStrict,
  decodeStrictResult,
  type LoadoutEntryData,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { num, type Resolved } from "../src/compileShared.js";
import { resolveDesignComponents } from "../src/compile/stages.js";
import {
  ammunitionPatternFromPart,
  buildAmmunitionPartModel,
} from "../src/ammunitionPartAdapter.js";
import { armourAvailabilityFindings } from "../src/armour.js";
import { armourBalanceFromParts, armourRegionFromEntry } from "../src/armourPartAdapter.js";
import {
  armourMaterialOptions,
  compileDesign,
  type ArmourBalance,
  type ArmourRegion,
  type ComponentDef,
  type DesignDraft,
  type PropulsionPlant,
} from "../src/index.js";
import { buildArmourPartModel, translateArmourRegion } from "../src/armourPartAdapter.js";
import { buildFittingPartModel, translateFittingPlacement } from "../src/fittingPartAdapter.js";
import { buildLauncherPartModel, translateTubePlacement } from "../src/torpedoPartAdapter.js";
import { buildPlantPartModel, translateMachinery } from "../src/plantPartAdapter.js";
import { catalogueForNation } from "../src/componentVariants.js";
import { platformSlots } from "../src/partCompatibility.js";
import { buildArmamentCatalogue } from "../src/armamentContent.js";
import { buildGunMountPart } from "../src/gunPartAdapter.js";
import {
  fittingPlacementValues,
  type FittingPlacementTranslation,
} from "../src/fittingPartAdapter.js";
import { machineryPlanFromEntry, propulsionPlantFromPart } from "../src/plantPartAdapter.js";
import { quantityLines, totalOf, type QuantityLine } from "../src/partQuantities.js";
import { readComponentQuantities } from "../src/legacyComponentQuantities.js";
import {
  armamentContent,
  components,
  earlyContext,
  nationalContext,
  navalProfiles,
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

const WEAPON = new Set([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
  "TORPEDO_TUBE",
]);
const categoryOf = (componentId: string) => components.find((c) => c.id === componentId)?.category;

const fittingModel = buildFittingPartModel({ components });
const plantModel = buildPlantPartModel({ plants });
const armourModel = buildArmourPartModel({ armour: shipBalance.armour });
const ammunitionModel = buildAmmunitionPartModel({ ammunition: armamentContent.ammunition });

interface FittingRow {
  readonly design: Design;
  readonly t: FittingPlacementTranslation;
}

const fittingRows: readonly FittingRow[] = designs.flatMap((design) =>
  design.draft.placements
    .filter((p) => !WEAPON.has(categoryOf(p.componentId) ?? "UNKNOWN"))
    .map((placement) => ({
      design,
      t: present(
        translateFittingPlacement({ designId: design.id, placement, model: fittingModel })
          .translation,
        `${design.id}:${placement.instanceId}`,
      ),
    })),
);
const whereFitting = (row: FittingRow) => `${row.design.id}:${row.t.instanceId}`;

function legacyResolved(design: Design): readonly Resolved[] {
  const ctx = nationalContext(design.month, design.draft.nationId);
  const plant = present(
    ctx.plants.find((p) => p.id === design.draft.machinery.plantId),
    `plant ${design.draft.machinery.plantId}`,
  );
  return resolveDesignComponents(
    design.draft,
    ctx,
    new Map(ctx.catalogue.map((c) => [c.id, c])),
    plant,
    [],
  );
}
const legacyByDesign = new Map(designs.map((d) => [d.id, legacyResolved(d)]));
const legacyPlacement = (designId: string, instanceId: string): Resolved =>
  present(
    legacyByDesign.get(designId)?.find((r) => r.spec.instanceId === instanceId),
    `legacy ${designId}:${instanceId}`,
  );

const launcherModel = buildLauncherPartModel({
  components,
  profiles: navalProfiles,
  torpedoDiameterUm,
});

const line = (lines: readonly QuantityLine[], id: string): QuantityLine =>
  present(
    lines.find((q) => q.id === id),
    `quantity ${id}`,
  );

function fixtureComponent(
  overrides: Partial<ComponentDef> & Pick<ComponentDef, "id">,
): ComponentDef {
  return {
    displayName: "Fixture",
    category: "DAMAGE_CONTROL",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    requires: [],
    parameters: {},
    constants: {},
    weightKg: "0",
    volumeLitre: "0",
    costMicro: "0",
    crew: "0",
    powerKw: "0",
    upgradePath: [],
    tags: [],
    ...overrides,
  };
}

const fixturePlacement = (componentId: string, params?: Record<string, number>) => ({
  instanceId: "fixture",
  componentId,
  zoneId: "FWD_SERVICE" as const,
  stationPermille: 300,
  ...(params !== undefined ? { params } : {}),
});

function designLoadout(design: Design): { platform: string; entries: LoadoutEntryData[] } {
  const nationId = design.draft.nationId;
  const profile = present(
    navalProfiles.find((p) => p.nationId === nationId),
    `profile ${nationId}`,
  );
  const applied = catalogueForNation(components, profile, design.month).appliedModels;
  const entries: LoadoutEntryData[] = [];
  for (const placement of design.draft.placements) {
    const category = categoryOf(placement.componentId);
    if (category === "TORPEDO_TUBE") {
      const t = translateTubePlacement({
        designId: design.id,
        placement,
        nationId,
        model: launcherModel,
        appliedModels: applied,
      });
      entries.push(present(t.translation, placement.instanceId).entry);
    } else if (WEAPON.has(category ?? "")) {
      const row = present(
        gunPlacements.find((g) => g.design.id === design.id && g.placement === placement),
        placement.instanceId,
      );
      entries.push(present(resolveRow(row).translation, placement.instanceId).entry);
    } else {
      const t = translateFittingPlacement({ designId: design.id, placement, model: fittingModel });
      entries.push(present(t.translation, placement.instanceId).entry);
    }
  }
  const machinery = translateMachinery({
    designId: design.id,
    machinery: design.draft.machinery,
    model: plantModel,
  });
  entries.push(present(machinery.translation, `${design.id} machinery`).entry);
  design.draft.armour.regions.forEach((region, index) => {
    const t = translateArmourRegion({ designId: design.id, index, region, model: armourModel });
    entries.push(present(t.translation, `${design.id} armour ${index}`).entry);
  });
  return { platform: design.draft.hull.hullFormId, entries };
}

describe("fittings and sensors through the read path (ship-part-model 05)", () => {
  it("covers the 622 non-gun, non-tube placements; with 267 guns and 33 tubes that is all 922", () => {
    const all = designs.flatMap((d) => d.draft.placements);
    expect(all.length).toBe(922);
    expect(fittingRows.length).toBe(622);
    expect(gunPlacements.length + 33 + fittingRows.length).toBe(922);
    expect(fittingModel.unread).toEqual([]);
  });

  it("maps all nine non-weapon components to one interface each (§8.1)", () => {
    expect(fittingModel.records.map((r) => [r.part.id, r.part.family, r.part.provides])).toEqual([
      ["dynamo_small", "fitting", "electrical_plant"],
      ["funnel_single", "fitting", "funnel"],
      ["magazine_heavy", "fitting", "magazine"],
      ["magazine_medium", "fitting", "magazine"],
      ["magazine_small", "fitting", "magazine"],
      ["pumps_damage_control", "fitting", "damage_control"],
      ["quarters_crew", "fitting", "accommodation"],
      ["rangefinder_optical", "sensor", "sensor"],
      ["ventilation_plant", "fitting", "ventilation"],
    ]);
  });

  it("every placement's values equal the legacy compile's resolved placement", () => {
    for (const row of fittingRows) {
      const legacy = legacyPlacement(row.design.id, row.t.instanceId);
      expect(fittingPlacementValues(row.t), whereFitting(row)).toEqual({
        weightKg: legacy.weightKg,
        costMicro: legacy.costMicro,
        crew: legacy.crew,
        volumeLitre: legacy.volumeLitre,
        deckFootprintMm2: legacy.deckFootprintMm2,
        heightMm: legacy.heightMm,
        zCgMm: legacy.zCgMm,
        powerKw: legacy.powerKw,
        coolingKw: legacy.coolingKw,
        attr: legacy.attr,
      });
    }
  });

  it("each placement is one entry in its zone's interface slot, preserving station and side", () => {
    for (const row of fittingRows) {
      const placement = present(
        row.design.draft.placements.find((p) => p.instanceId === row.t.instanceId),
        whereFitting(row),
      );
      const slot = present(
        platformSlots(compatibility, row.design.draft.hull.hullFormId)?.find(
          (s) => s.id === row.t.entry.slot,
        ),
        `${whereFitting(row)} slot ${row.t.entry.slot}`,
      );
      expect(slot.zone).toBe(placement.zoneId);
      expect(slot.accepts).toEqual([row.t.record.part.provides]);
      expect(row.t.entry.part).toBe(placement.componentId);
      expect(row.t.entry.stationPermille).toBe(placement.stationPermille);
      expect(row.t.entry.side).toBe(placement.side);
      expect(row.t.entry.mountCount).toBe(row.t.mountCount);
      expect(row.t.ignoredParams, whereFitting(row)).toEqual([]);
    }
  });

  it("the quarters' blocks are the entry's mountCount; one-unit fittings are mountCount 1", () => {
    const isQuarters = (row: FittingRow) => row.t.record.part.id === "quarters_crew";
    const quarters = fittingRows.filter(isQuarters);
    const oneUnit = fittingRows.filter((row) => !isQuarters(row));
    expect(quarters.length).toBeGreaterThan(0);
    for (const row of quarters) {
      const placement = present(
        row.design.draft.placements.find((p) => p.instanceId === row.t.instanceId),
        whereFitting(row),
      );
      expect(row.t.mountCount, whereFitting(row)).toBe(placement.params?.blocks);
      expect(row.t.defaulted).toBe(false);
    }
    for (const row of oneUnit) {
      expect(row.t.mountCount, whereFitting(row)).toBe(1);
      expect(row.t.record.countParameter).toBeNull();
    }
  });

  describe("hand-worked crew, volume and footprint by declared basis", () => {
    const quarters = (blocks: number) =>
      present(
        translateFittingPlacement({
          designId: "hand",
          placement: fixturePlacement("quarters_crew", { blocks }),
          model: fittingModel,
        }).translation,
        "quarters",
      );

    it("48 quarters blocks: 10,000 L, 1,250,000 mm² and 15 M per block; no crew, no mass", () => {
      const t = quarters(48);
      expect(t.entry.mountCount).toBe(48);
      expect(line(t.quantities, "volume")).toMatchObject({
        kind: "volumeLitre",
        value: 10_000,
        basis: "PER_PART_UNIT",
        multiplier: 48,
        contribution: 480_000,
      });
      expect(line(t.quantities, "deck_footprint")).toMatchObject({
        kind: "deckFootprintMm2",
        value: 1_250_000,
        basis: "PER_PART_UNIT",
        contribution: 60_000_000,
      });
      expect(line(t.quantities, "cost")).toMatchObject({
        value: 15_000_000,
        contribution: 720_000_000,
      });
      expect(line(t.quantities, "crew")).toMatchObject({ kind: "crew", value: 0, contribution: 0 });
      expect(line(t.quantities, "mass")).toMatchObject({ kind: "massKg", value: 0 });
    });

    it("a heavy magazine is one unit: crew 8, 130,000 L, 30,000,000 mm², all PER_PART_UNIT × 1", () => {
      const t = present(
        translateFittingPlacement({
          designId: "hand",
          placement: fixturePlacement("magazine_heavy"),
          model: fittingModel,
        }).translation,
        "magazine",
      );
      expect(t.quantities.map((q) => [q.id, q.kind, q.value, q.basis, q.multiplier])).toEqual([
        ["mass", "massKg", 0, "PER_PART_UNIT", 1],
        ["cost", "costMicro", 3_000_000_000, "PER_PART_UNIT", 1],
        ["crew", "crew", 8, "PER_PART_UNIT", 1],
        ["volume", "volumeLitre", 130_000, "PER_PART_UNIT", 1],
        ["deck_footprint", "deckFootprintMm2", 30_000_000, "PER_PART_UNIT", 1],
      ]);
      expect(t.record.part.spec).toEqual({
        magazineLitre: 120_000,
        flashProtectionBp: 0,
        critical: true,
      });
    });

    it("the rangefinder's accuracy and capacity are its sensor spec; fire-control classes stay adapter-side", () => {
      const record = present(
        fittingModel.records.find((r) => r.part.id === "rangefinder_optical"),
        "rangefinder",
      );
      expect(record.part.spec).toEqual({ accuracyBonusBp: 800, gunCapacity: 8 });
      expect(record.legacy.fcClasses).toEqual(["heavy", "medium", "light"]);
      expect(
        decodeStrictResult(FlattenedPartSchema, { ...record.part, fcClasses: ["heavy"] })._tag,
      ).toBe("Failure");
    });

    it("a fixed term is PER_LOADOUT_ENTRY and a per-count term PER_PART_UNIT: 500 + 20 × 3 = 560 kg", () => {
      const def = fixtureComponent({
        id: "fixture_racks",
        parameters: { racks: { min: 1, max: 6, step: 1 } },
        weightKg: "500 + 20 * racks",
        crew: "2 * racks",
      });
      const model = buildFittingPartModel({ components: [def] });
      const t = present(
        translateFittingPlacement({
          designId: "hand",
          placement: fixturePlacement("fixture_racks", { racks: 3 }),
          model,
        }).translation,
        "racks",
      );
      expect(line(t.quantities, "mass_fixed")).toMatchObject({
        basis: "PER_LOADOUT_ENTRY",
        value: 500,
        multiplier: 1,
      });
      expect(line(t.quantities, "mass")).toMatchObject({
        basis: "PER_PART_UNIT",
        value: 20,
        multiplier: 3,
      });
      expect(totalOf(t.quantities, "massKg")).toBe(560);
      expect(totalOf(t.quantities, "crew")).toBe(6);
      for (const racks of [1, 2, 3, 4, 5, 6]) {
        const again = present(
          translateFittingPlacement({
            designId: "hand",
            placement: fixturePlacement("fixture_racks", { racks }),
            model,
          }).translation,
          `racks ${racks}`,
        );
        expect(totalOf(again.quantities, "massKg")).toBe(num(def.weightKg, { racks }));
      }
    });

    it("an unusual but valid basis scales as declared: per-unit terms on a contained basis", () => {
      const def = fixtureComponent({
        id: "fixture_crewed",
        parameters: { blocks: { min: 1, max: 4, step: 1 } },
        crew: "7 + 3 * blocks",
      });
      const read = readComponentQuantities(def, {
        fields: ["crew"],
        countParameter: "blocks",
        perUnitBasis: "PER_CONTAINED_UNIT",
        idFor: (field, term) => `${field}_${term}`,
      });
      expect(read.issues).toEqual([]);
      expect(read.quantities).toEqual([
        { id: "crew_fixed", kind: "crew", value: 7, basis: "PER_LOADOUT_ENTRY" },
        { id: "crew_perUnit", kind: "crew", value: 3, basis: "PER_CONTAINED_UNIT" },
      ]);
      const lines = quantityLines(read.quantities, "fitting", def.id, 2, 5);
      expect(lines.map((l) => [l.multiplier, l.contribution])).toEqual([
        [1, 7],
        [10, 30],
      ]);
    });
  });

  describe("zero, missing, malformed and impossible quantities", () => {
    const read = (overrides: Partial<ComponentDef>, countParameter: string | null = "blocks") =>
      readComponentQuantities(
        fixtureComponent({
          id: "fixture_q",
          parameters: countParameter === null ? {} : { blocks: { min: 1, max: 4, step: 1 } },
          ...overrides,
        }),
        {
          fields: ["weightKg", "crew", "volumeLitre", "deckFootprintMm2"],
          countParameter,
          perUnitBasis: "PER_PART_UNIT",
          idFor: (field, term) => `${field}_${term}`,
        },
      );

    it("an absent footprint declares nothing; an authored zero is declared", () => {
      const r = read({ weightKg: "0" }, null);
      expect(r.quantities.find((q) => q.kind === "deckFootprintMm2")).toBeUndefined();
      expect(r.quantities.find((q) => q.kind === "massKg")).toEqual({
        id: "weightKg_perUnit",
        kind: "massKg",
        value: 0,
        basis: "PER_PART_UNIT",
      });
    });

    it.each([
      ["a negative value", { crew: "0 - 5" }, "PART_READ_PATH_INVALID_QUANTITY"],
      ["a non-affine formula", { crew: "blocks * blocks" }, "PART_READ_PATH_NONLINEAR_QUANTITY"],
      ["a floored division", { volumeLitre: "blocks / 2" }, "PART_READ_PATH_NONLINEAR_QUANTITY"],
      [
        "a formula over another parameter",
        { crew: "3 * hands" },
        "PART_READ_PATH_PARAMETER_DEPENDENT_QUANTITY",
      ],
      ["an unparsable formula", { deckFootprintMm2: "2 +" }, "PART_READ_PATH_FORMULA_ERROR"],
    ] as const)("%s is a coded issue, never a guessed quantity", (_label, overrides, code) => {
      const r = read(overrides);
      expect(r.issues.map((i) => i.code)).toEqual([code]);
      expect(r.issues[0]?.componentId).toBe("fixture_q");
    });

    it("one admissible count reads as per-unit only when it divides exactly", () => {
      const single = (crew: string) =>
        readComponentQuantities(
          fixtureComponent({
            id: "fixture_one",
            parameters: { blocks: { min: 2, max: 2, step: 1 } },
            crew,
          }),
          {
            fields: ["crew"],
            countParameter: "blocks",
            perUnitBasis: "PER_PART_UNIT",
            idFor: (field, term) => `${field}_${term}`,
          },
        );
      expect(single("6").quantities).toEqual([
        { id: "crew_perUnit", kind: "crew", value: 3, basis: "PER_PART_UNIT" },
      ]);
      expect(single("3").issues.map((i) => i.code)).toEqual(["PART_READ_PATH_INVALID_QUANTITY"]);
    });

    it("a component with an unreadable formula is kept as unread with its issues, not dropped", () => {
      const model = buildFittingPartModel({
        components: [
          fixtureComponent({
            id: "fixture_bad",
            parameters: { blocks: { min: 1, max: 4, step: 1 } },
            crew: "blocks * blocks",
          }),
        ],
      });
      expect(model.records).toEqual([]);
      expect(model.unread).toEqual([
        expect.objectContaining({
          id: "fixture_bad",
          code: "PART_READ_PATH_UNREADABLE_QUANTITY",
          issues: [
            expect.objectContaining({ field: "crew", code: "PART_READ_PATH_NONLINEAR_QUANTITY" }),
          ],
        }),
      ]);
    });

    it.each([
      ["an unmapped category", { category: "COMMS" as const }, "PART_READ_PATH_NO_INTERFACE"],
      [
        "special equipment with no closed tag",
        { category: "SPECIAL_EQUIPMENT" as const, tags: ["mast"] },
        "PART_READ_PATH_NO_INTERFACE",
      ],
      [
        "two parameters",
        {
          parameters: {
            a: { min: 1, max: 2, step: 1 },
            b: { min: 1, max: 2, step: 1 },
          },
        },
        "PART_READ_PATH_MULTIPLE_PARAMETERS",
      ],
      [
        "a flash protection over 10,000 bp",
        { category: "MAGAZINE" as const, attributes: { flashProtectionBp: "20000" } },
        "PART_READ_PATH_INVALID_SPEC",
      ],
      [
        "an obsolete month not after the introduction",
        { introduction: { fromMonth: "1885-01", obsoleteMonth: "1885-01" } },
        "PART_READ_PATH_INVALID_LIFECYCLE",
      ],
    ] as const)("%s is reported as unread", (_label, overrides, code) => {
      const model = buildFittingPartModel({
        components: [fixtureComponent({ id: "fixture_odd", ...overrides })],
      });
      expect(model.records).toEqual([]);
      expect(model.unread.map((u) => [u.id, u.code])).toEqual([["fixture_odd", code]]);
    });
  });

  describe("placement counts", () => {
    it("an absent count takes the legacy default (the parameter minimum) and is flagged", () => {
      const t = present(
        translateFittingPlacement({
          designId: "hand",
          placement: fixturePlacement("quarters_crew"),
          model: fittingModel,
        }).translation,
        "quarters",
      );
      expect(t.defaulted).toBe(true);
      expect(t.legacyCount).toBeNull();
      expect(t.mountCount).toBe(1);
    });

    it.each([0, -2, 2.5, Number.NaN])("blocks %s fails translation", (blocks) => {
      const r = translateFittingPlacement({
        designId: "hand",
        placement: fixturePlacement("quarters_crew", { blocks }),
        model: fittingModel,
      });
      expect(r.translation).toBeNull();
      expect(r.untranslated?.code).toBe("PART_READ_PATH_INVALID_COUNT");
    });

    it("an unknown component fails; an undeclared parameter is listed, as legacy ignores it", () => {
      expect(
        translateFittingPlacement({
          designId: "hand",
          placement: fixturePlacement("no_such_fitting"),
          model: fittingModel,
        }).untranslated,
      ).toEqual({
        designId: "hand",
        instanceId: "fixture",
        componentId: "no_such_fitting",
        code: "PART_READ_PATH_NO_FITTING_PART",
        message: "No fitting part 'no_such_fitting' was read.",
      });
      const t = translateFittingPlacement({
        designId: "hand",
        placement: fixturePlacement("magazine_small", { zeta: 1, alpha: 2 }),
        model: fittingModel,
      }).translation;
      expect(t?.ignoredParams).toEqual(["alpha", "zeta"]);
      expect(t?.entry.params).toBeUndefined();
    });
  });

  it("availability: the exclusive obsoleteMonth copies unchanged and matches the legacy boundary", () => {
    const def = fixtureComponent({
      id: "fixture_old",
      introduction: { fromMonth: "1880-01", obsoleteMonth: "1890-01" },
    });
    const part = present(buildFittingPartModel({ components: [def] }).records[0], "part").part;
    expect(part.lifecycle).toEqual({ availableFrom: "1880-01", availableUntil: "1890-01" });
    const design = present(designs[0], "a design");
    const obsoleteAt = (month: string) => {
      const ctx = { ...earlyContext(month), catalogue: [...components, def] };
      const draft: DesignDraft = {
        ...design.draft,
        placements: [{ ...fixturePlacement("fixture_old"), instanceId: "old" }],
      };
      const findings: Parameters<typeof resolveDesignComponents>[4] = [];
      const plant = present(
        ctx.plants.find((p) => p.id === draft.machinery.plantId),
        "plant",
      );
      resolveDesignComponents(
        draft,
        ctx,
        new Map(ctx.catalogue.map((c) => [c.id, c])),
        plant,
        findings,
      );
      return findings.some((f) => f.id === "COMPONENT_OBSOLETE");
    };
    expect(obsoleteAt("1889-12")).toBe(false);
    expect(obsoleteAt("1890-01")).toBe(true);
    const availableAt = (month: string) =>
      part.lifecycle.availableUntil == null || month < part.lifecycle.availableUntil;
    expect(availableAt("1889-12")).toBe(true);
    expect(availableAt("1890-01")).toBe(false);
  });

  it("the parts and entries do not depend on catalogue or placement order", () => {
    const reversed = buildFittingPartModel({ components: [...components].reverse() });
    expect(canonicalSerialize(reversed)).toBe(canonicalSerialize(fittingModel));
    const ids = fittingModel.records.map((r) => r.part.id);
    expect(ids).toEqual([...ids].sort(compareCodePoints));
  });
});

describe("gun and launcher crew, volume and footprint (ship-part-model 05 over 03–04)", () => {
  it("every gun placement's crew, volume and footprint equal the legacy resolved placement", () => {
    for (const row of gunPlacements) {
      const t = present(
        resolveRow(row).translation,
        `${row.design.id}:${row.placement.instanceId}`,
      );
      const legacy = legacyPlacement(row.design.id, row.placement.instanceId);
      const where = `${row.design.id}:${row.placement.instanceId}`;
      expect(t.quantityIssues, where).toEqual([]);
      expect(totalOf(t.quantities, "crew"), `${where} crew`).toBe(legacy.crew);
      expect(totalOf(t.quantities, "volumeLitre"), `${where} volume`).toBe(legacy.volumeLitre);
      expect(totalOf(t.quantities, "deckFootprintMm2"), `${where} footprint`).toBe(
        legacy.deckFootprintMm2,
      );
      expect(totalOf(t.quantities, "massKg"), `${where} mass`).toBe(legacy.weightKg);
      expect(totalOf(t.quantities, "costMicro"), `${where} cost`).toBe(legacy.costMicro);
      for (const id of ["crew_per_gun", "volume_per_gun", "deck_footprint_per_gun"]) {
        expect(line(t.quantities, id)).toMatchObject({
          scope: "mount",
          basis: "PER_CONTAINED_UNIT",
          multiplier: t.containedUnits,
        });
      }
    }
  });

  it("hand-works a D17 battery: 4 × 13 crew per gun on one BROADSIDE_BATTERY mount", () => {
    const def = present(
      components.find((c) => c.id === "gun_bl_209mm_gl20"),
      "gun_bl_209mm_gl20",
    );
    expect(def.crew).toBe("9 * barrels");
    const mount = present(
      buildGunMountPart({
        content: armamentContent,
        components,
        familyId: "gun_bl_209mm_gl20",
        legacyMountType: "TURRET",
        barrels: 4,
      }),
      "battery mount",
    );
    expect(mount.part.spec).toMatchObject({ mountType: "BROADSIDE_BATTERY", gunsPerMount: 4 });
    const lines = quantityLines(mount.part.quantities, "mount", mount.part.id, 1, 4);
    expect(line(lines, "crew_per_gun")).toMatchObject({
      value: 9,
      multiplier: 4,
      contribution: 36,
    });
  });

  it("every tube placement's crew, volume and footprint equal the legacy resolved placement", () => {
    expect(launcherModel.unread).toEqual([]);
    const tubeRows = designs.flatMap((design) =>
      design.draft.placements
        .filter((p) => categoryOf(p.componentId) === "TORPEDO_TUBE")
        .map((placement) => ({ design, placement })),
    );
    expect(tubeRows.length).toBe(33);
    for (const { design, placement } of tubeRows) {
      const profile = present(
        navalProfiles.find((p) => p.nationId === design.draft.nationId),
        "profile",
      );
      const t = present(
        translateTubePlacement({
          designId: design.id,
          placement,
          nationId: design.draft.nationId,
          model: launcherModel,
          appliedModels: catalogueForNation(components, profile, design.month).appliedModels,
        }).translation,
        placement.instanceId,
      );
      const legacy = legacyPlacement(design.id, placement.instanceId);
      expect(totalOf(t.quantities, "crew")).toBe(legacy.crew);
      expect(totalOf(t.quantities, "volumeLitre")).toBe(legacy.volumeLitre);
      expect(totalOf(t.quantities, "deckFootprintMm2")).toBe(legacy.deckFootprintMm2);
      expect(line(t.quantities, "tube_crew")).toMatchObject({ value: 3, basis: "PER_PART_UNIT" });
    }
  });

  it("no national override touches a quantity formula, so the base component is the ledger", () => {
    const quantityKeys = [
      "weightKg",
      "costMicro",
      "crew",
      "volumeLitre",
      "deckFootprintMm2",
      "constants",
    ];
    for (const profile of navalProfiles) {
      for (const v of [...profile.gunModels, ...profile.componentVariants]) {
        const touched = Object.keys(v.overrides).filter((k) =>
          quantityKeys.some((q) => k === q || k.startsWith(`${q}.`)),
        );
        expect(touched, v.id).toEqual([]);
      }
    }
  });

  it("an unreadable gun formula is a coded issue on the translation; a fixed tube term fails the launcher", () => {
    const gun = present(
      components.find((c) => c.id === "gun_rml_16in_80ton"),
      "gun_rml_16in_80ton",
    );
    expect(gun.parameters.barrels).toEqual({ min: 1, max: 6, step: 1 });
    const bent = components.map((c) => (c.id === gun.id ? { ...c, crew: "barrels * barrels" } : c));
    const mount = present(
      buildGunMountPart({
        content: armamentContent,
        components: bent,
        familyId: gun.id,
        legacyMountType: "TURRET",
        barrels: 2,
      }),
      "mount",
    );
    expect(mount.quantityIssues.map((i) => [i.componentId, i.field, i.code])).toEqual([
      [gun.id, "crew", "PART_READ_PATH_NONLINEAR_QUANTITY"],
    ]);
    expect(mount.part.quantities.some((q) => q.kind === "crew")).toBe(false);

    const tubeDefs = components.map((c) =>
      c.id === "tube_14in_submerged" ? { ...c, crew: "2 + 3 * tubes" } : c,
    );
    const launchers = buildLauncherPartModel({
      components: tubeDefs,
      profiles: navalProfiles,
      torpedoDiameterUm,
    });
    expect(launchers.unread.map((u) => [u.id, u.code])).toEqual([
      ["tube_14in_submerged", "PART_READ_PATH_UNREADABLE_QUANTITY"],
    ]);
  });
});

describe("propulsion plants as parametric parts (ship-part-model 05)", () => {
  it("reads the six plants with installed power as their one parameter and no quantity components", () => {
    expect(plantModel.unread).toEqual([]);
    expect(plantModel.parts.map((p) => p.id)).toEqual([
      "compound_cylindrical",
      "compound_locomotive_tb",
      "hp_steam_geared_turbine",
      "locomotive_boiler_tb",
      "triple_expansion_cylindrical",
      "triple_expansion_watertube",
    ]);
    for (const part of plantModel.parts) {
      const plant = present(
        plants.find((p) => p.id === part.id),
        part.id,
      );
      expect(part.parameters).toEqual({
        installedKw: { min: plant.minKw, max: plant.maxKw, step: 1 },
      });
      expect(part.quantities).toEqual([]);
      expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
    }
  });

  it("each plant part reads back to exactly the legacy plant record", () => {
    for (const plant of plants) {
      const part = present(
        plantModel.parts.find((p) => p.id === plant.id),
        plant.id,
      );
      expect(propulsionPlantFromPart(part)).toEqual(plant);
    }
  });

  it("every design's machinery is one entry in its zone's plant slot with installedKw", () => {
    for (const design of designs) {
      const m = design.draft.machinery;
      const t = present(
        translateMachinery({ designId: design.id, machinery: m, model: plantModel }).translation,
        design.id,
      );
      expect(t.entry).toEqual({
        slot: `${m.zoneId.toLowerCase()}.propulsion_plant`,
        part: m.plantId,
        mountCount: 1,
        stationPermille: m.stationPermille,
        params: { installedKw: m.installedKw },
      });
      const slot = present(
        platformSlots(compatibility, design.draft.hull.hullFormId)?.find(
          (s) => s.id === t.entry.slot,
        ),
        `${design.id} plant slot`,
      );
      expect(slot.accepts).toEqual(["propulsion_plant"]);
      expect(machineryPlanFromEntry(t, present(slot.zone, "zone"))).toEqual(m);
    }
  });

  it("an undated plant, a non-integer power and an unknown plant are reported", () => {
    const undated: PropulsionPlant = { ...present(plants[0], "plant"), id: "undated" };
    const { introduction: _drop, ...noIntro } = undated;
    const model = buildPlantPartModel({ plants: [noIntro] });
    expect(model.unread.map((u) => [u.id, u.code])).toEqual([
      ["undated", "PART_READ_PATH_INVALID_LIFECYCLE"],
    ]);
    const m = present(designs[0], "design").draft.machinery;
    expect(
      translateMachinery({
        designId: "d",
        machinery: { ...m, installedKw: 1000.5 },
        model: plantModel,
      }).untranslated?.code,
    ).toBe("PART_READ_PATH_INVALID_INSTALLED_POWER");
    expect(
      translateMachinery({
        designId: "d",
        machinery: { ...m, plantId: "steam_turbine" },
        model: plantModel,
      }).untranslated?.code,
    ).toBe("PART_READ_PATH_NO_PLANT_PART");
  });

  it("the parts do not depend on the plant order", () => {
    expect(canonicalSerialize(buildPlantPartModel({ plants: [...plants].reverse() }))).toBe(
      canonicalSerialize(plantModel),
    );
  });
});

describe("armour materials out of the balance tables (ship-part-model 05)", () => {
  it("reads the eight materials with efficiency, dates and technology from the balance", () => {
    expect(armourModel.unread).toEqual([]);
    expect(armourModel.parts.map((p) => [p.id, p.spec.efficiencyBp, p.lifecycle])).toEqual([
      [
        "compound",
        13_000,
        { availableFrom: "1886-01", availableUntil: "1889-01", requires: ["hc_compound_armor"] },
      ],
      [
        "harvey",
        19_500,
        { availableFrom: "1892-01", availableUntil: null, requires: ["hc_harvey_armor"] },
      ],
      ["iron", 10_000, { availableFrom: "1880-01", availableUntil: null }],
      [
        "krupp",
        23_000,
        { availableFrom: "1900-01", availableUntil: null, requires: ["hc_krupp_cemented_armor"] },
      ],
      ["mild_steel", 13_000, { availableFrom: "1880-01", availableUntil: null }],
      [
        "nickel_steel",
        13_500,
        { availableFrom: "1889-01", availableUntil: null, requires: ["hc_nickel_steel_armor"] },
      ],
      ["steel", 13_000, { availableFrom: "1880-01", availableUntil: null }],
      ["wrought_iron", 10_000, { availableFrom: "1880-01", availableUntil: null }],
    ]);
    for (const part of armourModel.parts) {
      expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
    }
  });

  it("availability and efficiency from the parts give the same options and findings as today", () => {
    const fromParts = armourBalanceFromParts(shipBalance.armour, armourModel.parts);
    expect(fromParts.materialEffBp).toEqual(shipBalance.armour.materialEffBp);
    const techSets = [
      new Set<string>(),
      new Set(armourModel.parts.flatMap((p) => p.lifecycle.requires ?? [])),
    ];
    const regions: ArmourRegion[] = armourModel.parts.map((p) => ({
      region: "BELT_MAIN",
      thicknessUm: 100_000,
      lengthMm: 50_000,
      heightMm: 2_000,
      materialId: p.id,
      cosObliquityBp: 10_000,
    }));
    for (const month of [
      "1879-12",
      "1880-01",
      "1885-12",
      "1886-01",
      "1888-12",
      "1889-01",
      "1892-01",
      "1900-01",
    ]) {
      for (const techs of techSets) {
        expect(armourMaterialOptions(fromParts, month, techs), month).toEqual(
          armourMaterialOptions(shipBalance.armour, month, techs),
        );
        expect(armourAvailabilityFindings(regions, fromParts, month, techs), month).toEqual(
          armourAvailabilityFindings(regions, shipBalance.armour, month, techs),
        );
      }
    }
  });

  it("compound is obsolete from 1889-01 (exclusive), the same month the balance blocks it", () => {
    const compound = present(
      armourModel.parts.find((p) => p.id === "compound"),
      "compound",
    );
    expect(compound.lifecycle.availableUntil).toBe("1889-01");
    const fromParts = armourBalanceFromParts(shipBalance.armour, armourModel.parts);
    const obsolete = (month: string) =>
      armourMaterialOptions(fromParts, month, new Set(["hc_compound_armor"])).find(
        (o) => o.id === "compound",
      )?.obsolete;
    expect(obsolete("1888-12")).toBe(false);
    expect(obsolete("1889-01")).toBe(true);
  });

  it("every design's armour region is one entry in its armour-region slot, reading back unchanged", () => {
    let count = 0;
    for (const design of designs) {
      const slots = platformSlots(compatibility, design.draft.hull.hullFormId) ?? [];
      design.draft.armour.regions.forEach((region, index) => {
        count += 1;
        const t = present(
          translateArmourRegion({ designId: design.id, index, region, model: armourModel })
            .translation,
          `${design.id} region ${index}`,
        );
        const slot = present(
          slots.find((s) => s.id === t.entry.slot),
          `${design.id} ${t.entry.slot}`,
        );
        expect(slot.accepts).toEqual(["armour_material"]);
        expect(slot.region).toBe(region.region);
        expect(t.entry.part).toBe(region.materialId);
        expect(armourRegionFromEntry(t.entry, present(slot.region, "region"))).toEqual(region);
      });
    }
    expect(count).toBeGreaterThan(0);
  });

  it("an undated material, a plate limit, an unknown material and an impossible plate are reported", () => {
    const base: Pick<ArmourBalance, "materialEffBp" | "materialAvailability"> = {
      materialEffBp: { undated: 10_000, capped: 12_000, sterile: 0 },
      materialAvailability: {
        capped: { fromMonth: "1880-01", maxThicknessUm: 300_000 },
        sterile: { fromMonth: "1880-01" },
        orphan: { fromMonth: "1880-01" },
      },
    };
    expect(buildArmourPartModel({ armour: base }).unread.map((u) => [u.id, u.code])).toEqual([
      ["capped", "PART_READ_PATH_UNSUPPORTED_MAX_THICKNESS"],
      ["orphan", "PART_READ_PATH_NO_MATERIAL_EFFICIENCY"],
      ["sterile", "PART_READ_PATH_INVALID_SPEC"],
      ["undated", "PART_READ_PATH_NO_MATERIAL_AVAILABILITY"],
    ]);
    const region: ArmourRegion = {
      region: "DECK_MAIN",
      thicknessUm: 25_000,
      lengthMm: 40_000,
      heightMm: 10_000,
      materialId: "iron",
      cosObliquityBp: 10_000,
    };
    const at = (r: ArmourRegion) =>
      translateArmourRegion({ designId: "d", index: 0, region: r, model: armourModel }).untranslated
        ?.code;
    expect(at(region)).toBeUndefined();
    expect(at({ ...region, materialId: "unobtainium" })).toBe("PART_READ_PATH_NO_ARMOUR_MATERIAL");
    expect(at({ ...region, thicknessUm: 0 })).toBe("PART_READ_PATH_INVALID_ARMOUR_SHAPE");
    expect(at({ ...region, cosObliquityBp: 12_000 })).toBe("PART_READ_PATH_INVALID_ARMOUR_SHAPE");
  });

  it("the parts do not depend on the balance-table order", () => {
    const reorder = <T>(r: Readonly<Record<string, T>>) =>
      Object.fromEntries(Object.entries(r).reverse());
    const reversed = buildArmourPartModel({
      armour: {
        materialEffBp: reorder(shipBalance.armour.materialEffBp),
        materialAvailability: reorder(shipBalance.armour.materialAvailability ?? {}),
      },
    });
    expect(canonicalSerialize(reversed)).toBe(canonicalSerialize(armourModel));
  });
});

describe("ammunition patterns as parts (ship-part-model 05)", () => {
  it("reads the seven patterns as national ammunition parts", () => {
    expect(ammunitionModel.unread).toEqual([]);
    expect(
      ammunitionModel.records.map((r) => [r.part.id, r.part.nation, r.part.spec.shellType]),
    ).toEqual([
      ["de_ap_krupp", "germany", "AP"],
      ["de_he_common", "germany", "HE"],
      ["fr_apc", "france", "APC"],
      ["fr_melinite_he", "france", "MELINITE"],
      ["uk_ap_palliser", "uk", "AP"],
      ["uk_cpc", "uk", "CPC"],
      ["uk_he_45in_45", "uk", "HE"],
    ]);
    for (const { part } of ammunitionModel.records) {
      expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
    }
  });

  it("each part reads back to exactly the resolver's ammunition pattern", () => {
    const domain = buildArmamentCatalogue(armamentContent).ammunition;
    for (const pattern of domain) {
      const record = present(
        ammunitionModel.records.find((r) => r.part.id === String(pattern.id)),
        String(pattern.id),
      );
      expect(ammunitionPatternFromPart(record)).toEqual(pattern);
    }
    expect(domain.length).toBe(ammunitionModel.records.length);
  });

  it("selection facts stay adapter-side: a family list on the part fails the strict decode", () => {
    const record = present(ammunitionModel.records[0], "a pattern");
    expect(record.legacy.compatibleGunFamilies?.length).toBeGreaterThan(0);
    expect(
      decodeStrictResult(FlattenedPartSchema, {
        ...record.part,
        compatibleGunFamilies: record.legacy.compatibleGunFamilies,
      })._tag,
    ).toBe("Failure");
  });

  it("an inclusive retirement month becomes an exclusive end one month later, and back", () => {
    const source = present(armamentContent.ammunition[0], "a pattern");
    const model = buildAmmunitionPartModel({
      ammunition: [{ ...source, retirementMonth: "1885-12" }],
    });
    const record = present(model.records[0], "record");
    expect(record.part.lifecycle.availableUntil).toBe("1886-01");
    expect(ammunitionPatternFromPart(record).retirementMonth).toBe("1885-12");
    const bad = buildAmmunitionPartModel({
      ammunition: [
        { ...source, id: "no_intro", introductionMonth: undefined },
        { ...source, id: "bad_end", retirementMonth: "1885-13" },
        { ...source, id: "inverted", introductionMonth: "1890-01", retirementMonth: "1885-01" },
      ],
    });
    expect(bad.records).toEqual([]);
    expect(bad.unread.map((u) => [u.id, u.code])).toEqual([
      ["bad_end", "PART_READ_PATH_INVALID_LIFECYCLE"],
      ["inverted", "PART_READ_PATH_INVALID_LIFECYCLE"],
      ["no_intro", "PART_READ_PATH_INVALID_LIFECYCLE"],
    ]);
  });
});

describe("whole designs through the read path (ship-part-model 05)", () => {
  it("every design's full loadout decodes on its platform, one entry per placement, region and plant", () => {
    for (const design of designs) {
      const loadout = designLoadout(design);
      expect(loadout.entries.length, design.id).toBe(
        design.draft.placements.length + 1 + design.draft.armour.regions.length,
      );
      expect(decodeStrict(LoadoutSchema, loadout), design.id).toEqual(loadout);
      const slots = new Map(
        (platformSlots(compatibility, loadout.platform) ?? []).map((s) => [s.id, s]),
      );
      for (const entry of loadout.entries) {
        expect(decodeStrict(LoadoutEntrySchema, entry)).toEqual(entry);
        expect(slots.has(entry.slot), `${design.id} ${entry.slot}`).toBe(true);
      }
    }
  });

  it("compiling with plants and armour materials from parts is byte-identical for every design", () => {
    const partPlants = plantModel.parts.map(propulsionPlantFromPart);
    for (const design of designs) {
      const ctx = earlyContext(design.month);
      const fromParts = {
        ...ctx,
        plants: partPlants,
        balance: {
          ...ctx.balance,
          armour: armourBalanceFromParts(ctx.balance.armour, armourModel.parts),
        },
      };
      const machinery = present(
        translateMachinery({
          designId: design.id,
          machinery: design.draft.machinery,
          model: plantModel,
        }).translation,
        design.id,
      );
      const slots = platformSlots(compatibility, design.draft.hull.hullFormId) ?? [];
      const slotOf = (id: string) =>
        present(
          slots.find((s) => s.id === id),
          `${design.id} ${id}`,
        );
      const regions = design.draft.armour.regions.map((region, index) => {
        const t = present(
          translateArmourRegion({ designId: design.id, index, region, model: armourModel })
            .translation,
          `${design.id} region ${index}`,
        );
        return armourRegionFromEntry(t.entry, present(slotOf(t.entry.slot).region, "region"));
      });
      const draft: DesignDraft = {
        ...design.draft,
        machinery: machineryPlanFromEntry(
          machinery,
          present(slotOf(machinery.entry.slot).zone, "zone"),
        ),
        armour: { ...design.draft.armour, regions },
      };
      expect(draft, design.id).toEqual(design.draft);
      expect(compileDesign(draft, fromParts).hash, design.id).toBe(
        compileDesign(design.draft, ctx).hash,
      );
    }
  });

  it("translating twice gives byte-identical parts and entries", () => {
    const again = {
      fittings: buildFittingPartModel({ components }),
      plants: buildPlantPartModel({ plants }),
      armour: buildArmourPartModel({ armour: shipBalance.armour }),
      ammunition: buildAmmunitionPartModel({ ammunition: armamentContent.ammunition }),
    };
    expect(canonicalSerialize(again)).toBe(
      canonicalSerialize({
        fittings: fittingModel,
        plants: plantModel,
        armour: armourModel,
        ammunition: ammunitionModel,
      }),
    );
    const first = present(designs[0], "design");
    expect(canonicalSerialize(designLoadout(first))).toBe(canonicalSerialize(designLoadout(first)));
  });
});
