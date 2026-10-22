import {
  DesignHeaderSchema,
  DesignLoadoutSchema,
  FlattenedPartSchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  LoadoutEntryData,
  PlatformData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import {
  buildArmourPartModel,
  buildCompatibilitySlots,
  buildFittingPartModel,
  buildGunPartModel,
  buildLauncherPartModel,
  buildPartCatalogue,
  buildPlantPartModel,
  catalogueForNation,
  gunKey,
  headerFromDraft,
  isSingleGunMount,
  mountPartIdFor,
  nationHasArmamentContent,
  platformSlots,
  translateArmourRegion,
  translateFittingPlacement,
  translateGunPlacement,
  translateMachinery,
  translateTubePlacement,
  partCatalogue,
  type FitMountCountRanges,
  type GunPartRequest,
  type GunPlacementTranslation,
  type SourceCatalogue,
} from "@bluewave/ship-design";
import { fromYaml, toYaml } from "./yaml.js";
import { migrationFailure } from "./failure.js";
import type { MigrationFailure, MigrationResult } from "./failure.js";
import {
  MANIFEST_PATH,
  type GeneratedFile,
  type LegacySource,
  type ManifestDataQuality,
  type MigrationManifest,
  type MigrationPlan,
  type SourceFileRef,
  type StagedDesign,
  type StagedSource,
} from "./types.js";

const WEAPON_GUN: ReadonlySet<string> = new Set([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
]);

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  compareCodePoints(a.id, b.id);

const sortRefs = (refs: readonly SourceFileRef[]): SourceFileRef[] =>
  [...refs].sort((a, b) => compareCodePoints(a.path, b.path));

const refsHash = (refs: readonly SourceFileRef[]): string =>
  sha256Hex(canonicalSerialize(sortRefs(refs)));

export function canonicalMountId(t: GunPlacementTranslation): string {
  if (t.disposition !== null || isSingleGunMount(t.legacyResolvedMountType)) {
    return t.mountPart.id;
  }
  return mountPartIdFor(t.legacyMountId, t.gunsPerMount);
}

interface CatalogueModels {
  readonly compatibility: ReturnType<typeof buildCompatibilitySlots>;
  readonly plants: ReturnType<typeof buildPlantPartModel>;
  readonly armour: ReturnType<typeof buildArmourPartModel>;
  readonly fittings: ReturnType<typeof buildFittingPartModel>;
  readonly launchers: ReturnType<typeof buildLauncherPartModel>;
}

function pinnedDataQuality(
  parts: readonly FlattenedPart[],
  designs: readonly StagedDesign[],
  partOf: (id: string) => FlattenedPart | undefined,
): Pick<
  ManifestDataQuality,
  | "centralBatteryPlacements"
  | "launcherVariants"
  | "waivedLauncherRecords"
  | "torpedoEntriesAffected"
> {
  const launchers = parts.filter((p) => p.family === "torpedo_launcher");
  const waived = new Set(
    launchers.filter((p) => p.legacyExceptions !== undefined).map((p) => p.id),
  );
  let torpedoEntriesAffected = 0;
  let centralBatteryPlacements = 0;
  for (const design of designs) {
    for (const entry of design.loadout.entries) {
      const part = partOf(entry.part);
      if (part?.family === "gun_mount" && part.id.includes("_central_battery_")) {
        centralBatteryPlacements += 1;
      }
      if (part?.family === "torpedo_launcher" && waived.has(part.id)) torpedoEntriesAffected += 1;
    }
  }
  return {
    centralBatteryPlacements,
    launcherVariants: launchers.filter((p) => p.origin.prototype !== undefined).length,
    waivedLauncherRecords: waived.size,
    torpedoEntriesAffected,
  };
}

function catalogueSource(source: LegacySource): SourceCatalogue {
  return {
    components: source.components,
    plants: source.plants,
    armour: source.armour,
    armament: source.armament,
    profiles: source.profiles,
    tagVocabulary: source.tagVocabulary,
    torpedoDiameterUm: source.torpedoDiameterUm,
    torpedoModels: source.torpedoModels,
  };
}

const familyFile = (family: string): string => `parts/${family}.yaml`;
const designFile = (nation: string): string => `designs/${nation}.yaml`;

function partFiles(parts: readonly FlattenedPart[]): GeneratedFile[] {
  const byFamily = new Map<string, FlattenedPart[]>();
  for (const part of parts) {
    const list = byFamily.get(part.family) ?? [];
    list.push(part);
    byFamily.set(part.family, list);
  }
  return [...byFamily.keys()].sort(compareCodePoints).map((family) => {
    const records = [...(byFamily.get(family) ?? [])].sort(byId);
    return {
      path: familyFile(family),
      records: records.length,
      content: toYaml({ parts: records }),
    };
  });
}

function designFiles(designs: readonly StagedDesign[]): GeneratedFile[] {
  const byNation = new Map<string, StagedDesign[]>();
  for (const design of designs) {
    const list = byNation.get(design.header.nation) ?? [];
    list.push(design);
    byNation.set(design.header.nation, list);
  }
  return [...byNation.keys()].sort(compareCodePoints).map((nation) => {
    const records = [...(byNation.get(nation) ?? [])].sort(byId).map((d) => ({
      id: d.id,
      name: d.name,
      month: d.month,
      ...(d.starterFor !== undefined ? { starterFor: d.starterFor } : {}),
      header: d.header,
      loadout: d.loadout,
    }));
    return {
      path: designFile(nation),
      records: records.length,
      content: toYaml({ designs: records }),
    };
  });
}

interface PlanRecords {
  readonly designs: readonly StagedDesign[];
  readonly dataQuality: ManifestDataQuality;
  readonly gunPlacements: number;
  readonly tubePlacements: number;
  readonly fittingPlacements: number;
  readonly placements: number;
}

function decodeGenerated(input: {
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
}): string | null {
  try {
    decodeStrict(DesignHeaderSchema, input.header);
    decodeStrict(LoadoutSchema, input.loadout);
    decodeStrict(DesignLoadoutSchema, input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

interface DesignLoadoutResult {
  readonly design: StagedDesign;
  readonly gunPlacements: number;
  readonly tubePlacements: number;
  readonly fittingPlacements: number;
  readonly unresolvedMagazines: number;
  readonly waivers: number;
}

function designLoadout(input: {
  readonly source: LegacySource;
  readonly design: LegacySource["designs"][number];
  readonly models: CatalogueModels;
  readonly gunModel: ReturnType<typeof buildGunPartModel>;
  readonly partOf: (id: string) => FlattenedPart | undefined;
  readonly failures: MigrationFailure[];
}): DesignLoadoutResult | null {
  const { source, design, models, gunModel, partOf, failures } = input;
  const draft = design.draft;
  const nationId = draft.nationId;
  const profile = source.profiles.find((p) => p.nationId === nationId);
  const applied =
    profile === undefined
      ? {}
      : catalogueForNation(source.components, profile, design.month).appliedModels;
  const entries: LoadoutEntryData[] = [];
  const referenced = new Map<string, FlattenedPart>();
  const ranges: Record<string, { min: number; max: number; step: number }> = {};
  let gunPlacements = 0;
  let tubePlacements = 0;
  let fittingPlacements = 0;
  const at = (instanceId: string, field: string) =>
    `${design.id}.${instanceId}${field === "" ? "" : `.${field}`}`;

  const reference = (id: string, path: string): FlattenedPart | null => {
    const part = partOf(id);
    if (part === undefined) {
      failures.push(
        migrationFailure("CODEMOD_MISSING_PART", path, `generated catalogue has no part '${id}'.`),
      );
      return null;
    }
    referenced.set(id, part);
    return part;
  };

  for (const placement of draft.placements) {
    const category = source.components.find((c) => c.id === placement.componentId)?.category;
    if (category === "TORPEDO_TUBE") {
      const r = translateTubePlacement({
        designId: design.id,
        placement,
        nationId,
        model: models.launchers,
        appliedModels: applied,
      });
      if (r.translation === null) {
        failures.push(
          migrationFailure(
            "CODEMOD_UNTRANSLATED_PLACEMENT",
            at(placement.instanceId, ""),
            `${r.untranslated.code}: ${r.untranslated.message}`,
          ),
        );
        continue;
      }
      if (reference(r.translation.launcherPart.id, at(placement.instanceId, "part")) === null) {
        continue;
      }
      const tubes = source.components.find((c) => c.id === placement.componentId)?.parameters[
        "tubes"
      ];
      if (tubes !== undefined) ranges[r.translation.launcherPart.id] = tubes;
      entries.push(r.translation.entry);
      tubePlacements += 1;
    } else if (category !== undefined && WEAPON_GUN.has(category)) {
      const gun = gunModel.byRequest.get(gunKey(nationId, placement.componentId));
      if (gun === undefined) {
        failures.push(
          migrationFailure(
            "CODEMOD_MISSING_PART",
            at(placement.instanceId, "gun"),
            `no gun part for family '${placement.componentId}' of '${nationId}'.`,
          ),
        );
        continue;
      }
      const t = translateGunPlacement({
        designId: design.id,
        placement,
        nationId,
        gun,
        content: source.armament,
        components: source.components,
      });
      if (t === null) {
        failures.push(
          migrationFailure(
            "CODEMOD_UNTRANSLATED_PLACEMENT",
            at(placement.instanceId, ""),
            `no ${gun.resolvedMountType} mount for family '${placement.componentId}'.`,
          ),
        );
        continue;
      }
      const mountId = canonicalMountId(t);
      if (reference(mountId, at(placement.instanceId, "part")) === null) continue;
      if (reference(t.gunPart.id, at(placement.instanceId, "gun")) === null) continue;
      entries.push({ ...t.entry, part: mountId });
      gunPlacements += 1;
    } else {
      const r = translateFittingPlacement({
        designId: design.id,
        placement,
        model: models.fittings,
      });
      if (r.translation === null) {
        failures.push(
          migrationFailure(
            "CODEMOD_UNTRANSLATED_PLACEMENT",
            at(placement.instanceId, ""),
            `${r.untranslated.code}: ${r.untranslated.message}`,
          ),
        );
        continue;
      }
      if (reference(r.translation.record.part.id, at(placement.instanceId, "part")) === null) {
        continue;
      }
      const counted = r.translation.record.countParameter;
      if (counted !== null) {
        const range = r.translation.record.legacy.parameters[counted];
        if (range !== undefined) ranges[r.translation.record.part.id] = range;
      }
      entries.push(r.translation.entry);
      fittingPlacements += 1;
    }
  }

  const machinery = translateMachinery({
    designId: design.id,
    machinery: draft.machinery,
    model: models.plants,
  });
  if (machinery.translation === null) {
    failures.push(
      migrationFailure(
        "CODEMOD_UNTRANSLATED_PLACEMENT",
        `${design.id}.machinery`,
        `${machinery.untranslated.code}: ${machinery.untranslated.message}`,
      ),
    );
    return null;
  }
  if (reference(machinery.translation.plantPart.id, `${design.id}.machinery.part`) === null) {
    return null;
  }
  entries.push(machinery.translation.entry);

  for (const [index, region] of draft.armour.regions.entries()) {
    const r = translateArmourRegion({ designId: design.id, index, region, model: models.armour });
    if (r.translation === null) {
      failures.push(
        migrationFailure(
          "CODEMOD_UNTRANSLATED_PLACEMENT",
          `${design.id}.armour[${String(index)}]`,
          `${r.untranslated.code}: ${r.untranslated.message}`,
        ),
      );
      return null;
    }
    if (
      reference(r.translation.materialPart.id, `${design.id}.armour[${String(index)}].part`) ===
      null
    ) {
      return null;
    }
    entries.push(r.translation.entry);
  }

  const slots = platformSlots(models.compatibility, draft.hull.hullFormId) ?? [];
  for (const entry of entries) {
    if (!slots.some((s) => s.id === entry.slot)) {
      failures.push(
        migrationFailure(
          "CODEMOD_MISSING_SLOT",
          `${design.id}.entries[${entry.id ?? entry.slot}].slot`,
          `platform '${draft.hull.hullFormId}' offers no slot '${entry.slot}'.`,
        ),
      );
      return null;
    }
  }

  const loadout: LoadoutData = { platform: draft.hull.hullFormId, entries };
  const fit = partCatalogue({
    parts: [...referenced.values()].sort(byId),
    slotTemplates: models.compatibility.slotTemplates,
    platforms: models.compatibility.platforms,
  }).validate({
    loadout,
    month: design.month,
    conditions: { nation: { nationId }, mountCountRanges: ranges satisfies FitMountCountRanges },
  });
  const header = headerFromDraft(draft);
  const staged: StagedDesign = {
    id: design.id,
    name: design.name,
    month: design.month,
    ...(design.starterFor !== undefined ? { starterFor: design.starterFor } : {}),
    header,
    loadout,
  };
  const invalid = decodeGenerated({ header, loadout });
  if (invalid !== null) {
    failures.push(migrationFailure("CODEMOD_GENERATED_INVALID", design.id, invalid));
    return null;
  }
  return {
    design: staged,
    gunPlacements,
    tubePlacements,
    fittingPlacements,
    unresolvedMagazines: fit.unresolved.length,
    waivers: fit.waivers.length,
  };
}

function decodeGeneratedFiles(
  files: readonly GeneratedFile[],
): { path: string; message: string } | null {
  for (const file of files) {
    const key = collectionKey(file.path);
    try {
      const raw = fromYaml(file.content);
      if (typeof raw !== "object" || raw === null) {
        return { path: file.path, message: "document is not a mapping." };
      }
      const records = (raw as Record<string, unknown>)[key];
      if (!Array.isArray(records)) {
        return { path: file.path, message: `document has no '${key}' array.` };
      }
      for (const record of records) decodeGeneratedRecord(file.path, record);
    } catch (error) {
      return { path: file.path, message: error instanceof Error ? error.message : String(error) };
    }
  }
  return null;
}

function collectionKey(path: string): string {
  if (path.startsWith("parts/")) return "parts";
  if (path.startsWith("designs/")) return "designs";
  if (path === "platforms.yaml") return "platforms";
  if (path === "slot-templates.yaml") return "slotTemplates";
  return "records";
}

function decodeGeneratedRecord(path: string, record: unknown): void {
  if (path.startsWith("parts/")) {
    decodeStrict(FlattenedPartSchema, record);
  } else if (path === "platforms.yaml") {
    decodeStrict(PlatformSchema, record);
  } else if (path === "slot-templates.yaml") {
    decodeStrict(SlotTemplateSchema, record);
  } else if (path.startsWith("designs/")) {
    const design = record as { readonly header?: unknown; readonly loadout?: unknown };
    decodeStrict(DesignLoadoutSchema, { header: design.header, loadout: design.loadout });
  }
}

function assemblePlan(input: {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
  readonly records: PlanRecords;
  readonly source: MigrationManifest["source"];
}): MigrationResult<MigrationPlan> {
  const files: GeneratedFile[] = [
    ...partFiles(input.parts),
    {
      path: "platforms.yaml",
      records: input.platforms.length,
      content: toYaml({ platforms: [...input.platforms].sort(byId) }),
    },
    {
      path: "slot-templates.yaml",
      records: input.slotTemplates.length,
      content: toYaml({ slotTemplates: [...input.slotTemplates].sort(byId) }),
    },
    ...designFiles(input.records.designs),
  ].sort((a, b) => compareCodePoints(a.path, b.path));

  const seen = new Set<string>();
  const failures: MigrationFailure[] = [];
  for (const file of files) {
    if (seen.has(file.path)) {
      failures.push(
        migrationFailure("CODEMOD_DESTINATION_COLLISION", file.path, "two files want this path."),
      );
    }
    seen.add(file.path);
  }
  if (failures.length > 0) return { ok: false, failures };

  const decoded = decodeGeneratedFiles(files);
  if (decoded !== null) {
    return {
      ok: false,
      failures: [migrationFailure("CODEMOD_GENERATED_INVALID", decoded.path, decoded.message)],
    };
  }

  const fileRefs = files.map((f) => ({
    path: f.path,
    records: f.records,
    sha256: sha256Hex(f.content),
  }));
  const contentHash = sha256Hex(
    canonicalSerialize(fileRefs.map((f) => ({ path: f.path, sha256: f.sha256 }))),
  );
  const partsByFamily: Record<string, number> = {};
  for (const part of input.parts)
    partsByFamily[part.family] = (partsByFamily[part.family] ?? 0) + 1;
  const manifest: MigrationManifest = {
    schema: "ship-part-content-migration/1",
    stagedOnly: true,
    source: input.source,
    content: { files: fileRefs, hash: contentHash },
    records: {
      parts: input.parts.length,
      partsByFamily,
      slotTemplates: input.slotTemplates.length,
      platforms: input.platforms.length,
      designs: input.records.designs.length,
      placements: input.records.placements,
      gunPlacements: input.records.gunPlacements,
      tubePlacements: input.records.tubePlacements,
      fittingPlacements: input.records.fittingPlacements,
    },
    dataQuality: input.records.dataQuality,
  };
  const manifestFile: GeneratedFile = {
    path: MANIFEST_PATH,
    records: 1,
    content: `${canonicalSerialize(manifest)}\n`,
  };
  return {
    ok: true,
    value: { files, manifestFile, manifest, designs: input.records.designs, contentHash },
  };
}

export function planFromLegacy(source: LegacySource): MigrationResult<MigrationPlan> {
  const built = buildPartCatalogue(catalogueSource(source));
  if (built.failures.length > 0) {
    return {
      ok: false,
      failures: built.failures.map((f) =>
        migrationFailure("CODEMOD_CATALOGUE_FAILURE", f.path, `${f.code}: ${f.message}`),
      ),
    };
  }
  const partById = new Map(built.parts.map((p) => [p.id, p] as const));
  const compatibility = buildCompatibilitySlots({ hullForms: source.hullForms });
  const models: CatalogueModels = {
    compatibility,
    plants: buildPlantPartModel({ plants: source.plants }),
    armour: buildArmourPartModel({ armour: source.armour }),
    fittings: buildFittingPartModel({ components: source.components }),
    launchers: buildLauncherPartModel({
      components: source.components,
      profiles: source.profiles,
      torpedoDiameterUm: source.torpedoDiameterUm,
    }),
  };
  const requests: GunPartRequest[] = [];
  for (const design of source.designs) {
    for (const placement of design.draft.placements) {
      const category = source.components.find((c) => c.id === placement.componentId)?.category;
      if (category !== undefined && WEAPON_GUN.has(category)) {
        requests.push({ nationId: design.draft.nationId, familyId: placement.componentId });
      }
    }
  }
  const gunModel = buildGunPartModel({
    content: source.armament,
    components: source.components,
    requests,
  });

  const failures: MigrationFailure[] = [];
  const designs: StagedDesign[] = [];
  let gunPlacements = 0;
  let tubePlacements = 0;
  let fittingPlacements = 0;
  let unresolvedMagazineRelationships = 0;
  let waivers = 0;
  for (const design of [...source.designs].sort(byId)) {
    const before = failures.length;
    const result = designLoadout({
      source,
      design,
      models,
      gunModel,
      partOf: (id) => partById.get(id),
      failures,
    });
    if (failures.length > before || result === null) continue;
    designs.push(result.design);
    gunPlacements += result.gunPlacements;
    tubePlacements += result.tubePlacements;
    fittingPlacements += result.fittingPlacements;
    unresolvedMagazineRelationships += result.unresolvedMagazines;
    waivers += result.waivers;
  }
  if (failures.length > 0) return { ok: false, failures };

  let unresolvedArmamentPlacements = 0;
  for (const design of source.designs) {
    for (const placement of design.draft.placements) {
      const category = source.components.find((c) => c.id === placement.componentId)?.category;
      if (
        category !== undefined &&
        WEAPON_GUN.has(category) &&
        !nationHasArmamentContent(source.armament, design.draft.nationId)
      ) {
        unresolvedArmamentPlacements += 1;
      }
    }
  }

  const dataQuality: ManifestDataQuality = {
    unresolvedArmamentPlacements,
    unresolvedMagazineRelationships,
    waivers,
    ...pinnedDataQuality(built.parts, designs, (id) => partById.get(id)),
  };
  const placements = gunPlacements + tubePlacements + fittingPlacements;
  return assemblePlan({
    parts: built.parts,
    slotTemplates: compatibility.slotTemplates,
    platforms: compatibility.platforms,
    records: {
      designs,
      dataQuality,
      gunPlacements,
      tubePlacements,
      fittingPlacements,
      placements,
    },
    source: {
      kind: "legacy",
      files: sortRefs(source.sourceFiles),
      hash: refsHash(source.sourceFiles),
    },
  });
}

export function planFromStaged(source: StagedSource): MigrationResult<MigrationPlan> {
  const failures: MigrationFailure[] = [];
  const partById = new Map<string, FlattenedPart>();
  for (const part of source.parts) {
    const previous = partById.get(part.id);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(part)) {
      failures.push(
        migrationFailure(
          "CODEMOD_DESTINATION_COLLISION",
          `parts.${part.id}`,
          "part id is duplicated.",
        ),
      );
      continue;
    }
    partById.set(part.id, part);
  }
  if (failures.length > 0) return { ok: false, failures };
  const parts = [...partById.values()].sort(byId);

  let gunPlacements = 0;
  let tubePlacements = 0;
  let fittingPlacements = 0;
  for (const design of source.designs) {
    for (const entry of design.loadout.entries) {
      const part = partById.get(entry.part);
      if (part === undefined) {
        failures.push(
          migrationFailure(
            "CODEMOD_MISSING_PART",
            `${design.id}.entries[${entry.id ?? entry.slot}]`,
            `part '${entry.part}' is absent.`,
          ),
        );
        continue;
      }
      if (part.family === "gun_mount") gunPlacements += 1;
      else if (part.family === "torpedo_launcher") tubePlacements += 1;
      else if (part.family === "fitting" || part.family === "sensor") fittingPlacements += 1;
    }
  }
  if (failures.length > 0) return { ok: false, failures };
  const placements = gunPlacements + tubePlacements + fittingPlacements;

  const dataQuality: ManifestDataQuality = source.previousDataQuality ?? {
    unresolvedArmamentPlacements: 0,
    unresolvedMagazineRelationships: 0,
    waivers: 0,
    ...pinnedDataQuality(parts, source.designs, (id) => partById.get(id)),
  };
  return assemblePlan({
    parts,
    slotTemplates: source.slotTemplates,
    platforms: source.platforms,
    records: {
      designs: source.designs,
      dataQuality,
      gunPlacements,
      tubePlacements,
      fittingPlacements,
      placements,
    },
    source: source.previousSource ?? {
      kind: "staged",
      files: sortRefs(source.sourceFiles),
      hash: refsHash(source.sourceFiles),
    },
  });
}
