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
  PlatformData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import {
  buildCompatibilitySlots,
  buildPartCatalogue,
  draftToLoadout,
  nationHasArmamentContent,
  partCatalogue,
  type DraftCompileContent,
  type DraftTranslationIssue,
  type SourceCatalogue,
} from "@bluewave/ship-design";
import { fromStagedJson, toStagedJson } from "./staged.js";
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

const familyFile = (family: string): string => `parts/${family}.json`;
const designFile = (nation: string): string => `designs/${nation}.json`;

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
      content: toStagedJson({ parts: records }),
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
      content: toStagedJson({ designs: records }),
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

function translationFailure(issue: DraftTranslationIssue): MigrationFailure {
  if (
    issue.code === "PART_READ_PATH_MISSING_PART" ||
    issue.code === "PART_READ_PATH_NO_GUN_MODEL"
  ) {
    return migrationFailure("CODEMOD_MISSING_PART", issue.path, issue.message);
  }
  return migrationFailure(
    "CODEMOD_UNTRANSLATED_PLACEMENT",
    issue.path,
    `${issue.code}: ${issue.message}`,
  );
}

function designLoadout(input: {
  readonly design: LegacySource["designs"][number];
  readonly content: DraftCompileContent;
  readonly failures: MigrationFailure[];
}): DesignLoadoutResult | null {
  const { design, content, failures } = input;
  const draft = design.draft;
  const forward = draftToLoadout({
    designId: design.id,
    draft,
    month: design.month,
    content,
  });
  if (forward.untranslated.length > 0) {
    failures.push(...forward.untranslated.map(translationFailure));
    return null;
  }

  const catalogue = partCatalogue({
    parts: forward.parts,
    slotTemplates: content.compatibility.slotTemplates,
    platforms: content.compatibility.platforms,
  });
  const slotOf = catalogue.slotLookup(draft.hull.hullFormId);
  for (const entry of forward.loadout.entries) {
    if (slotOf(entry.slot) === undefined) {
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

  const { header, loadout } = forward;
  const fit = catalogue.validate({
    loadout,
    month: design.month,
    conditions: {
      nation: { nationId: draft.nationId },
      mountCountRanges: forward.mountCountRanges,
    },
  });
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
    gunPlacements: forward.placements.guns,
    tubePlacements: forward.placements.tubes,
    fittingPlacements: forward.placements.fittings,
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
      const raw = fromStagedJson(file.content);
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
  if (path === "platforms.json") return "platforms";
  if (path === "slot-templates.json") return "slotTemplates";
  return "records";
}

function decodeGeneratedRecord(path: string, record: unknown): void {
  if (path.startsWith("parts/")) {
    decodeStrict(FlattenedPartSchema, record);
  } else if (path === "platforms.json") {
    decodeStrict(PlatformSchema, record);
  } else if (path === "slot-templates.json") {
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
      path: "platforms.json",
      records: input.platforms.length,
      content: toStagedJson({ platforms: [...input.platforms].sort(byId) }),
    },
    {
      path: "slot-templates.json",
      records: input.slotTemplates.length,
      content: toStagedJson({ slotTemplates: [...input.slotTemplates].sort(byId) }),
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
  const content: DraftCompileContent = {
    components: source.components,
    plants: source.plants,
    navalProfiles: source.profiles,
    armament: source.armament,
    armour: source.armour,
    compatibility,
    torpedoDiameterUm: source.torpedoDiameterUm,
    parts: built.parts,
  };

  const failures: MigrationFailure[] = [];
  const designs: StagedDesign[] = [];
  let gunPlacements = 0;
  let tubePlacements = 0;
  let fittingPlacements = 0;
  let unresolvedMagazineRelationships = 0;
  let waivers = 0;
  for (const design of [...source.designs].sort(byId)) {
    const before = failures.length;
    const result = designLoadout({ design, content, failures });
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
