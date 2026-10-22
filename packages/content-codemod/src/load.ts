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
  ShipComponentCatalogueSchema,
  ShipHullFormCatalogueSchema,
  SlotTemplateSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { compareCodePoints, sha256Hex } from "@bluewave/deterministic";
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
import { fromYaml } from "./yaml.js";
import { migrationFailure } from "./failure.js";
import type { MigrationFailure, MigrationResult } from "./failure.js";
import type { LegacySource, SourceFileRef, StagedDesign, StagedSource } from "./types.js";
import type { MigrationManifest } from "./types.js";

export interface LoadOptions {
  readonly contentDir: string;
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  readonly torpedoModels: readonly TorpedoModelSource[];
}

const yamlFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort(compareCodePoints);
};

const directories = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareCodePoints);
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
      return fromYaml(reader.read(absolute));
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

  const componentsRaw = loadRequired(join(sb, "components.yaml"), "components.yaml");
  const plantsRaw = loadRequired(join(sb, "plants.yaml"), "plants.yaml");
  const hullFormsRaw = loadRequired(join(sb, "hull-forms.yaml"), "hull-forms.yaml");
  const balanceRaw = loadRequired(join(sb, "balance.yaml"), "balance.yaml");
  const familiesRaw = loadRequired(join(armamentDir, "gun-families.yaml"), "gun-families.yaml");
  const modelsRaw = loadRequired(join(armamentDir, "gun-models.yaml"), "gun-models.yaml");
  const mountsRaw = loadRequired(join(armamentDir, "gun-mounts.yaml"), "gun-mounts.yaml");
  const ammoRaw = loadRequired(join(armamentDir, "ammunition.yaml"), "ammunition.yaml");
  if (failures.length > 0 || componentsRaw === undefined) return { ok: false, failures };

  const profileEntries: unknown[] = [];
  for (const file of yamlFiles(join(sb, "naval-profiles"))) {
    const raw = loadRequired(join(sb, "naval-profiles", file), `naval-profiles/${file}`);
    const profiles = (raw as { readonly navalProfiles?: unknown[] } | undefined)?.navalProfiles;
    if (Array.isArray(profiles)) profileEntries.push(...profiles);
  }

  const designEntries: unknown[] = [];
  const designRoot = join(sb, "reference-designs");
  for (const nation of directories(designRoot)) {
    for (const name of yamlFiles(join(designRoot, nation))) {
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
    const components = decodeStrict(ShipComponentCatalogueSchema, componentsRaw)
      .components as ComponentDef[];
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
    for (const file of yamlFiles(dir)) {
      const absolute = join(dir, file);
      const raw = fromYaml(reader.read(absolute));
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
  const platformRaw = readJsonOrYaml(reader, join(stagingDir, "platforms.yaml"), "platforms");
  for (const record of platformRaw) {
    try {
      platforms.push(decodeStrict(PlatformSchema, record));
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          "platforms.yaml",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }
  const slotTemplates: StagedSource["slotTemplates"][number][] = [];
  const slotRaw = readJsonOrYaml(reader, join(stagingDir, "slot-templates.yaml"), "slotTemplates");
  for (const record of slotRaw) {
    try {
      slotTemplates.push(decodeStrict(SlotTemplateSchema, record));
    } catch (error) {
      failures.push(
        migrationFailure(
          "CODEMOD_INVALID_SOURCE",
          "slot-templates.yaml",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const designs: StagedDesign[] = [];
  for (const file of yamlFiles(join(stagingDir, "designs"))) {
    const raw = fromYaml(reader.read(join(stagingDir, "designs", file)));
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

function readJsonOrYaml(
  reader: ReturnType<typeof makeReader>,
  absolute: string,
  key: string,
): unknown[] {
  if (!existsSync(absolute)) return [];
  const raw = fromYaml(reader.read(absolute));
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
