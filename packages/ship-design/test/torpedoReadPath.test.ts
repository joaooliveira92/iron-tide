import {
  FlattenedPartSchema,
  LoadoutEntrySchema,
  LoadoutSchema,
  decodeStrict,
  decodeStrictResult,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { num } from "../src/compileShared.js";
import { buildLauncherPartModel, translateTubePlacement } from "../src/torpedoPartAdapter.js";
import { catalogueForNation } from "../src/componentVariants.js";
import { platformSlots } from "../src/partCompatibility.js";
import { type ComponentDef, type NationNavalProfile, type PlacementSpec } from "../src/index.js";
import { totalOf } from "../src/partQuantities.js";
import {
  type FlattenedLauncherPart,
  type LauncherPartModel,
  type TubePlacementTranslation,
} from "../src/torpedoPartAdapter.js";
import { components, navalProfiles } from "./helpers/earlyContext.js";
import {
  compatibility,
  designs,
  gunPlacements,
  present,
  resolveRow,
  type Design,
} from "./helpers/gunReadPath.js";
import { torpedoDiameterUm } from "./helpers/torpedoModels.js";

const launcherModel = (
  profiles: readonly NationNavalProfile[] = navalProfiles,
  defs: readonly ComponentDef[] = components,
): LauncherPartModel => buildLauncherPartModel({ components: defs, profiles, torpedoDiameterUm });

const model = launcherModel();

interface TubeRow {
  readonly design: Design;
  readonly placement: PlacementSpec;
}

const tubeRows: readonly TubeRow[] = designs.flatMap((design) =>
  design.draft.placements
    .filter((p) => components.find((c) => c.id === p.componentId)?.category === "TORPEDO_TUBE")
    .map((placement) => ({ design, placement })),
);

const profileOf = (nationId: string): NationNavalProfile =>
  present(
    navalProfiles.find((p) => p.nationId === nationId),
    `naval profile ${nationId}`,
  );

const whereTube = (row: TubeRow) => `${row.design.id}:${row.placement.instanceId}`;

function translate(row: TubeRow, launchers: LauncherPartModel = model, profiles = navalProfiles) {
  const nationId = row.design.draft.nationId;
  const profile = present(
    profiles.find((p) => p.nationId === nationId),
    `naval profile ${nationId}`,
  );
  return translateTubePlacement({
    designId: row.design.id,
    placement: row.placement,
    nationId,
    model: launchers,
    appliedModels: catalogueForNation(components, profile, row.design.month).appliedModels,
  });
}

const translated: readonly { row: TubeRow; t: TubePlacementTranslation }[] = tubeRows.map(
  (row) => ({ row, t: present(translate(row).translation, whereTube(row)) }),
);

function legacyValue(row: TubeRow, field: "weightKg" | "costMicro"): number {
  const nation = profileOf(row.design.draft.nationId);
  const def = present(
    catalogueForNation(components, nation, row.design.month).catalogue.find(
      (c) => c.id === row.placement.componentId,
    ),
    `catalogue entry ${row.placement.componentId}`,
  );
  const params: Record<string, number> = {};
  for (const [name, range] of Object.entries(def.parameters)) {
    params[name] = row.placement.params?.[name] ?? range.min;
  }
  return num(def[field], { ...def.constants, ...params });
}

const partById = (id: string): FlattenedLauncherPart =>
  present(
    model.parts.find((p) => p.id === id),
    `launcher ${id}`,
  );

const WAIVED_VARIANTS = [
  "de_tube_450_aw",
  "de_tube_450_sub",
  "fr_tube_350mm_sub",
  "fr_tube_380mm_aw",
  "ru_tube_381_aw",
];

describe("torpedo launchers through the read path (ship-part-model 04)", () => {
  it("covers the 31 tube placements, none of them defaulted", () => {
    expect(tubeRows.length).toBe(31);
    expect(model.unread).toEqual([]);
    for (const { row, t } of translated) {
      expect(t.defaulted, whereTube(row)).toBe(false);
      expect(t.legacyTubes, whereTube(row)).toBe(row.placement.params?.tubes);
    }
  });

  it("mountCount, launcher count, launcher mass and cost equal the legacy result per placement", () => {
    for (const { row, t } of translated) {
      expect(t.mountCount, whereTube(row)).toBe(row.placement.params?.tubes);
      expect(t.entry.mountCount, whereTube(row)).toBe(t.mountCount);
      expect(totalOf(t.quantities, "massKg"), `${whereTube(row)} mass`).toBe(
        legacyValue(row, "weightKg"),
      );
      expect(totalOf(t.quantities, "costMicro"), `${whereTube(row)} cost`).toBe(
        legacyValue(row, "costMicro"),
      );
      for (const q of t.quantities) {
        expect(q.basis, `${whereTube(row)} ${q.id}`).toBe("PER_PART_UNIT");
        expect(q.multiplier).toBe(t.mountCount);
      }
    }
  });

  it("keeps the legacy component ids as the base launchers, loading the 356 mm Whitehead", () => {
    const bases = model.parts.filter((p) => p.origin.prototype === undefined);
    expect(bases.map((p) => p.id)).toEqual([
      "tube_14in_above_water",
      "tube_14in_submerged",
      "tube_21in_above_water",
    ]);
    for (const base of bases.filter((p) => p.id.startsWith("tube_14in"))) {
      expect(base.spec.boreDiameterUm).toBe(356_000);
      expect(base.slots).toEqual([
        { id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } },
      ]);
      expect(base.legacyExceptions).toBeUndefined();
      expect(base.provenance.sourceStatus).toBe("PLACEHOLDER");
    }
  });

  it("reads 17 national variants (the proposal's 15 plus Spain and the USA) and 5 waivers", () => {
    const variants = model.parts.filter((p) => p.origin.prototype !== undefined);
    expect(variants.map((p) => p.id)).toEqual([
      "ah_tube_350_aw",
      "br_tube_356_aw",
      "de_tube_450_aw",
      "de_tube_450_sub",
      "es_tube_356_aw",
      "fr_tube_350mm_sub",
      "fr_tube_380mm_aw",
      "it_tube_350_aw",
      "jp_tube_350_aw",
      "nl_tube_356_aw",
      "ot_tube_356_aw",
      "pt_tube_356_aw",
      "qing_tube_356_aw",
      "ru_tube_381_aw",
      "uk_tube_14in_aw_mk4",
      "uk_tube_14in_sub_mk4",
      "us_tube_14in_aw",
    ]);
    for (const variant of variants) {
      const nation = present(variant.nation, `${variant.id} nation`);
      expect(variant.spec.boreDiameterUm, variant.id).toBe(
        profileOf(nation).hardCapabilities.domesticTorpedoDiameterUm,
      );
      expect(variant.origin.sourceFile).toBe(`ship-building/naval-profiles/${nation}.yaml`);
      expect(variant.origin.prototype?.inheritedSpec).toEqual(["launchType"]);
    }
    expect(variants.filter((v) => v.legacyExceptions !== undefined).map((v) => v.id)).toEqual(
      WAIVED_VARIANTS,
    );
    for (const id of WAIVED_VARIANTS) {
      expect(partById(id).legacyExceptions).toEqual([
        expect.objectContaining({
          code: "DQ-TORPEDO-001",
          waives: "diameterUmEqualsBore",
          forPart: "whitehead_14in_1886",
        }),
      ]);
    }
  });

  it("the waivers cover exactly the nine French, German and Russian tube entries (§9.4)", () => {
    const waived = translated
      .filter(({ t }) => t.launcherPart.legacyExceptions !== undefined)
      .map(({ row, t }) => `${whereTube(row)}:${t.launcherPart.id}`)
      .sort(compareCodePoints);
    expect(waived).toEqual([
      "redoutable_1878:tubes:fr_tube_380mm_aw",
      "starter_armed_liner_de_1880:tubes:de_tube_450_aw",
      "starter_armed_liner_fr_1880:tubes:fr_tube_380mm_aw",
      "starter_dd_russia_1880:tubes:ru_tube_381_aw",
      "starter_protected_cruiser_de_1880:tubes:de_tube_450_aw",
      "starter_protected_cruiser_fr_1880:tubes:fr_tube_380mm_aw",
      "starter_torpedo_gunboat_fr_1880:tubes_p:fr_tube_380mm_aw",
      "starter_torpedo_gunboat_fr_1880:tubes_s:fr_tube_380mm_aw",
      "starter_torpedoboat_de_1880:tubes:de_tube_450_aw",
    ]);
  });

  it("every entry uses the launcher its nation's catalogue overlays today", () => {
    for (const { row, t } of translated) {
      const applied = catalogueForNation(
        components,
        profileOf(row.design.draft.nationId),
        row.design.month,
      ).appliedModels[row.placement.componentId];
      expect(t.launcherPart.id, whereTube(row)).toBe(applied ?? row.placement.componentId);
      expect(t.launcherPart.origin.prototype?.id ?? t.launcherPart.id).toBe(
        row.placement.componentId,
      );
    }
  });

  it("engineering dimensions come from structured fields, never the display label", () => {
    for (const id of ["ah_tube_350_aw", "it_tube_350_aw", "jp_tube_350_aw"]) {
      expect(partById(id).spec.boreDiameterUm, id).toBe(356_000);
      expect(partById(id).legacyExceptions, id).toBeUndefined();
    }
    expect(partById("fr_tube_350mm_sub").name).toContain("350 mm");
    expect(partById("fr_tube_350mm_sub").spec.boreDiameterUm).toBe(380_000);
  });

  it("changing only a variant's display name changes no compatibility or derived value", () => {
    const relabelled = navalProfiles.map((p) => ({
      ...p,
      componentVariants: p.componentVariants.map((v) => ({
        ...v,
        designation: `${v.designation} (renamed)`,
        overrides: { ...v.overrides, displayName: "Renamed tube" },
      })),
    }));
    const renamed = launcherModel(relabelled);
    const withoutName = (parts: readonly FlattenedLauncherPart[]) =>
      parts.map(({ name: _name, ...rest }) => rest);
    expect(withoutName(renamed.parts)).toEqual(withoutName(model.parts));
    for (const { row, t } of translated) {
      const again = present(translate(row, renamed, relabelled).translation, whereTube(row));
      expect(again.entry).toEqual(t.entry);
      expect(again.quantities).toEqual(t.quantities);
    }
  });

  describe("strict content-schema boundary", () => {
    it("every launcher part decodes unchanged through FlattenedPartSchema", () => {
      for (const part of model.parts) {
        expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
      }
    });

    it("every design's gun and tube entries decode as one loadout on its platform", () => {
      for (const design of designs) {
        const entries = [
          ...gunPlacements
            .filter((g) => g.design.id === design.id)
            .map((g) => present(resolveRow(g).translation, `${design.id} gun`).entry),
          ...translated.filter(({ row }) => row.design.id === design.id).map(({ t }) => t.entry),
        ];
        const loadout = { platform: design.draft.hull.hullFormId, entries };
        expect(decodeStrict(LoadoutSchema, loadout), design.id).toEqual(loadout);
        const slots = platformSlots(compatibility, design.draft.hull.hullFormId) ?? [];
        for (const entry of entries) {
          expect(decodeStrict(LoadoutEntrySchema, entry)).toEqual(entry);
          expect(
            slots.some((s) => s.id === entry.slot),
            `${design.id} ${entry.slot}`,
          ).toBe(true);
        }
      }
      for (const { t } of translated) {
        expect(t.entry.slot.endsWith(".torpedo_launcher")).toBe(true);
      }
    });

    it("a waiver naming another constraint, or on a non-launcher record, fails decoding", () => {
      const waived = partById("fr_tube_380mm_aw");
      const exception = present(waived.legacyExceptions?.[0], "the French waiver");
      expect(
        decodeStrictResult(FlattenedPartSchema, {
          ...waived,
          legacyExceptions: [{ ...exception, waives: "diameterUmMax" }],
        })._tag,
      ).toBe("Failure");
      const gun = present(gunPlacements[0], "a gun placement");
      const gunPart = present(resolveRow(gun).translation, "a gun translation").gunPart;
      expect(
        decodeStrictResult(FlattenedPartSchema, { ...gunPart, legacyExceptions: [exception] })._tag,
      ).toBe("Failure");
    });
  });

  describe("tube counts (I-23, T1–T4)", () => {
    const row = present(tubeRows[0], "a tube placement");
    const withTubes = (params: Record<string, number>): TubeRow => ({
      ...row,
      placement: { ...row.placement, params },
    });

    it("an absent count translates explicitly to mountCount 1", () => {
      const t = present(translate(withTubes({})).translation, "a translation");
      expect(t.defaulted).toBe(true);
      expect(t.legacyTubes).toBeNull();
      expect(t.mountCount).toBe(1);
      expect(t.entry.mountCount).toBe(1);
    });

    it.each([0, -2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "tubes = %s fails translation with a diagnostic",
      (tubes) => {
        const result = translate(withTubes({ tubes }));
        expect(result.translation).toBeNull();
        expect(result.untranslated).toMatchObject({
          designId: row.design.id,
          instanceId: row.placement.instanceId,
          code: "PART_READ_PATH_INVALID_TUBE_COUNT",
        });
      },
    );

    it("no multi-tube launcher is inferred from adjacent placements", () => {
      const pair = translated.filter(
        ({ row: r }) => r.design.id === "starter_torpedo_gunboat_fr_1880",
      );
      expect(pair.map(({ t }) => [t.instanceId, t.entry.side, t.mountCount])).toEqual([
        ["tubes_p", "PORT", 2],
        ["tubes_s", "STBD", 2],
      ]);
      for (const part of model.parts) {
        expect(Object.keys(part.spec).sort(compareCodePoints)).toEqual([
          "boreDiameterUm",
          "launchType",
        ]);
      }
    });
  });

  describe("read failures and determinism", () => {
    it("a launcher whose torpedo has no structured diameter is reported, not guessed", () => {
      const unknownTorpedo = buildLauncherPartModel({
        components,
        profiles: navalProfiles,
        torpedoDiameterUm: () => undefined,
      });
      expect(unknownTorpedo.parts).toEqual([]);
      expect(unknownTorpedo.unread.map((u) => [u.id, u.code])).toEqual([
        ["tube_14in_above_water", "PART_READ_PATH_NO_TORPEDO_DIAMETER"],
        ["tube_14in_submerged", "PART_READ_PATH_NO_TORPEDO_DIAMETER"],
        ["tube_21in_above_water", "PART_READ_PATH_NO_TORPEDO_DIAMETER"],
      ]);
    });

    it("a launch type outside the closed set is reported", () => {
      const defs = components.map((c) =>
        c.id === "tube_14in_submerged" && c.torpedoMount !== undefined
          ? { ...c, torpedoMount: { ...c.torpedoMount, mountType: "SIDEWAYS" } }
          : c,
      );
      expect(launcherModel(navalProfiles, defs).unread).toEqual([
        expect.objectContaining({
          id: "tube_14in_submerged",
          code: "PART_READ_PATH_UNKNOWN_LAUNCH_TYPE",
        }),
      ]);
    });

    it("an exclusive component obsoleteMonth copies unchanged to availableUntil", () => {
      const defs = components.map((c) =>
        c.id === "tube_14in_above_water"
          ? { ...c, introduction: { ...c.introduction, obsoleteMonth: "1890-01" } }
          : c,
      );
      const retired = launcherModel(navalProfiles, defs);
      for (const part of retired.parts) {
        const base = part.origin.prototype?.id ?? part.id;
        expect(part.lifecycle.availableUntil, part.id).toBe(
          base === "tube_14in_above_water" ? "1890-01" : null,
        );
        expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
      }
    });

    it("the parts do not depend on profile or component order", () => {
      const shuffled = launcherModel([...navalProfiles].reverse(), [...components].reverse());
      const view = (m: LauncherPartModel) =>
        canonicalSerialize({ parts: m.parts, unread: m.unread, variants: [...m.variantNation] });
      expect(view(shuffled)).toBe(view(model));
    });
  });
});
