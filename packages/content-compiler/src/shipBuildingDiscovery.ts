import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { safePath } from "./safePath.js";

export interface DirectoryReader {
  readonly exists: (path: string) => boolean;
  readonly readdir: (path: string) => string[];
  readonly isDirectory: (path: string) => boolean;
}

export const nodeDirectoryReader: DirectoryReader = {
  exists: existsSync,
  readdir: (path) => readdirSync(path),
  isDirectory: (path) => statSync(path).isDirectory(),
};

export interface ShipBuildingFileGroups {
  shipComponentFiles: string[];
  propulsionPlantFiles: string[];
  hullFormFiles: string[];
  shipBalanceFiles: string[];
  gunFamilyFiles: string[];
  gunModelFiles: string[];
  gunMountFiles: string[];
  ammunitionFiles: string[];
  navalProfileFiles: string[];
  referenceDesignFiles: string[];
  partFiles: string[];
  slotTemplateFiles: string[];
  platformFiles: string[];
  shipTypeFiles: string[];
  designLoadoutFiles: string[];
}

const FIXED_FILES: ReadonlyArray<readonly [keyof ShipBuildingFileGroups, string]> = [
  ["propulsionPlantFiles", "ship-building/plants"],
  ["hullFormFiles", "ship-building/hull-forms"],
  ["shipBalanceFiles", "ship-building/balance"],
  ["gunFamilyFiles", "ship-building/armament/gun-families"],
  ["gunModelFiles", "ship-building/armament/gun-models"],
  ["gunMountFiles", "ship-building/armament/gun-mounts"],
  ["ammunitionFiles", "ship-building/armament/ammunition"],
  ["slotTemplateFiles", "ship-building/slot-templates"],
  ["platformFiles", "ship-building/platforms"],
  ["shipTypeFiles", "ship-building/ship-types"],
];

const COMPONENT_DIR = "ship-building/components";
const NAVAL_PROFILE_DIR = "ship-building/naval-profiles";
const REFERENCE_DESIGN_DIR = "ship-building/reference-designs";
const PART_DIR = "ship-building/parts";
const DESIGN_LOADOUT_DIR = "ship-building/design-loadouts";

export function discoverShipBuildingFiles(
  contentDir: string,
  reader: DirectoryReader = nodeDirectoryReader,
): ShipBuildingFileGroups {
  const groups: ShipBuildingFileGroups = {
    shipComponentFiles: [],
    propulsionPlantFiles: [],
    hullFormFiles: [],
    shipBalanceFiles: [],
    gunFamilyFiles: [],
    gunModelFiles: [],
    gunMountFiles: [],
    ammunitionFiles: [],
    navalProfileFiles: [],
    referenceDesignFiles: [],
    partFiles: [],
    slotTemplateFiles: [],
    platformFiles: [],
    shipTypeFiles: [],
    designLoadoutFiles: [],
  };

  for (const [key, base] of FIXED_FILES) {
    for (const suffix of [CONTENT_MODULE_SUFFIX, DOCUMENT_SUFFIX]) {
      const rel = `${base}${suffix}`;
      if (reader.exists(join(contentDir, safePath(rel)))) groups[key].push(safePath(rel));
    }
  }

  groups.shipComponentFiles = listAuthoredFiles(reader, contentDir, COMPONENT_DIR).map(safePath);
  groups.navalProfileFiles = listAuthoredFiles(reader, contentDir, NAVAL_PROFILE_DIR).map(safePath);
  groups.referenceDesignFiles = listReferenceDesignFiles(reader, contentDir).map(safePath);
  groups.partFiles = listAuthoredFiles(reader, contentDir, PART_DIR).map(safePath);
  groups.designLoadoutFiles = listAuthoredFiles(reader, contentDir, DESIGN_LOADOUT_DIR).map(
    safePath,
  );
  return groups;
}

const CONTENT_MODULE_SUFFIX = ".ts";
const DOCUMENT_SUFFIX = ".json";

function listAuthoredFiles(
  reader: DirectoryReader,
  contentDir: string,
  rel: string,
  suffixes: readonly string[] = [CONTENT_MODULE_SUFFIX, DOCUMENT_SUFFIX],
): string[] {
  const abs = join(contentDir, rel);
  if (!reader.exists(abs)) return [];
  return reader
    .readdir(abs)
    .sort()
    .flatMap((entry) => {
      const child = join(rel, entry);
      if (reader.isDirectory(join(contentDir, child))) {
        return listAuthoredFiles(reader, contentDir, child, suffixes);
      }
      return suffixes.some((suffix) => entry.endsWith(suffix)) ? [child] : [];
    });
}

function listReferenceDesignFiles(reader: DirectoryReader, contentDir: string): string[] {
  const base = join(contentDir, REFERENCE_DESIGN_DIR);
  if (!reader.exists(base)) return [];
  const nationOrder = (a: string, b: string): number =>
    a === b ? 0 : a === "uk" ? -1 : b === "uk" ? 1 : a < b ? -1 : 1;
  return reader
    .readdir(base)
    .sort(nationOrder)
    .flatMap((nation) => {
      const dir = join(base, nation);
      if (!reader.isDirectory(dir)) return [];
      const conventional = ["starters.ts", "historical.ts"]
        .map((name) => join(REFERENCE_DESIGN_DIR, nation, name))
        .filter((rel) => reader.exists(join(contentDir, rel)));
      const extra = reader
        .readdir(dir)
        .filter(
          (entry) =>
            (entry.endsWith(CONTENT_MODULE_SUFFIX) || entry.endsWith(DOCUMENT_SUFFIX)) &&
            entry !== "starters.ts" &&
            entry !== "historical.ts",
        )
        .sort()
        .map((entry) => join(REFERENCE_DESIGN_DIR, nation, entry));
      return [...conventional, ...extra];
    });
}
