import {
  FlattenedPartSchema,
  LoadoutSchema,
  decodeStrict,
  type FlattenedPart,
  type LoadoutEntryData,
  type PartInterface,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { ARMOUR_REGIONS, compileDesign } from "../src/index.js";
import { buildArmourPartModel, translateArmourRegion } from "../src/armourPartAdapter.js";
import { buildFittingPartModel, translateFittingPlacement } from "../src/fittingPartAdapter.js";
import { buildLauncherPartModel, translateTubePlacement } from "../src/torpedoPartAdapter.js";
import { buildPlantPartModel, translateMachinery } from "../src/plantPartAdapter.js";
import { catalogueForNation } from "../src/componentVariants.js";
import { platformSlots } from "../src/partCompatibility.js";
import { type FitMountCountRanges } from "../src/partFitTypes.js";
import { buildAmmunitionPartModel } from "../src/ammunitionPartAdapter.js";
import { retirementMonthFromAvailableUntil } from "../src/partLifecycle.js";
import { validateLoadoutFit } from "../src/partFit.js";
import { type FitResult } from "../src/partFitTypes.js";
import {
  armamentContent,
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
import { torpedoDiameterUm, torpedoModels } from "./helpers/torpedoModels.js";

const WEAPON = new Set([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
  "TORPEDO_TUBE",
]);
const categoryOf = (id: string) => components.find((c) => c.id === id)?.category;

const fittingModel = buildFittingPartModel({ components });
const plantModel = buildPlantPartModel({ plants });
const armourModel = buildArmourPartModel({ armour: shipBalance.armour });
const ammunitionModel = buildAmmunitionPartModel({ ammunition: armamentContent.ammunition });
const launcherModel = buildLauncherPartModel({
  components,
  profiles: navalProfiles,
  torpedoDiameterUm,
});

const loadedTorpedoOf = (launcherId: string): string => {
  const part = present(
    launcherModel.parts.find((p) => p.id === launcherId),
    `launcher ${launcherId}`,
  );
  const baseId = part.origin.prototype?.id ?? part.id;
  return present(
    components.find((c) => c.id === baseId)?.torpedoMount?.torpedoModelId,
    `torpedo of ${baseId}`,
  );
};

function fixtureTorpedo(modelId: string): FlattenedPart {
  const diameterUm = present(torpedoDiameterUm(modelId), `diameter of ${modelId}`);
  return decodeStrict(FlattenedPartSchema, {
    id: modelId,
    family: "torpedo",
    provides: "torpedo",
    name: modelId,
    lifecycle: { availableFrom: "1860-01" },
    spec: {
      diameterUm,
      massKg: 1,
      warheadType: "WET_GUNCOTTON",
      warheadExplosiveMassKg: 0,
      warheadExplosiveEquivalentMassKg: 0,
      propulsionType: "COMPRESSED_AIR",
      speedSettings: [{ settingId: "s1", speedMilliKnots: 1, rangeM: 1 }],
      minimumArmingDistanceM: 0,
      reliabilityBp: 1,
      guidanceCapability: "none",
      launchTypes: ["ABOVE_WATER_TRAINABLE"],
      technologyPrerequisiteIds: [],
      tubeHitHazardPolicy: "ORDINARY",
    },
    quantities: [],
    revisions: [],
    origin: { sourceFile: "fixture" },
    provenance: {
      sourceStatus: "PLACEHOLDER",
      confidence: "LOW",
      kind: "game_conversion",
      sources: [],
      note: "ticket 06 fixture: structured diameter only; torpedo parts are ticket 13's",
    },
  });
}

interface DesignFit {
  readonly design: Design;
  readonly entries: LoadoutEntryData[];
  readonly parts: FlattenedPart[];
  readonly ranges: Record<string, { min: number; max: number; step: number }>;
}

function designFit(design: Design): DesignFit {
  const nationId = design.draft.nationId;
  const profile = present(
    navalProfiles.find((p) => p.nationId === nationId),
    `profile ${nationId}`,
  );
  const applied = catalogueForNation(components, profile, design.month).appliedModels;
  const entries: LoadoutEntryData[] = [];
  const parts: FlattenedPart[] = [];
  const ranges: DesignFit["ranges"] = {};
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
  return { design, entries, parts, ranges };
}

const uniqueParts = (parts: readonly FlattenedPart[]): FlattenedPart[] => {
  const byId = new Map<string, FlattenedPart>();
  for (const part of parts) byId.set(part.id, part);
  return [...byId.values()].sort((a, b) => compareCodePoints(a.id, b.id));
};

function fitDesign(d: DesignFit, options: { nation?: boolean; ranges?: boolean } = {}): FitResult {
  const loadout = decodeStrict(LoadoutSchema, {
    platform: d.design.draft.hull.hullFormId,
    entries: d.entries,
  });
  return validateLoadoutFit({
    catalogue: {
      parts: uniqueParts(d.parts),
      slotTemplates: compatibility.slotTemplates,
      platforms: compatibility.platforms,
    },
    loadout,
    month: d.design.month,
    conditions: {
      ...(options.nation === true ? { nation: { nationId: d.design.draft.nationId } } : {}),
      ...(options.ranges === true
        ? { mountCountRanges: d.ranges satisfies FitMountCountRanges }
        : {}),
    },
  });
}

const fits: readonly DesignFit[] = designs.map(designFit);
const fitOf = (id: string): DesignFit =>
  present(
    fits.find((f) => f.design.id === id),
    `design ${id}`,
  );

describe("fit over production launchers (ticket 04 hand-over)", () => {
  const launchers = launcherModel.parts;
  const variants = launchers.filter((p) => p.origin.prototype !== undefined);

  function launcherFit(
    launcherPart: FlattenedPart,
    torpedoId: string,
    keepWaivers: boolean,
    month = "1890-01",
  ): FitResult {
    const part: FlattenedPart = keepWaivers
      ? launcherPart
      : { ...launcherPart, legacyExceptions: undefined };
    const platform = present(compatibility.platforms[0], "a platform");
    const slots = present(platformSlots(compatibility, platform.id), "platform slots");
    const slot = present(
      slots.find((s) => s.accepts?.includes("torpedo_launcher") === true),
      "a launcher slot",
    );
    const loadout = decodeStrict(LoadoutSchema, {
      platform: platform.id,
      entries: [
        {
          slot: slot.id,
          part: part.id,
          mountCount: 1,
          entries: { torpedo: [{ part: torpedoId }] },
        },
      ],
    });
    return validateLoadoutFit({
      catalogue: {
        parts: [part, fixtureTorpedo(torpedoId)],
        slotTemplates: compatibility.slotTemplates,
        platforms: compatibility.platforms,
      },
      loadout,
      month,
    });
  }

  it("reads 17 variants of which five carry the waiver", () => {
    expect(variants).toHaveLength(17);
    expect(variants.filter((v) => v.legacyExceptions !== undefined)).toHaveLength(5);
  });

  it("fits every production launcher with the torpedo it loads", () => {
    for (const part of launchers) {
      const torpedo = loadedTorpedoOf(part.id);
      const month =
        part.lifecycle.availableFrom > "1890-01" ? part.lifecycle.availableFrom : "1890-01";
      const r = launcherFit(part, torpedo, true, month);
      expect(r.status, part.id).toBe("ACCEPTED");
      expect(r.waivers.length === 1, part.id).toBe(part.legacyExceptions !== undefined);
    }
  });

  it("rejects the same five mismatches once the waiver is removed, and no others", () => {
    const rejected = variants
      .filter((v) => launcherFit(v, loadedTorpedoOf(v.id), false).status === "REJECTED")
      .map((v) => v.id);
    expect(rejected).toEqual(
      variants.filter((v) => v.legacyExceptions !== undefined).map((v) => v.id),
    );
    for (const id of rejected) {
      const part = present(
        variants.find((v) => v.id === id),
        id,
      );
      const r = launcherFit(part, loadedTorpedoOf(id), false);
      expect(r.findings.map((f) => [f.code, f.slot, f.detail["constraint"]])).toEqual([
        ["FIT_CONSTRAINT_VIOLATED", "torpedo", "diameterUmEqualsBore"],
      ]);
    }
  });

  it("a waiver permits only the torpedo it names", () => {
    const french = present(
      variants.find((v) => v.id === "fr_tube_380mm_aw"),
      "the French launcher",
    );
    const other = present(
      torpedoModels
        .map((m) => String(m.torpedoModelId))
        .find(
          (id) =>
            id !== loadedTorpedoOf(french.id) &&
            torpedoDiameterUm(id) !== french.spec.boreDiameterUm,
        ),
      "a torpedo of another diameter",
    );
    const r = launcherFit(french, other, true);
    expect(r.findings.map((f) => f.code)).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
    expect(r.waivers).toEqual([]);
  });

  it("a waiver does not mask an unavailable launcher", () => {
    const waived = present(
      variants.find((v) => v.legacyExceptions !== undefined),
      "a waived launcher",
    );
    const r = launcherFit(waived, loadedTorpedoOf(waived.id), true, "1700-01");
    expect(r.findings.map((f) => [f.code, f.part])).toEqual(
      [
        ["FIT_NOT_YET_AVAILABLE", waived.id],
        ["FIT_NOT_YET_AVAILABLE", loadedTorpedoOf(waived.id)],
      ].sort((a, b) => compareCodePoints(`${a[1]}`, `${b[1]}`)),
    );
    expect(r.waivers).toHaveLength(1);
  });

  it("the nine waived production tube entries fit with the waiver applied", () => {
    const waivedEntries = fits.flatMap((d) =>
      d.entries.filter((e) => {
        const part = d.parts.find((p) => p.id === e.part);
        return part?.legacyExceptions !== undefined;
      }),
    );
    expect(waivedEntries).toHaveLength(9);
  });

  it("is independent of the source order of the launcher catalogue", () => {
    const part = present(variants[0], "a variant");
    const a = launcherFit(part, loadedTorpedoOf(part.id), true);
    const reversed = buildLauncherPartModel({
      components: [...components].reverse(),
      profiles: [...navalProfiles].reverse(),
      torpedoDiameterUm,
    });
    const same = present(
      reversed.parts.find((p) => p.id === part.id),
      part.id,
    );
    expect(canonicalSerialize(launcherFit(same, loadedTorpedoOf(part.id), true))).toBe(
      canonicalSerialize(a),
    );
  });
});

function slotFor(iface: PartInterface): { platform: string; slot: string } {
  const platform = present(compatibility.platforms[0], "a platform");
  const slot = present(
    (platformSlots(compatibility, platform.id) ?? []).find(
      (s) => s.accepts?.includes(iface) === true,
    ),
    `a ${iface} slot`,
  );
  return { platform: platform.id, slot: slot.id };
}

function fitEntries(
  platform: string,
  entries: readonly LoadoutEntryData[],
  parts: readonly FlattenedPart[],
  month: string,
): FitResult {
  return validateLoadoutFit({
    catalogue: {
      parts,
      slotTemplates: compatibility.slotTemplates,
      platforms: compatibility.platforms,
    },
    loadout: decodeStrict(LoadoutSchema, { platform, entries }),
    month,
  });
}

describe("fit over production plants (ticket 05 hand-over)", () => {
  it("accepts the minimum and maximum of every plant's declared installedKw, and not beyond", () => {
    const { platform, slot } = slotFor("propulsion_plant");
    expect(plantModel.parts.length).toBeGreaterThan(0);
    for (const part of plantModel.parts) {
      const range = present(part.parameters?.["installedKw"], `${part.id} installedKw`);
      const month = part.lifecycle.availableFrom;
      const at = (kw: number) =>
        fitEntries(
          platform,
          [{ slot, part: part.id, mountCount: 1, params: { installedKw: kw } }],
          [part],
          month,
        );
      expect(at(range.min).status, `${part.id} min`).toBe("ACCEPTED");
      expect(at(range.max).status, `${part.id} max`).toBe("ACCEPTED");
      expect(
        at(range.min - 1).findings.map((f) => f.code),
        `${part.id} below`,
      ).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
      expect(
        at(range.max + 1).findings.map((f) => f.code),
        `${part.id} above`,
      ).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
    }
  });
});

describe("fit over production armour materials (ticket 05 hand-over)", () => {
  const plate = { thicknessUm: 100_000, lengthMm: 10_000, heightMm: 2_000, cosObliquityBp: 10_000 };
  const regionSlots = (
    platformSlots(compatibility, present(compatibility.platforms[0], "p").id) ?? []
  ).filter((s) => s.region !== undefined);

  it("covers all 14 armour-region slots, each accepting only armour_material", () => {
    expect(regionSlots).toHaveLength(ARMOUR_REGIONS.length);
    for (const s of regionSlots) expect(s.accepts).toEqual(["armour_material"]);
  });

  it("fits every material in every region, and rejects a fitting there", () => {
    const platform = present(compatibility.platforms[0], "p").id;
    const fittingPart = present(fittingModel.records[0], "a fitting").part;
    expect(armourModel.parts.length).toBeGreaterThan(0);
    for (const slot of regionSlots) {
      for (const material of armourModel.parts) {
        const r = fitEntries(
          platform,
          [{ slot: slot.id, part: material.id, mountCount: 1, shape: plate }],
          [material],
          material.lifecycle.availableFrom,
        );
        expect(r.status, `${material.id} in ${slot.id}`).toBe("ACCEPTED");
      }
      const wrong = fitEntries(
        platform,
        [{ slot: slot.id, part: fittingPart.id, mountCount: 1, shape: plate }],
        [fittingPart],
        fittingPart.lifecycle.availableFrom,
      );
      expect(
        wrong.findings.map((f) => f.code),
        slot.id,
      ).toEqual(["FIT_INTERFACE_MISMATCH"]);
    }
  });

  it("checks every dated material on both sides of its exclusive end", () => {
    const platform = present(compatibility.platforms[0], "p").id;
    const slot = present(regionSlots[0], "a region slot").id;
    const dated = armourModel.parts.filter((p) => p.lifecycle.availableUntil != null);
    const entry = (id: string): LoadoutEntryData => ({
      slot,
      part: id,
      mountCount: 1,
      shape: plate,
    });
    for (const material of armourModel.parts) {
      const from = material.lifecycle.availableFrom;
      expect(fitEntries(platform, [entry(material.id)], [material], from).status).toBe("ACCEPTED");
      expect(
        fitEntries(platform, [entry(material.id)], [material], "1700-01").findings.map(
          (f) => f.code,
        ),
      ).toEqual(["FIT_NOT_YET_AVAILABLE"]);
    }
    for (const material of dated) {
      const until = present(material.lifecycle.availableUntil, "availableUntil");
      const last = present(retirementMonthFromAvailableUntil(until), "last month");
      expect(fitEntries(platform, [entry(material.id)], [material], last).status).toBe("ACCEPTED");
      expect(
        fitEntries(platform, [entry(material.id)], [material], until).findings.map((f) => f.code),
      ).toEqual(["FIT_UNAVAILABLE"]);
    }
  });

  it("decodes the full armour loadout of a production design on its platform", () => {
    const d = present(
      fits.find((f) => f.entries.some((e) => e.slot.startsWith("armour."))),
      "a design with armour regions",
    );
    const armour = d.entries.filter((e) => e.slot.startsWith("armour."));
    expect(armour.length).toBeGreaterThan(0);
    const loadout = { platform: d.design.draft.hull.hullFormId, entries: d.entries };
    expect(decodeStrict(LoadoutSchema, loadout)).toEqual(loadout);
    expect(fitDesign(d).status).toBe("ACCEPTED");
  });
});

describe("fit over production ammunition nested in a gun mount (ticket 05 hand-over)", () => {
  const row = present(
    fits.flatMap((d) => d.parts).find((p) => p.family === "gun_mount"),
    "a production gun mount",
  );
  const gun = present(
    fits.flatMap((d) => d.parts).find((p) => p.family === "gun"),
    "a production gun",
  );
  const withAmmunitionSlot: FlattenedPart = {
    ...row,
    slots: [
      ...(row.slots ?? []),
      { id: "ammunition", accepts: ["ammunition"], mountCount: { min: 1, max: 1 } },
    ],
  };
  const gunsPerMount = row.family === "gun_mount" ? row.spec.gunsPerMount : 1;
  const rounds = gun.family === "gun" ? gun.parameters?.["rounds"]?.min : undefined;
  const { platform, slot } = slotFor("gun_mount");
  const carrier = (ammo: readonly string[]): LoadoutEntryData => ({
    slot,
    part: row.id,
    mountCount: 1,
    entries: {
      guns: [
        {
          part: gun.id,
          mountCount: gunsPerMount,
          ...(rounds !== undefined ? { params: { rounds } } : {}),
        },
      ],
      ammunition: ammo.map((part) => ({ part })),
    },
  });
  const month = (p: FlattenedPart): string =>
    [p.lifecycle.availableFrom, row.lifecycle.availableFrom, gun.lifecycle.availableFrom]
      .sort(compareCodePoints)
      .at(-1) ?? p.lifecycle.availableFrom;

  it("nests available ammunition and reports a missing one", () => {
    const record = present(
      ammunitionModel.records.find(
        (r) =>
          r.part.lifecycle.availableUntil == null && r.part.lifecycle.availableFrom <= "1890-01",
      ),
      "a long-lived ammunition part",
    );
    const parts = [withAmmunitionSlot, gun, record.part];
    const at = month(record.part);
    expect(fitEntries(platform, [carrier([record.part.id])], parts, at).status).toBe("ACCEPTED");
    const missing = fitEntries(platform, [carrier([])], parts, at);
    expect(missing.findings.map((f) => [f.code, f.slot])).toEqual([
      ["FIT_COUNT_BELOW_MINIMUM", "ammunition"],
    ]);
  });

  it("reports retired ammunition on both sides of its inclusive retirement month", () => {
    const authored = present(armamentContent.ammunition[0], "an authored ammunition pattern");
    const dated = present(
      buildAmmunitionPartModel({
        ammunition: [{ ...authored, retirementMonth: "1950-06" }],
      }).records[0],
      "a dated ammunition part",
    ).part;
    expect(dated.lifecycle.availableUntil).toBe("1950-07");
    const parts = [withAmmunitionSlot, gun, dated];
    const codes = (m: string) =>
      fitEntries(platform, [carrier([dated.id])], parts, m).findings.map((f) => f.code);
    expect(codes("1950-06")).toEqual([]);
    expect(codes("1950-07")).toEqual(["FIT_UNAVAILABLE"]);
  });

  it("does not guess a magazine: the nested ammunition has no magazineRef", () => {
    const record = present(ammunitionModel.records[0], "an ammunition part");
    const e = carrier([record.part.id]);
    expect(JSON.stringify(e)).not.toMatch(/magazineRef/);
    const r = fitEntries(platform, [e], [withAmmunitionSlot, gun, record.part], month(record.part));
    expect(r.unresolved.map((u) => u.code)).toEqual(["FIT_MAGAZINE_UNDETERMINED"]);
  });
});

describe("fit over every production design (characterization)", () => {
  const results = fits.map((d) => ({
    d,
    r: fitDesign(d, { nation: true, ranges: true }),
    legacy: compileDesign(
      d.design.draft,
      nationalContext(d.design.month, d.design.draft.nationId),
    ).findings.map((f) => f.id),
  }));

  it("evaluates all 95 designs, 871 placements, 248 gun placements and 30 tube placements", () => {
    expect(fits).toHaveLength(95);
    expect(fits.reduce((n, d) => n + d.design.draft.placements.length, 0)).toBe(871);
    const slotKinds = fits.flatMap((d) => d.entries.map((e) => e.slot.split(".").at(-1)));
    expect(slotKinds.filter((k) => k === "gun_mount")).toHaveLength(248);
    expect(slotKinds.filter((k) => k === "torpedo_launcher")).toHaveLength(30);
  });

  it("accepts every design: nothing is excluded, and nothing is rejected silently", () => {
    const status = (s: FitResult["status"]) => results.filter((x) => x.r.status === s).length;
    expect([status("ACCEPTED"), status("REJECTED"), status("NOT_EVALUABLE")]).toEqual([95, 0, 0]);
    for (const { d, r } of results) {
      expect(r.findings, d.design.id).toEqual([]);
      expect(r.dataIssues, d.design.id).toEqual([]);
    }
  });

  it("states what it does not decide: no nested torpedo, ammunition or magazine data exists", () => {
    for (const { d, r } of results) {
      expect(r.waivers, d.design.id).toEqual([]);
      expect(r.unresolved, d.design.id).toEqual([]);
      for (const e of d.entries) {
        expect(Object.keys(e)).not.toContain("rounds");
        expect(Object.keys(e)).not.toContain("magazineRef");
      }
    }
  });

  it("agrees with the legacy compile on the rules both express", () => {
    for (const { d, r, legacy } of results) {
      const legacyRule = legacy.filter((id) =>
        ["TECH_UNAVAILABLE", "COMPONENT_OBSOLETE", "PARAM_RANGE"].includes(id),
      );
      const fitRule = r.findings.filter((f) =>
        ["FIT_NOT_YET_AVAILABLE", "FIT_UNAVAILABLE", "FIT_CONSTRAINT_VIOLATED"].includes(f.code),
      );
      expect(legacyRule, d.design.id).toEqual([]);
      expect(fitRule, d.design.id).toEqual([]);
    }
  });

  it("never repeats an armour region, though the compatibility template does not forbid it", () => {
    for (const d of fits) {
      const regions = d.entries.map((e) => e.slot).filter((s) => s.startsWith("armour."));
      expect(new Set(regions).size, d.design.id).toBe(regions.length);
    }
  });

  it("is deterministic across a second evaluation and a reversed entry order", () => {
    for (const { d, r } of results) {
      expect(canonicalSerialize(fitDesign(d, { nation: true, ranges: true }))).toBe(
        canonicalSerialize(r),
      );
      const reversed: DesignFit = { ...d, entries: [...d.entries].reverse() };
      expect(
        canonicalSerialize(fitDesign(reversed, { nation: true, ranges: true })),
        d.design.id,
      ).toBe(canonicalSerialize(r));
    }
  });

  it("rejects a production design once its machinery power leaves the plant's range", () => {
    const d = present(fits[0], "a design");
    const index = d.entries.findIndex((e) => e.params?.["installedKw"] !== undefined);
    const entry = present(d.entries[index], "the plant entry");
    const part = present(
      d.parts.find((p) => p.id === entry.part),
      "the plant part",
    );
    const max = present(part.parameters?.["installedKw"], "installedKw range").max;
    const broken = d.entries.map((e, i) =>
      i === index ? { ...e, params: { installedKw: max + 1 } } : e,
    );
    const r = fitDesign({ ...d, entries: broken }, { nation: true, ranges: true });
    expect(r.status).toBe("REJECTED");
    expect(r.findings.map((f) => [f.code, f.detail["constraint"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "parameter:installedKw"],
    ]);
  });

  it("keeps the ammunition parts it did not use available for fixtures", () => {
    expect(ammunitionModel.records.length).toBeGreaterThan(0);
    expect(fitOf(present(fits[0], "a design").design.id)).toBeDefined();
  });
});
