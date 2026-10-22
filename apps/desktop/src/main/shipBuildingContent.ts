import { hashWithContext } from "@bluewave/deterministic";
import {
  battleOffersFromRulesets,
  presenceFromRulesets,
  type ShipBuildingCatalogue,
} from "@bluewave/content-compiler";
import {
  buildShipBuildingContent,
  type AuthoredArmamentContent,
  type ComponentDef,
  type HullFormRecord,
  type NationNavalProfile,
  type PropulsionPlant,
  type RawReferenceDesign,
  type ShipBuildingContent,
  type ShipBuildingData,
} from "@bluewave/ship-design";

import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

interface LoadedShipBuilding {
  readonly data: ShipBuildingData;
  readonly hash: string;
  readonly armamentHash: string;
}

let loaded: LoadedShipBuilding | null = null;
let cached: ShipBuildingContent | null = null;

function loadShipBuilding(): LoadedShipBuilding {
  if (loaded) return loaded;
  const { bundle, manifest } = readContentArtifact(resolveGeneratedContentDir());
  const catalogue = bundle.shipBuilding as ShipBuildingCatalogue | undefined;
  if (catalogue === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no ship-building catalogue.",
    );
  }
  const presence = presenceFromRulesets(bundle.rulesets);
  const data: ShipBuildingData = {
    components: catalogue.components as ComponentDef[],
    plants: catalogue.plants as unknown as PropulsionPlant[],
    hullForms: catalogue.hullForms as HullFormRecord[],
    balance: catalogue.balance as ShipBuildingData["balance"],
    technologies: bundle.technologies as { id: string; year: number }[],
    navalProfiles: catalogue.navalProfiles as unknown as NationNavalProfile[],
    armament: catalogue.armament as unknown as AuthoredArmamentContent,
    referenceDesigns: catalogue.referenceDesigns as RawReferenceDesign[],
    ...(catalogue.partModel !== undefined ? { partModel: catalogue.partModel } : {}),
    ...(presence === undefined ? {} : { presence }),
    ...(catalogue.designLoadouts !== undefined
      ? {
          designLoadouts: catalogue.designLoadouts as NonNullable<
            ShipBuildingData["designLoadouts"]
          >,
        }
      : {}),
  };
  loaded = {
    data,
    hash: hashWithContext(manifest.bodyHash, "ship-building-content"),
    armamentHash: hashWithContext(manifest.bodyHash, "armament-content"),
  };
  return loaded;
}

type BattleOfferRules = ReturnType<typeof battleOffersFromRulesets>;

let battleOffers: { readonly rules: BattleOfferRules | undefined } | null = null;

export function loadBattleOfferRules(): BattleOfferRules | undefined {
  if (battleOffers !== null) return battleOffers.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  battleOffers = { rules: battleOffersFromRulesets(bundle.rulesets) };
  return battleOffers.rules;
}

export function loadShipBuildingData(): ShipBuildingData {
  return loadShipBuilding().data;
}

export function loadShipBuildingContent(): ShipBuildingContent {
  if (cached) return cached;
  cached = buildShipBuildingContent(loadShipBuilding().data);
  return cached;
}

export function shipBuildingContentHash(): string {
  return loadShipBuilding().hash;
}

export function armamentContentHash(): string {
  return loadShipBuilding().armamentHash;
}
