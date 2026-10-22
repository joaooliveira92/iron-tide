import { FlattenedPartSchema, PART_TAGS, decodeStrict } from "@bluewave/content-schema";
import type { FlattenedPart, SlotData } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { buildArmourPartModel } from "../src/armourPartAdapter.js";
import { buildFittingPartModel } from "../src/fittingPartAdapter.js";
import { buildLauncherPartModel } from "../src/torpedoPartAdapter.js";
import { buildPartCatalogue, type ComponentDef, type SourceCatalogue } from "../src/index.js";
import { buildPlantPartModel } from "../src/plantPartAdapter.js";
import { readMachineryPlan, readPlacements, rebuildDraft } from "../src/partCatalogueReaders.js";
import { type BuiltPartCatalogue } from "../src/partCatalogue.js";
import { PART_SOURCE_FIELDS } from "../src/partCatalogue.js";
import {
  armamentContent,
  components,
  navalProfiles,
  plants,
  shipBalance,
} from "./helpers/earlyContext.js";
import { compatibility, designs, present, resolveRow } from "./helpers/gunReadPath.js";
import { torpedoDiameterUm, torpedoModels } from "./helpers/torpedoModels.js";

const source: SourceCatalogue = {
  components,
  plants,
  armour: shipBalance.armour,
  armament: armamentContent,
  profiles: navalProfiles,
  tagVocabulary: PART_TAGS,
  torpedoDiameterUm,
  torpedoModels,
};

const built: BuiltPartCatalogue = buildPartCatalogue(source);

const GUN = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);

describe("whole-catalogue part builder (11b)", () => {
  it("produces no failures over the current content", () => {
    expect(built.failures).toEqual([]);
  });

  it("gives every generated part a strict round trip through FlattenedPartSchema", () => {
    for (const part of built.parts) {
      expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
    }
  });

  it("covers every buildable gun model: each family's standard model and every authored/catalogue model", () => {
    const gunIds = new Set(built.parts.filter((p) => p.family === "gun").map((p) => p.id));
    for (const family of armamentContent.gunFamilies) {
      expect(gunIds.has(`standard_${family.id}`), `standard_${family.id}`).toBe(true);
    }
    for (const model of armamentContent.gunModels) {
      expect(gunIds.has(model.id), model.id).toBe(true);
    }
    for (const profile of navalProfiles) {
      for (const model of profile.gunModels) {
        expect(gunIds.has(model.id), model.id).toBe(true);
      }
    }
  });

  it("covers every mount: every family has a mount part and every authored mount is a part", () => {
    const mounts = built.parts.filter((p) => p.family === "gun_mount");
    const familiesWithMount = new Set(mounts.flatMap((p) => p.spec.compatibleGunFamilies ?? []));
    for (const family of armamentContent.gunFamilies) {
      expect(familiesWithMount.has(family.id), `no mount for ${family.id}`).toBe(true);
    }
    const mountIds = new Set(mounts.map((p) => p.id));
    const compiledIds = new Set(
      mounts.map((p) => (p.spec as { compiledMountId?: string }).compiledMountId).filter(Boolean),
    );
    for (const record of armamentContent.gunMounts) {
      expect(
        mountIds.has(record.id) || compiledIds.has(record.id),
        `authored mount ${record.id}`,
      ).toBe(true);
    }
  });

  it("covers every ammunition pattern, launcher variant, plant, armour material and fitting", () => {
    const ids = new Set(built.parts.map((p) => p.id));
    for (const a of armamentContent.ammunition) expect(ids.has(a.id), a.id).toBe(true);
    for (const p of buildLauncherPartModel({
      components,
      profiles: navalProfiles,
      torpedoDiameterUm,
    }).parts) {
      expect(ids.has(p.id), p.id).toBe(true);
    }
    for (const p of buildPlantPartModel({ plants }).parts) expect(ids.has(p.id), p.id).toBe(true);
    for (const p of buildArmourPartModel({ armour: shipBalance.armour }).parts) {
      expect(ids.has(p.id), p.id).toBe(true);
    }
    for (const r of buildFittingPartModel({ components }).records) {
      expect(ids.has(r.part.id), r.part.id).toBe(true);
    }
  });

  it("documents one destination per source field and rejects an unmapped one", () => {
    expect(PART_SOURCE_FIELDS.length).toBeGreaterThan(0);
    expect(new Set(PART_SOURCE_FIELDS.map((f) => `${f.record}.${f.field}`)).size).toBe(
      PART_SOURCE_FIELDS.length,
    );
    expect(built.inventory.unmappedFieldsFound).toBe(0);
  });

  it("is deterministic: input order does not change the parts or their ids", () => {
    const shuffled: SourceCatalogue = {
      ...source,
      components: [...components].reverse(),
      armament: {
        gunFamilies: [...armamentContent.gunFamilies].reverse(),
        gunModels: [...armamentContent.gunModels].reverse(),
        gunMounts: [...armamentContent.gunMounts].reverse(),
        ammunition: [...armamentContent.ammunition].reverse(),
      },
      profiles: [...navalProfiles].reverse(),
    };
    expect(canonicalSerialize(buildPartCatalogue(shuffled).parts)).toBe(
      canonicalSerialize(built.parts),
    );
  });

  it("is byte-identical across builds", () => {
    expect(canonicalSerialize(buildPartCatalogue(source))).toBe(canonicalSerialize(built));
  });

  it("fails with PARTCAT_DUPLICATE_ID when one id is generated twice with different content", () => {
    const base = components.find((c) => c.id === "quarters_crew")!;
    const variant = { ...base, displayName: `${base.displayName} variant`, weightKg: "10000" };
    const dup = buildPartCatalogue({ ...source, components: [...components, variant] });
    expect(dup.failures.map((f) => f.code)).toContain("PARTCAT_DUPLICATE_ID");
  });

  it("prints a catalogue hash for cross-process comparison", () => {
    const digest = sha256Hex(canonicalSerialize(built.parts));
    console.log(`PART_CATALOGUE_SHA256 ${digest}`);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("derive-input homes map through the whole-catalogue builder (17a-2)", () => {
  const withComponent = (overrides: Partial<ComponentDef>): BuiltPartCatalogue =>
    buildPartCatalogue({
      ...source,
      components: components.map((c) => (c.id === "quarters_crew" ? { ...c, ...overrides } : c)),
    });
  const partOf = (r: BuiltPartCatalogue): FlattenedPart | undefined =>
    r.parts.find((p) => p.id === "quarters_crew");

  it("maps allowedZones, buildWorkMicro, productionLine and flammableBp to typed homes", () => {
    const r = withComponent({
      allowedZones: ["AFT_SERVICE", "FORECASTLE"],
      buildWorkMicro: "1200",
      productionLine: "machinery",
      attributes: {
        ...components.find((c) => c.id === "quarters_crew")?.attributes,
        flammableBp: "250",
      },
    });
    const part = partOf(r);
    expect(r.failures).toEqual([]);
    expect(part?.allowedZones).toEqual(["AFT_SERVICE", "FORECASTLE"]);
    expect(part?.buildWorkMicro).toBe(1200);
    expect(part?.productionLine).toBe("machinery");
    expect(part?.engineering?.flammability).toEqual({ indexBp: 250 });
  });

  it("rejects an unknown zone, an unknown production line and non-constant build work", () => {
    expect(withComponent({ allowedZones: ["BRIDGE"] }).failures.map((f) => f.code)).toContain(
      "PARTCAT_INVALID_VALUE",
    );
    expect(withComponent({ productionLine: "walkway" }).failures.map((f) => f.code)).toContain(
      "PARTCAT_INVALID_VALUE",
    );
    expect(withComponent({ buildWorkMicro: "crew * 2" }).failures.map((f) => f.code)).toContain(
      "PARTCAT_FORMULA_PARAMETER_DEPENDENT",
    );
  });

  it("still rejects a legacy forbidsCoLocation category list (no faithful interface map)", () => {
    expect(withComponent({ forbidsCoLocation: ["ENGINE"] }).failures.map((f) => f.code)).toContain(
      "PARTCAT_UNMAPPED_FIELD",
    );
  });
});

const partLookup = (parts: readonly FlattenedPart[]) => {
  const map = new Map(parts.map((p) => [p.id, p]));
  return (id: string) => map.get(id);
};

const slotLookup = (hullFormId: string) => {
  const slots = [
    ...compatibility.slotTemplates.flatMap((t) => t.slots),
    ...(compatibility.platforms.find((p) => p.id === hullFormId)?.slots ?? []),
  ];
  return (id: string) => slots.find((s) => s.id === id);
};

describe("inverse readers rebuild today's runtime shapes from parts (11b)", () => {
  it("rebuilds every gun placement from its mount and nested gun parts", () => {
    let checked = 0;
    for (const design of designs) {
      for (const placement of design.draft.placements) {
        const category = components.find((c) => c.id === placement.componentId)?.category;
        if (category === undefined || !GUN.has(category)) continue;
        const row = { design, placement, familyId: placement.componentId };
        const r = resolveRow(row);
        const t = present(r.translation, `${design.id}:${placement.instanceId}`);
        const result = readPlacements({
          designId: design.id,
          entries: [t.entry],
          partOf: partLookup([t.mountPart, t.gunPart]),
          slotOf: slotLookup(design.draft.hull.hullFormId),
        });
        expect(result.issues, `${design.id}:${placement.instanceId}`).toEqual([]);
        const got = present(result.placements[0], `${design.id}:${placement.instanceId}`);
        const barrels = placement.params?.barrels ?? 1;
        expect(got.instanceId, t.entry.id).toBe(placement.instanceId);
        expect(got.componentId, t.entry.id).toBe(placement.componentId);
        expect(got.zoneId, t.entry.id).toBe(placement.zoneId);
        expect(got.stationPermille, t.entry.id).toBe(placement.stationPermille);
        expect(got.side, t.entry.id).toBe(placement.side);
        expect(got.params?.["barrels"], t.entry.id).toBe(barrels);
        if (placement.magazineRef !== undefined) {
          expect(got.magazineRef, t.entry.id).toBe(placement.magazineRef);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("reports READER_UNKNOWN_PART when a nested gun part is missing, never a guess", () => {
    const sample = designs
      .flatMap((design) => design.draft.placements.map((placement) => ({ design, placement })))
      .find(({ design, placement }) => {
        const category = components.find((c) => c.id === placement.componentId)?.category;
        return (
          category !== undefined &&
          GUN.has(category) &&
          resolveRow({ design, placement, familyId: placement.componentId }).translation !== null
        );
      });
    expect(sample).toBeDefined();
    const { design, placement } = sample!;
    const t = present(
      resolveRow({ design, placement, familyId: placement.componentId }).translation,
      placement.instanceId,
    );
    const missing = readPlacements({
      designId: design.id,
      entries: [{ ...t.entry, entries: { guns: [{ part: "does_not_exist" }] } }],
      partOf: partLookup([t.mountPart, t.gunPart]),
      slotOf: slotLookup(design.draft.hull.hullFormId),
    });
    expect(missing.issues.map((i) => i.code)).toEqual(["READER_UNKNOWN_PART"]);
    expect(missing.placements).toEqual([]);
  });

  it("attaches the launcher's compiled torpedo, else reports READER_TORPEDO_UNRESOLVED (ticket 13b)", () => {
    const launcher = present(
      built.parts.find(
        (p): p is Extract<FlattenedPart, { readonly family: "torpedo_launcher" }> =>
          p.family === "torpedo_launcher" && p.spec.loadsTorpedo !== undefined,
      ),
      "a launcher part naming a torpedo",
    );
    const torpedo = present(
      built.parts.find((p) => p.id === launcher.spec.loadsTorpedo),
      "the torpedo part the launcher loads",
    );
    const entry = { id: "tube_1", slot: "bow.torpedo_launcher", part: launcher.id, mountCount: 2 };
    const slotOf = (id: string): SlotData => ({
      id,
      accepts: ["torpedo_launcher"],
      zone: "FORECASTLE",
    });

    const ok = readPlacements({
      designId: "d",
      entries: [entry],
      partOf: partLookup([launcher, torpedo]),
      slotOf,
    });
    expect(ok.issues).toEqual([]);
    expect(ok.placements[0]?.compiledTorpedo?.partId).toBe(torpedo.id);

    const missing = readPlacements({
      designId: "d",
      entries: [entry],
      partOf: partLookup([launcher]),
      slotOf,
    });
    expect(missing.issues.map((i) => i.code)).toEqual(["READER_TORPEDO_UNRESOLVED"]);
    expect(missing.placements.map((p) => p.instanceId)).toEqual(["tube_1"]);
    expect(missing.placements[0]?.compiledTorpedo).toBeUndefined();

    const sensor = present(
      built.parts.find((p) => p.family === "sensor"),
      "a sensor part",
    );
    const wrongLauncher = { ...launcher, spec: { ...launcher.spec, loadsTorpedo: sensor.id } };
    const wrong = readPlacements({
      designId: "d",
      entries: [entry],
      partOf: partLookup([wrongLauncher, sensor, torpedo]),
      slotOf,
    });
    expect(wrong.issues.map((i) => i.code)).toEqual(["READER_TORPEDO_UNRESOLVED"]);
  });

  it("rebuilds the machinery plan from the plant entry and the design header", () => {
    const design = designs[0]!;
    const plantPart = present(
      buildPlantPartModel({ plants }).parts.find((p) => p.id === design.draft.machinery.plantId),
      "a plant part",
    );
    const result = readMachineryPlan(
      headerOf(design),
      [
        {
          id: "machinery",
          slot: `${design.draft.machinery.zoneId.toLowerCase()}.propulsion_plant`,
          part: plantPart.id,
          mountCount: 1,
          stationPermille: design.draft.machinery.stationPermille,
          params: { installedKw: design.draft.machinery.installedKw },
        },
      ],
      partLookup([plantPart]),
      slotLookup(design.draft.hull.hullFormId),
      design.id,
    );
    expect(result.issues).toEqual([]);
    expect(result.value).toEqual(design.draft.machinery);
  });

  it("fails typed instead of inventing a machinery plan when no plant entry exists", () => {
    const design = designs[0]!;
    const result = rebuildDraft({
      designId: design.id,
      header: headerOf(design),
      loadout: { platform: design.draft.hull.hullFormId, entries: [] },
      partOf: () => undefined,
      slotOf: slotLookup(design.draft.hull.hullFormId),
    });
    expect(result.draft).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain("READER_NO_MACHINERY");
  });
});

function headerOf(design: (typeof designs)[number]) {
  return {
    nation: design.draft.nationId,
    requirement: design.draft.requirement,
    hull: design.draft.hull,
    machinery: {
      fuelCapacityKg: design.draft.machinery.fuelCapacityKg,
      fuelZoneId: design.draft.machinery.fuelZoneId,
      fuelStationPermille: design.draft.machinery.fuelStationPermille,
      foulingBp: design.draft.machinery.foulingBp,
      ...(design.draft.machinery.rooms !== undefined
        ? { rooms: design.draft.machinery.rooms.map((r) => ({ ...r })) }
        : {}),
    },
    protection: {
      citadelLengthMm: design.draft.armour.citadelLengthMm,
      torpedoWarheadKg: design.draft.armour.torpedoWarheadKg,
      bunkerProtectionBp: design.draft.armour.bunkerProtectionBp,
    },
  };
}
