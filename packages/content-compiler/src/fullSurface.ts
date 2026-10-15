//packages/content-compiler/src/fullSurface.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { decodeStrict, PackManifestSchema, type PackManifest } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { CompilerInput } from "./index.js";
import { safePath } from "./safePath.js";
import { discoverShipBuildingFiles, type ShipBuildingFileGroups } from "./shipBuildingDiscovery.js";

/**
 * The ship-building catalogue collections: the `pack.json` `files` key that
 * declares each one, the discovery group that enumerates it by convention, and
 * the `CompilerInput` field it populates. The manifest is the single authority;
 * discovery is retained only to prove the declaration is complete (a discovered
 * file that is not declared fails, CAH-MAN-2).
 */
const SHIP_BUILDING_COLLECTIONS: ReadonlyArray<{
  readonly manifestKey: string;
  readonly groupKey: keyof ShipBuildingFileGroups;
  readonly inputKey: keyof CompilerInput;
  readonly label: string;
}> = [
  {
    manifestKey: "shipComponents",
    groupKey: "shipComponentFiles",
    inputKey: "shipComponentFiles",
    label: "ship component",
  },
  {
    manifestKey: "propulsionPlants",
    groupKey: "propulsionPlantFiles",
    inputKey: "propulsionPlantFiles",
    label: "propulsion plant",
  },
  {
    manifestKey: "hullForms",
    groupKey: "hullFormFiles",
    inputKey: "hullFormFiles",
    label: "hull form",
  },
  {
    manifestKey: "shipBalance",
    groupKey: "shipBalanceFiles",
    inputKey: "shipBalanceFiles",
    label: "ship balance",
  },
  {
    manifestKey: "gunFamilies",
    groupKey: "gunFamilyFiles",
    inputKey: "gunFamilyFiles",
    label: "gun family",
  },
  {
    manifestKey: "gunModels",
    groupKey: "gunModelFiles",
    inputKey: "gunModelFiles",
    label: "gun model",
  },
  {
    manifestKey: "gunMounts",
    groupKey: "gunMountFiles",
    inputKey: "gunMountFiles",
    label: "gun mount",
  },
  {
    manifestKey: "ammunition",
    groupKey: "ammunitionFiles",
    inputKey: "ammunitionFiles",
    label: "ammunition",
  },
  {
    manifestKey: "navalProfiles",
    groupKey: "navalProfileFiles",
    inputKey: "navalProfileFiles",
    label: "naval profile",
  },
  {
    manifestKey: "referenceDesigns",
    groupKey: "referenceDesignFiles",
    inputKey: "referenceDesignFiles",
    label: "reference design",
  },
  { manifestKey: "parts", groupKey: "partFiles", inputKey: "partFiles", label: "ship part" },
  {
    manifestKey: "slotTemplates",
    groupKey: "slotTemplateFiles",
    inputKey: "slotTemplateFiles",
    label: "slot template",
  },
  {
    manifestKey: "platforms",
    groupKey: "platformFiles",
    inputKey: "platformFiles",
    label: "platform",
  },
  {
    manifestKey: "shipTypes",
    groupKey: "shipTypeFiles",
    inputKey: "shipTypeFiles",
    label: "ship type",
  },
  {
    manifestKey: "designLoadouts",
    groupKey: "designLoadoutFiles",
    inputKey: "designLoadoutFiles",
    label: "reference design loadout",
  },
];

/**
 * Builds the full-surface `CompilerInput` (content-pack collections **and** the
 * ship-building catalogue) from a pack manifest + content directory. Shared by
 * the compiler CLI's `content:check`/`content:build` and by the build-time
 * artifact generator, so there is one discovery path, not two.
 *
 * The manifest's `files` map is the single declaration of the loaded surface
 * (CAH-MAN-1); the ship-building subtree is declared there too. Discovery under
 * the conventional ship-building tree is retained as a resolver that must agree
 * with the declaration: a file discovered under a declared collection but not
 * declared fails, and a declared file that does not exist fails (CAH-MAN-2).
 *
 * Throws a descriptive `Error` on a missing manifest/content directory or an
 * unparseable manifest; every resolved path is `safePath`-checked. When a
 * `collector` is supplied, declaration-agreement failures become diagnostics
 * instead of throws.
 */
export function buildFullSurfaceInput(
  manifestPath: string,
  contentDir: string,
  collector?: DiagnosticCollector,
): CompilerInput | undefined {
  const resolvedManifest = resolve(manifestPath);
  const resolvedContentDir = resolve(contentDir);
  if (!existsSync(resolvedManifest)) {
    throw new Error(`Manifest not found: ${resolvedManifest}`);
  }
  if (!existsSync(resolvedContentDir)) {
    throw new Error(`Content directory not found: ${resolvedContentDir}`);
  }

  const report = (message: string, path: string, remediation?: string): void => {
    if (collector) {
      collector.addError("MANIFEST", message, {
        stage: "validate",
        sourceLocation: { path, line: 1 },
        remediation,
      });
    } else {
      throw new Error(message);
    }
  };

  let manifest: PackManifest;
  let manifestText: string;
  try {
    manifestText = readFileSync(resolvedManifest, "utf8");
    manifest = decodeStrict(PackManifestSchema, JSON.parse(manifestText));
  } catch (err) {
    report(
      `Invalid pack manifest ${resolvedManifest}: ${err instanceof Error ? err.message : String(err)}`,
      "pack.json",
      "Fix the manifest to match the pack-manifest schema (name, version, type, files, shipBuilding).",
    );
    return undefined;
  }

  const files = manifest.files ?? {};
  const shipBuilding = manifest.shipBuilding ?? {};
  const toAbsolute = (file: string) => resolve(resolvedContentDir, safePath(file));

  assertDeclaredFilesExist(files, "files", resolvedContentDir, report);
  assertDeclaredFilesExist(shipBuilding, "shipBuilding", resolvedContentDir, report);

  const discovered = discoverShipBuildingFiles(resolvedContentDir);
  const declaredByInputKey: Partial<Record<keyof CompilerInput, string[]>> = {};

  for (const spec of SHIP_BUILDING_COLLECTIONS) {
    const declared = shipBuilding[spec.manifestKey] ?? [];
    const discoveredPaths = discovered[spec.groupKey];
    assertDiscoveredAreDeclared(declared, discoveredPaths, spec, report);
    declaredByInputKey[spec.inputKey] = declared.map(toAbsolute);
  }

  return {
    manifestPath: resolvedManifest,
    contentDir: resolvedContentDir,
    rulesetFiles: (files.rulesets ?? []).map(toAbsolute),
    countryFiles: (files.countries ?? []).map(toAbsolute),
    areaFiles: (files.areas ?? []).map(toAbsolute),
    routeFiles: (files.routes ?? []).map(toAbsolute),
    possessionFiles: (files.possessions ?? []).map(toAbsolute),
    portFiles: (files.ports ?? []).map(toAbsolute),
    technologyFiles: (files.technologies ?? []).map(toAbsolute),
    shipComponentFiles: declaredByInputKey.shipComponentFiles,
    propulsionPlantFiles: declaredByInputKey.propulsionPlantFiles,
    hullFormFiles: declaredByInputKey.hullFormFiles,
    shipBalanceFiles: declaredByInputKey.shipBalanceFiles,
    gunFamilyFiles: declaredByInputKey.gunFamilyFiles,
    gunModelFiles: declaredByInputKey.gunModelFiles,
    gunMountFiles: declaredByInputKey.gunMountFiles,
    ammunitionFiles: declaredByInputKey.ammunitionFiles,
    navalProfileFiles: declaredByInputKey.navalProfileFiles,
    referenceDesignFiles: declaredByInputKey.referenceDesignFiles,
    partFiles: declaredByInputKey.partFiles,
    slotTemplateFiles: declaredByInputKey.slotTemplateFiles,
    platformFiles: declaredByInputKey.platformFiles,
    shipTypeFiles: declaredByInputKey.shipTypeFiles,
    designLoadoutFiles: declaredByInputKey.designLoadoutFiles,
    fleetFiles: (files.fleets ?? []).map(toAbsolute),
    economyFiles: (files.economies ?? []).map(toAbsolute),
    constructionFiles: (files.constructions ?? []).map(toAbsolute),
    diplomacyFiles: (files.diplomacy ?? []).map(toAbsolute),
    researchFiles: (files.research ?? []).map(toAbsolute),
    designFiles: (files.designs ?? []).map(toAbsolute),
    presentationFiles: (files.presentation ?? []).map(toAbsolute),
  };
}

/** Every file the manifest declares must exist on disk (CAH-MAN-2). */
function assertDeclaredFilesExist(
  declarations: Readonly<Record<string, readonly string[]>>,
  section: string,
  contentDir: string,
  report: (message: string, path: string, remediation?: string) => void,
): void {
  for (const [key, entries] of Object.entries(declarations)) {
    for (const entry of entries) {
      let resolved: string;
      try {
        resolved = resolve(contentDir, safePath(entry));
      } catch (err) {
        report(
          `Declared file '${entry}' in pack.json ${section}.${key} is unsafe: ${err instanceof Error ? err.message : String(err)}`,
          "pack.json",
        );
        continue;
      }
      if (!existsSync(resolved)) {
        report(
          `Declared file '${entry}' (pack.json ${section}.${key}) does not exist under the content directory`,
          "pack.json",
          `Remove the declaration or add the file at '${entry}'`,
        );
      }
    }
  }
}

/** A file discovered by convention but not declared is a fail-closed error (CAH-MAN-2). */
function assertDiscoveredAreDeclared(
  declared: readonly string[],
  discovered: readonly string[],
  spec: { readonly manifestKey: string; readonly label: string },
  report: (message: string, path: string, remediation?: string) => void,
): void {
  if (discovered.length === 0) return;
  const declaredSet = new Set(declared.map((file) => safePath(file)));
  for (const found of discovered) {
    const normalized = safePath(found);
    if (!declaredSet.has(normalized)) {
      report(
        `Undeclared ${spec.label} file '${normalized}' was discovered but is not declared in pack.json shipBuilding.${spec.manifestKey}`,
        normalized,
        `Add '${normalized}' to pack.json shipBuilding.${spec.manifestKey} or remove the file`,
      );
    }
  }
}
