//packages/content-compiler/src/shipBuildingDiscovery.ts
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { safePath } from "./safePath.js";

/**
 * Discovers the ship-building catalogue files that sit beside the content-pack
 * manifest (`content/production/<scenario>/ship-building/**`), by the same
 * convention the desktop main process uses (ADR-0109). The groups mirror the
 * compiler's full-surface input; a missing ship-building tree yields empty
 * groups, so `content:check`/`content:build` still cover a content-pack-only
 * pack. Every path is `safePath`-checked before it is handed to the compiler.
 */
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

/** Fixed ship-building catalogue files, one file per collection. */
const FIXED_FILES: ReadonlyArray<readonly [keyof ShipBuildingFileGroups, string]> = [
  ["shipComponentFiles", "ship-building/components.yaml"],
  ["propulsionPlantFiles", "ship-building/plants.yaml"],
  ["hullFormFiles", "ship-building/hull-forms.yaml"],
  ["shipBalanceFiles", "ship-building/balance.yaml"],
  ["gunFamilyFiles", "ship-building/armament/gun-families.yaml"],
  ["gunModelFiles", "ship-building/armament/gun-models.yaml"],
  ["gunMountFiles", "ship-building/armament/gun-mounts.yaml"],
  ["ammunitionFiles", "ship-building/armament/ammunition.yaml"],
  ["slotTemplateFiles", "ship-building/slot-templates.yaml"],
  ["platformFiles", "ship-building/platforms.yaml"],
  ["shipTypeFiles", "ship-building/ship-types.yaml"],
];

const NAVAL_PROFILE_DIR = "ship-building/naval-profiles";
const REFERENCE_DESIGN_DIR = "ship-building/reference-designs";
/** The ship part catalogue (ship-part-model SPM-R1): any number of files, one family or theme each. */
const PART_DIR = "ship-building/parts";
/** Authoritative reference designs in the parts representation (ship-part-model ticket 11d). */
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

  for (const [key, rel] of FIXED_FILES) {
    if (existsSync(join(contentDir, safePath(rel)))) {
      groups[key].push(safePath(rel));
    }
  }

  groups.navalProfileFiles = listYamlFiles(contentDir, NAVAL_PROFILE_DIR).map(safePath);
  groups.referenceDesignFiles = listReferenceDesignFiles(contentDir).map(safePath);
  groups.partFiles = listYamlFiles(contentDir, PART_DIR).map(safePath);
  groups.designLoadoutFiles = listYamlFiles(contentDir, DESIGN_LOADOUT_DIR).map(safePath);
  return groups;
}

/** Every `.yaml` file under a directory, recursively, in sorted (deterministic) order. */
function listYamlFiles(contentDir: string, rel: string): string[] {
  const abs = join(contentDir, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .sort()
    .flatMap((entry) => {
      const child = join(rel, entry);
      if (statSync(join(contentDir, child)).isDirectory()) {
        return listYamlFiles(contentDir, child);
      }
      return entry.endsWith(".yaml") ? [child] : [];
    });
}

/**
 * Reference-design files, one directory per nation, UK first (ADR-0109
 * historical default). Within a nation the two conventional files lead in
 * `starters`-then-`historical` order (the runtime default), followed by any
 * other authored `.yaml` in sorted order so no reference design is silently
 * dropped from the compiled surface.
 */
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
      const conventional = ["starters.yaml", "historical.yaml"]
        .map((name) => join(REFERENCE_DESIGN_DIR, nation, name))
        .filter((rel) => existsSync(join(contentDir, rel)));
      const extra = readdirSync(dir)
        .filter(
          (entry) =>
            entry.endsWith(".yaml") && entry !== "starters.yaml" && entry !== "historical.yaml",
        )
        .sort()
        .map((entry) => join(REFERENCE_DESIGN_DIR, nation, entry));
      return [...conventional, ...extra];
    });
}
