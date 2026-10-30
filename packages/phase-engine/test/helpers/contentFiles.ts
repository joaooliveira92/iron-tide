import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  decodeStrict,
  PropulsionPlantCatalogueSchema,
  ShipHullFormCatalogueSchema,
} from "@bluewave/content-schema";
import {
  buildShipBuildingContent,
  type NationNavalProfile,
  type RawReferenceDesign,
  type ShipBuildingContent,
  type ShipBuildingData,
} from "@bluewave/ship-design";
import { readComponentFiles } from "../../../ship-design/test/helpers/componentFiles.js";
import { readAuthoredFile } from "@bluewave/test-support";

const root = join(__dirname, "..", "..", "..", "..", "content", "production", "1880");
const sbDir = join(root, "ship-building");

const loadRaw = (rel: string): unknown => readAuthoredFile(join(root, rel));

export const readNavalProfileEntries = (): NationNavalProfile[] =>
  readdirSync(join(sbDir, "naval-profiles"))
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .flatMap(
      (f) =>
        (
          readAuthoredFile(join(sbDir, "naval-profiles", f)) as {
            navalProfiles: NationNavalProfile[];
          }
        ).navalProfiles,
    );

const nationOrder = (a: string, b: string): number =>
  a === b ? 0 : a === "uk" ? -1 : b === "uk" ? 1 : a < b ? -1 : 1;

export const readReferenceDesignEntries = (): RawReferenceDesign[] =>
  readdirSync(join(sbDir, "reference-designs"))
    .sort(nationOrder)
    .flatMap((nation) =>
      ["starters.ts", "historical.ts"].flatMap((name) => {
        const path = join(sbDir, "reference-designs", nation, name);
        return existsSync(path)
          ? (readAuthoredFile(path) as { designs: RawReferenceDesign[] }).designs
          : [];
      }),
    );

export function productionShipBuildingData(
  options: { readonly navalProfiles?: boolean } = {},
): ShipBuildingData {
  return {
    components: readComponentFiles(root).components,
    plants: decodeStrict(PropulsionPlantCatalogueSchema, loadRaw("ship-building/plants.ts")).plants,
    hullForms: decodeStrict(ShipHullFormCatalogueSchema, loadRaw("ship-building/hull-forms.ts"))
      .hullForms,
    balance: loadRaw("ship-building/balance.ts") as ShipBuildingData["balance"],
    technologies: loadRaw("technologies.ts") as ShipBuildingData["technologies"],
    ...(options.navalProfiles ? { navalProfiles: readNavalProfileEntries() } : {}),
  };
}

export function productionShipBuildingContent(
  options: { readonly navalProfiles?: boolean; readonly withStudyRules?: boolean } = {},
): ShipBuildingContent {
  const content = buildShipBuildingContent(productionShipBuildingData(options));
  return options.withStudyRules ? content : { ...content, study: null };
}
