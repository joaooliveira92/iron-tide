import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  AmmunitionCatalogueSchema,
  GunFamilyCatalogueSchema,
  GunModelCatalogueSchema,
  GunMountCatalogueSchema,
  decodeStrict,
} from "@bluewave/content-schema";
import { starterFor } from "../../src/shipTypeRoster.js";
import {
  type AuthoredArmamentContent,
  type ComponentDef,
  type NationNavalProfile,
  type StarterDesign,
} from "../../src/index.js";
import { type ArmamentStarter } from "../../src/armamentContent.js";
import {
  components,
  navalProfiles,
  readReferenceDesignEntries,
  shipBuildingData,
} from "./earlyContext.js";

const root = join(__dirname, "..", "..", "..", "..", "content", "production", "1880");
const armamentDir = join(root, "ship-building", "armament");
const read = (rel: string) => parse(readFileSync(join(armamentDir, rel), "utf8"));

export const armamentContent: AuthoredArmamentContent = {
  gunFamilies: decodeStrict(GunFamilyCatalogueSchema, read("gun-families.yaml")).gunFamilies,
  gunModels: decodeStrict(GunModelCatalogueSchema, read("gun-models.yaml")).gunModels,
  gunMounts: decodeStrict(GunMountCatalogueSchema, read("gun-mounts.yaml")).gunMounts,
  ammunition: decodeStrict(AmmunitionCatalogueSchema, read("ammunition.yaml")).ammunition,
} as unknown as AuthoredArmamentContent;

const GUN_CATEGORIES = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);
const byComponent = new Map(components.map((c) => [c.id, c]));

const designs = readReferenceDesignEntries();

const starters = designs.filter((d) => d.starterFor !== undefined) as StarterDesign[];

export const OPENING_MONTH = "1880-01";
const OPENING_NATIONS = ["uk", "france", "germany"] as const;
const OPENING_TYPES = ["B", "CA", "CL", "DD", "KE", "AMC"] as const;

export const armamentStarters: readonly ArmamentStarter[] = OPENING_NATIONS.flatMap((nationId) =>
  OPENING_TYPES.flatMap((type) => {
    const chosen = starterFor(type, starters, OPENING_MONTH, nationId);
    if (chosen === null) return [];
    const weapons = chosen.draft.placements
      .filter((p) => GUN_CATEGORIES.has(byComponent.get(p.componentId)?.category ?? ""))
      .map((p) => ({
        instanceId: p.instanceId,
        componentId: p.componentId,
        gunCount: p.params?.barrels ?? 1,
      }));
    return [{ id: chosen.id, month: chosen.month, nationId, weapons }];
  }),
);

export const armamentComponents: readonly ComponentDef[] = components;
export const armamentProfiles: readonly NationNavalProfile[] = navalProfiles;
export const armamentTechnologies = shipBuildingData.technologies;

export const armamentCoverageInput = {
  content: armamentContent,
  components,
  profiles: navalProfiles,
  starters: armamentStarters,
  technologies: shipBuildingData.technologies,
  release: true,
};
