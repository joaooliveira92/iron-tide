import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  AmmunitionCatalogueSchema,
  DesignLoadoutSchema,
  FlattenedPartSchema,
  GunFamilyCatalogueSchema,
  GunModelCatalogueSchema,
  GunMountCatalogueSchema,
  NavalProfileCatalogueSchema,
  PART_TAGS,
  PlatformSchema,
  PropulsionPlantCatalogueSchema,
  ReferenceDesignSchema,
  ShipComponentWithSourceCatalogueSchema,
  ShipHullFormCatalogueSchema,
  SlotTemplateSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { compareCodePoints, sha256Hex } from "@bluewave/deterministic";

import { fromStagedJson } from "./staged.js";
import { shipBalanceFromRecord } from "@bluewave/ship-design";
import type {
  AuthoredArmamentContent,
  ComponentDef,
  HullFormRecord,
  NationNavalProfile,
  PropulsionPlant,
  RawReferenceDesign,
  TorpedoModelSource,
} from "@bluewave/ship-design";
import { loadContentModule } from "@bluewave/content-compiler";
import { migrationFailure } from "./failure.js";
import type { MigrationFailure, MigrationResult } from "./failure.js";
import type { LegacySource, SourceFileRef, StagedDesign, StagedSource } from "./types.js";
import type { MigrationManifest } from "./types.js";

export interface LoadOptions {
  readonly contentDir: string;
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  readonly torpedoModels: readonly TorpedoModelSource[];
}

const filesWith = (dir: string, extension: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(extension))
    .sort(compareCodePoints);
};

const authoredFiles = (dir: string): string[] => filesWith(dir, ".ts");

const stagedFiles = (dir: string): string[] => filesWith(dir, ".json");

const directories = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareCodePoints);
};

const authoredFilesRecursive = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        return authoredFilesRecursive(child).map((file) => join(entry.name, file));
      }
      return entry.name.endsWith(".ts") ? [entry.name] : [];
    })
    .sort(compareCodePoints);
};

const declaredComponentFiles = (contentDir: string, sb: string): string[] => {
  const fallback = () =>
    authoredFilesRecursive(join(sb, "components")).map(
      (file) => `ship-building/components/${file}`,
    );
  const manifestPath = join(contentDir, "pack.json");
  if (!existsSync(manifestPath)) return fallback();
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      shipBuilding?: { shipComponents?: string[] };
    };
    const declared = manifest.shipBuilding?.shipComponents;
    return Array.isArray(declared) && declared.length > 0 ? declared : fallback();
  } catch {
    return fallback();
  }
};

function makeReader(contentDir: string) {
  const files: SourceFileRef[] = [];
  const read = (absolute: string): string => {
    const text = readFileSync(absolute, "utf8");
    files.push({
      path: relative(contentDir, absolute).split("\\").join("/"),
      sha256: sha256Hex(text),
    });
    return text;
  };
  return { read, files };
}

export function loadLegacySource(options: LoadOptions): MigrationResult<LegacySource> {
  const contentDir = options.contentDir;
  const sb = join(contentDir, "ship-building");
  const armamentDir = join(sb, "armament");
  const failures: MigrationFailure[] = [];
  const reader = makeReader(contentDir);

  const loadRequired = (absolute: string, label: string): unknown => {
    if (!existsSync(absolute)) {
      failures.push(
        migrationFailure("CODEMOD_INVALID_SOURCE", label, `missing file '${absolute}'.`),
      );
      return undefined;
    }
    try {
      reader.read(absolute);
      const loaded = loadContentModule(absolute);
      if (!loaded.ok) throw new Error(loaded.message);
      return loaded.document;
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          label,
          error instanceof Error ? error.message : String(error),
        ),
      );
      return undefined;
    }
  };

  const componentEntries: unknown[] = [];
  for (const file of declaredComponentFiles(contentDir, sb)) {
    const raw = loadRequired(join(contentDir, file), file);
    const components = (raw as { readonly components?: unknown[] } | undefined)?.components;
    if (Array.isArray(components)) {
      componentEntries.push(
        ...components.map((component) => ({ ...(component as object), sourceFile: file })),
      );
    }
  }
  const plantsRaw = loadRequired(join(sb, "plants.ts"), "plants.ts");
  const hullFormsRaw = loadRequired(join(sb, "hull-forms.ts"), "hull-forms.ts");
  const balanceRaw = loadRequired(join(sb, "balance.ts"), "balance.ts");
  const familiesRaw = loadRequired(join(armamentDir, "gun-families.ts"), "gun-families.ts");
  const modelsRaw = loadRequired(join(armamentDir, "gun-models.ts"), "gun-models.ts");
  const mountsRaw = loadRequired(join(armamentDir, "gun-mounts.ts"), "gun-mounts.ts");
  const ammoRaw = loadRequired(join(armamentDir, "ammunition.ts"), "ammunition.ts");
  if (failures.length > 0 || componentEntries.length === 0) return { ok: false, failures };

  const profileEntries: unknown[] = [];
  for (const file of authoredFiles(join(sb, "naval-profiles"))) {
    const raw = loadRequired(join(sb, "naval-profiles", file), `naval-profiles/${file}`);
    const profiles = (raw as { readonly navalProfiles?: unknown[] } | undefined)?.navalProfiles;
    if (Array.isArray(profiles)) profileEntries.push(...profiles);
  }

  const designEntries: unknown[] = [];
  const designRoot = join(sb, "reference-designs");
  for (const nation of directories(designRoot)) {
    for (const name of authoredFiles(join(designRoot, nation))) {
      const raw = loadRequired(
        join(designRoot, nation, name),
        `reference-designs/${nation}/${name}`,
      );
      const designs = (raw as { readonly designs?: unknown[] } | undefined)?.designs;
      if (Array.isArray(designs)) designEntries.push(...designs);
    }
  }
  if (failures.length > 0) return { ok: false, failures };

  try {
    const components = decodeStrict(ShipComponentWithSourceCatalogueSchema, {
      components: componentEntries,
    }).components as ComponentDef[];
    const plants = decodeStrict(PropulsionPlantCatalogueSchema, plantsRaw)
      .plants as PropulsionPlant[];
    const hullForms = decodeStrict(ShipHullFormCatalogueSchema, hullFormsRaw)
      .hullForms as HullFormRecord[];
    const balanceRecord = balanceRaw as { readonly ship: unknown };
    const shipBalance = shipBalanceFromRecord(balanceRecord.ship);
    const armament: AuthoredArmamentContent = {
      gunFamilies: decodeStrict(GunFamilyCatalogueSchema, familiesRaw).gunFamilies,
      gunModels: decodeStrict(GunModelCatalogueSchema, modelsRaw).gunModels,
      gunMounts: decodeStrict(GunMountCatalogueSchema, mountsRaw).gunMounts,
      ammunition: decodeStrict(AmmunitionCatalogueSchema, ammoRaw).ammunition,
    } as AuthoredArmamentContent;
    const profiles = decodeStrict(NavalProfileCatalogueSchema, { navalProfiles: profileEntries })
      .navalProfiles as NationNavalProfile[];
    const designs = designEntries.map((entry) =>
      decodeStrict(ReferenceDesignSchema, entry),
    ) as RawReferenceDesign[];
    return {
      ok: true,
      value: {
        components,
        plants,
        hullForms,
        armour: shipBalance.armour,
        armament,
        profiles,
        designs,
        tagVocabulary: PART_TAGS,
        torpedoDiameterUm: options.torpedoDiameterUm,
        torpedoModels: options.torpedoModels,
        sourceFiles: reader.files,
      },
    };
  } catch (error) {
    return {
      ok: false,
      failures: [
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          contentDir,
          error instanceof Error ? error.message : String(error),
        ),
      ],
    };
  }
}

const readJson = (path: string): unknown => {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
};

export function readStagedSource(stagingDir: string): MigrationResult<StagedSource> {
  const failures: MigrationFailure[] = [];
  const reader = makeReader(stagingDir);
  const readCollection = (dir: string, key: string, decode: (record: unknown) => void): void => {
    for (const file of stagedFiles(dir)) {
      const absolute = join(dir, file);
      let raw: unknown;
      try {
        raw = fromStagedJson(reader.read(absolute));
      } catch (error) {
        failures.push(
          migrationFailure(
            "CODEMOD_INVALID_SOURCE",
            file,
            `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        continue;
      }
      if (typeof raw !== "object" || raw === null) {
        failures.push(migrationFailure("CODEMOD_INVALID_SOURCE", file, "not a mapping."));
        continue;
      }
      const records = (raw as Record<string, unknown>)[key];
      if (!Array.isArray(records)) {
        failures.push(migrationFailure("CODEMOD_INVALID_SOURCE", file, `no '${key}' array.`));
        continue;
      }
      for (const record of records) {
        try {
          decode(record);
        } catch (error) {
          failures.push(
            migrationFailure(
              "CODEMOD_INVALID_SOURCE",
              file,
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      }
    }
  };

  const parts: StagedSource["parts"][number][] = [];
  readCollection(join(stagingDir, "parts"), "parts", (record) => {
    parts.push(decodeStrict(FlattenedPartSchema, record));
  });
  const platforms: StagedSource["platforms"][number][] = [];
  const platformRaw = readStagedCollection(reader, join(stagingDir, "platforms.json"), "platforms");
  for (const record of platformRaw) {
    try {
      platforms.push(decodeStrict(PlatformSchema, record));
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          "platforms.json",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }
  const slotTemplates: StagedSource["slotTemplates"][number][] = [];
  const slotRaw = readStagedCollection(
    reader,
    join(stagingDir, "slot-templates.json"),
    "slotTemplates",
  );
  for (const record of slotRaw) {
    try {
      slotTemplates.push(decodeStrict(SlotTemplateSchema, record));
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          "slot-templates.json",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const designs: StagedDesign[] = [];
  for (const file of stagedFiles(join(stagingDir, "designs"))) {
    let raw: unknown;
    try {
      raw = fromStagedJson(reader.read(join(stagingDir, "designs", file)));
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          `designs/${file}`,
          `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      continue;
    }
    const records =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)["designs"]
        : undefined;
    if (!Array.isArray(records)) {
      failures.push(
        migrationFailure("CODEMOD_INVALID_SOURCE", `designs/${file}`, "no 'designs' array."),
      );
      continue;
    }
    for (const record of records) {
      try {
        designs.push(decodeStagedDesign(record));
      } catch (error) {
        failures.push(
          migrationFailure(
            "CODEMOD_INVALID_SOURCE",
            `designs/${file}`,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }
  }

  const manifest = readJson(join(stagingDir, "manifest.json"));
  const stored =
    typeof manifest === "object" && manifest !== null
      ? (manifest as Partial<MigrationManifest>)
      : undefined;
  const previousDataQuality = stored?.dataQuality;
  const previousSource = stored?.source;

  if (failures.length > 0) return { ok: false, failures };
  return {
    ok: true,
    value: {
      parts: [...parts].sort((a, b) => compareCodePoints(a.id, b.id)),
      slotTemplates: [...slotTemplates].sort((a, b) => compareCodePoints(a.id, b.id)),
      platforms: [...platforms].sort((a, b) => compareCodePoints(a.id, b.id)),
      designs: [...designs].sort((a, b) => compareCodePoints(a.id, b.id)),
      sourceFiles: reader.files,
      ...(previousDataQuality !== undefined ? { previousDataQuality } : {}),
      ...(previousSource !== undefined ? { previousSource } : {}),
    },
  };
}

function readStagedCollection(
  reader: ReturnType<typeof makeReader>,
  absolute: string,
  key: string,
): unknown[] {
  if (!existsSync(absolute)) return [];
  const raw = fromStagedJson(reader.read(absolute));
  if (typeof raw !== "object" || raw === null) return [];
  const records = (raw as Record<string, unknown>)[key];
  return Array.isArray(records) ? records : [];
}

function decodeStagedDesign(record: unknown): StagedDesign {
  if (typeof record !== "object" || record === null) {
    throw new Error("a design must be a mapping.");
  }
  const o = record as Record<string, unknown>;
  const id = o["id"];
  const name = o["name"];
  const month = o["month"];
  const starterFor = o["starterFor"];
  if (typeof id !== "string" || typeof name !== "string" || typeof month !== "string") {
    throw new Error("a design needs string id, name and month.");
  }
  const decoded = decodeStrict(DesignLoadoutSchema, { header: o["header"], loadout: o["loadout"] });
  return {
    id,
    name,
    month,
    ...(typeof starterFor === "string" ? { starterFor } : {}),
    header: decoded.header,
    loadout: decoded.loadout,
  };
}
