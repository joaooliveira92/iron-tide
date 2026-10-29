import { existsSync, readdirSync, readFileSync } from "node:fs";
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
import { parse } from "yaml";
import { readComponentFiles } from "../../../ship-design/test/helpers/componentFiles.js";

const root = join(__dirname, "..", "..", "..", "..", "content", "production", "1880");
const sbDir = join(root, "ship-building");

const loadRaw = (rel: string): unknown => parse(readFileSync(join(root, rel), "utf8"));

export const readNavalProfileEntries = (): NationNavalProfile[] =>
  readdirSync(join(sbDir, "naval-profiles"))
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .flatMap(
      (f) =>
        (
          parse(readFileSync(join(sbDir, "naval-profiles", f), "utf8")) as {
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
      ["starters.yaml", "historical.yaml"].flatMap((name) => {
        const path = join(sbDir, "reference-designs", nation, name);
        return existsSync(path)
          ? (parse(readFileSync(path, "utf8")) as { designs: RawReferenceDesign[] }).designs
          : [];
      }),
    );

export function productionShipBuildingData(
  options: { readonly navalProfiles?: boolean } = {},
): ShipBuildingData {
  return {
    components: readComponentFiles(root).components,
    plants: decodeStrict(PropulsionPlantCatalogueSchema, loadRaw("ship-building/plants.yaml"))
      .plants,
    hullForms: decodeStrict(ShipHullFormCatalogueSchema, loadRaw("ship-building/hull-forms.yaml"))
      .hullForms,
    balance: loadRaw("ship-building/balance.yaml") as ShipBuildingData["balance"],
    technologies: loadRaw("technologies.yaml") as ShipBuildingData["technologies"],
    ...(options.navalProfiles ? { navalProfiles: readNavalProfileEntries() } : {}),
  };
}

export function productionShipBuildingContent(
  options: { readonly navalProfiles?: boolean; readonly withStudyRules?: boolean } = {},
): ShipBuildingContent {
  const content = buildShipBuildingContent(productionShipBuildingData(options));
  return options.withStudyRules ? content : { ...content, study: null };
}
