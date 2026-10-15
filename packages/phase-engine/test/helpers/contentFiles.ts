import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeStrict,
  PropulsionPlantCatalogueSchema,
  ShipComponentCatalogueSchema,
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

const root = join(__dirname, "..", "..", "..", "..", "content", "production", "1880");
const sbDir = join(root, "ship-building");

const loadRaw = (rel: string): unknown => parse(readFileSync(join(root, rel), "utf8"));

/** Naval profiles live one file per nation under `ship-building/naval-profiles/` (ADR-0109). */
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

/** Deterministic nation order: the UK set leads, so `references[0]` stays the historical default. */
const nationOrder = (a: string, b: string): number =>
  a === b ? 0 : a === "uk" ? -1 : b === "uk" ? 1 : a < b ? -1 : 1;

/** Reference designs live one directory per nation (`starters.yaml` + `historical.yaml`) (ADR-0109). */
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

/**
 * The production ship-building data (SB-3 WS2), typed and with no `as unknown`
 * bridge: the component/plant/hull-form catalogues are decoded through their
 * content schemas, so the only casts are the single `as` the parsed balance and
 * technology mappings need. One builder for every phase-engine suite that wants
 * real 1880 content.
 */
export function productionShipBuildingData(
  options: { readonly navalProfiles?: boolean } = {},
): ShipBuildingData {
  return {
    components: decodeStrict(ShipComponentCatalogueSchema, loadRaw("ship-building/components.yaml"))
      .components,
    plants: decodeStrict(PropulsionPlantCatalogueSchema, loadRaw("ship-building/plants.yaml"))
      .plants,
    hullForms: decodeStrict(ShipHullFormCatalogueSchema, loadRaw("ship-building/hull-forms.yaml"))
      .hullForms,
    balance: loadRaw("ship-building/balance.yaml") as ShipBuildingData["balance"],
    technologies: loadRaw("technologies.yaml") as ShipBuildingData["technologies"],
    ...(options.navalProfiles ? { navalProfiles: readNavalProfileEntries() } : {}),
  };
}

/**
 * The production ship-building content. `withStudyRules` is off by default so a
 * submitted design is approved the same month (the fixtures' assumption; study
 * rules themselves are exercised in design-study.test.ts, ADR-0085).
 */
export function productionShipBuildingContent(
  options: { readonly navalProfiles?: boolean; readonly withStudyRules?: boolean } = {},
): ShipBuildingContent {
  const content = buildShipBuildingContent(productionShipBuildingData(options));
  return options.withStudyRules ? content : { ...content, study: null };
}
