import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { safePath } from "./safePath.js";

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

export function discoverShipBuildingFiles(contentDir: string): ShipBuildingFileGroups {
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
      if (existsSync(join(contentDir, safePath(rel)))) groups[key].push(safePath(rel));
    }
  }

  groups.shipComponentFiles = listAuthoredFiles(contentDir, COMPONENT_DIR).map(safePath);
  groups.navalProfileFiles = listAuthoredFiles(contentDir, NAVAL_PROFILE_DIR).map(safePath);
  groups.referenceDesignFiles = listReferenceDesignFiles(contentDir).map(safePath);
  groups.partFiles = listAuthoredFiles(contentDir, PART_DIR).map(safePath);
  groups.designLoadoutFiles = listAuthoredFiles(contentDir, DESIGN_LOADOUT_DIR).map(safePath);
  return groups;
}

const CONTENT_MODULE_SUFFIX = ".ts";
const DOCUMENT_SUFFIX = ".json";

function listAuthoredFiles(
  contentDir: string,
  rel: string,
  suffixes: readonly string[] = [CONTENT_MODULE_SUFFIX, DOCUMENT_SUFFIX],
): string[] {
  const abs = join(contentDir, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .sort()
    .flatMap((entry) => {
      const child = join(rel, entry);
      if (statSync(join(contentDir, child)).isDirectory()) {
        return listAuthoredFiles(contentDir, child, suffixes);
      }
      return suffixes.some((suffix) => entry.endsWith(suffix)) ? [child] : [];
    });
}

function listReferenceDesignFiles(contentDir: string): string[] {
  const base = join(contentDir, REFERENCE_DESIGN_DIR);
  if (!existsSync(base)) return [];
  const nationOrder = (a: string, b: string): number =>
    a === b ? 0 : a === "uk" ? -1 : b === "uk" ? 1 : a < b ? -1 : 1;
  return readdirSync(base)
    .sort(nationOrder)
    .flatMap((nation) => {
      const dir = join(base, nation);
      if (!statSync(dir).isDirectory()) return [];
      const conventional = ["starters.ts", "historical.ts"]
        .map((name) => join(REFERENCE_DESIGN_DIR, nation, name))
        .filter((rel) => existsSync(join(contentDir, rel)));
      const extra = readdirSync(dir)
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
