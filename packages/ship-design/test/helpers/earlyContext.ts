import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  AmmunitionCatalogueSchema,
  GunFamilyCatalogueSchema,
  GunModelCatalogueSchema,
  GunMountCatalogueSchema,
  NavalProfileCatalogueSchema,
  PropulsionPlantCatalogueSchema,
  ShipHullFormCatalogueSchema,
  ShipTypeRecordSchema,
  decodeStrict,
  type ShipTypeRecord,
} from "@bluewave/content-schema";
import {
  buildShipBuildingContent,
  shipBalanceFromRecord,
  type AuthoredArmamentContent,
  type ConstructionBalance,
  type CostBalance,
  type HullFormRecord,
  type NationNavalProfile,
  type PropulsionPlant,
  type RawReferenceDesign,
  type ShipBuildingData,
  type ShipContext,
} from "../../src/index.js";
import { type CveBalance } from "../../src/cve.js";
import { readComponentFiles } from "./componentFiles.js";
import { readAuthoredFile } from "@bluewave/test-support";

const root = join(__dirname, "..", "..", "..", "..", "content", "production", "1880");
const sbDir = join(root, "ship-building");
const load = (rel: string) => readAuthoredFile(join(root, rel)) as Record<string, unknown>;

export const readNavalProfileEntries = (): unknown[] =>
  readdirSync(join(sbDir, "naval-profiles"))
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .flatMap(
      (f) =>
        (
          readAuthoredFile(join(sbDir, "naval-profiles", f)) as {
            navalProfiles: unknown[];
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

const armamentDir = join(root, "ship-building", "armament");
const loadArmament = (rel: string) =>
  readAuthoredFile(join(armamentDir, rel)) as Record<string, unknown>;

export const armamentContent: AuthoredArmamentContent = {
  gunFamilies: decodeStrict(GunFamilyCatalogueSchema, loadArmament("gun-families.ts")).gunFamilies,
  gunModels: decodeStrict(GunModelCatalogueSchema, loadArmament("gun-models.ts")).gunModels,
  gunMounts: decodeStrict(GunMountCatalogueSchema, loadArmament("gun-mounts.ts")).gunMounts,
  ammunition: decodeStrict(AmmunitionCatalogueSchema, loadArmament("ammunition.ts")).ammunition,
} as unknown as AuthoredArmamentContent;

export const { components, sourceById: componentSourceById } = readComponentFiles(root);
export const plants = decodeStrict(PropulsionPlantCatalogueSchema, load("ship-building/plants.ts"))
  .plants as unknown as PropulsionPlant[];
export const hullRecords = decodeStrict(
  ShipHullFormCatalogueSchema,
  load("ship-building/hull-forms.ts"),
).hullForms as HullFormRecord[];
const balanceFile = load("ship-building/balance.ts");
export const shipBalance = shipBalanceFromRecord(balanceFile.ship);
export const costBalance = balanceFile.cost as CostBalance;
export const constructionBalance = balanceFile.construction as ConstructionBalance;
export const cveBalance = balanceFile.cve as CveBalance;
const techs = readAuthoredFile(join(root, "technologies.ts")) as {
  id: string;
  year: number;
}[];

export const shipBuildingData: ShipBuildingData = {
  components,
  plants,
  hullForms: hullRecords,
  balance: balanceFile as unknown as ShipBuildingData["balance"],
  technologies: techs,
  navalProfiles: decodeStrict(NavalProfileCatalogueSchema, {
    navalProfiles: readNavalProfileEntries(),
  }).navalProfiles as unknown as NationNavalProfile[],
  armament: armamentContent,
  referenceDesigns: readReferenceDesignEntries(),
};
export const shipBuildingContent = buildShipBuildingContent(shipBuildingData);
export const navalProfiles = shipBuildingData.navalProfiles!;

export const shipTypes: ShipTypeRecord[] = (
  readAuthoredFile(join(sbDir, "ship-types.ts")) as { shipTypes: unknown[] }
).shipTypes.map((record) => decodeStrict(ShipTypeRecordSchema, record));

const withShipTypes = (ctx: ShipContext): ShipContext => ({ ...ctx, shipTypes });

export const earlyContext = (month: string): ShipContext =>
  withShipTypes(shipBuildingContent.environmentFor(month).ctx);
export const nationalContext = (month: string, nationId: string): ShipContext =>
  withShipTypes(shipBuildingContent.environmentFor(month, nationId).ctx);
export const threats = shipBuildingData.balance.environment.threats;
