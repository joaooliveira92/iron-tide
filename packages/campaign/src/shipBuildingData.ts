import { presenceFromRulesets } from "@bluewave/content-compiler";
import type { CompiledContentBundle } from "@bluewave/content-schema";
import type {
  AuthoredArmamentContent,
  ComponentDef,
  HullFormRecord,
  NationNavalProfile,
  PropulsionPlant,
  RawReferenceDesign,
  ShipBuildingData,
} from "@bluewave/ship-design";

export function shipBuildingDataFromBundle(
  bundle: CompiledContentBundle,
): ShipBuildingData | undefined {
  const catalogue = bundle.shipBuilding;
  if (catalogue === undefined) return undefined;
  const presence = presenceFromRulesets(bundle.rulesets);
  return {
    components: catalogue.components as ComponentDef[],
    plants: catalogue.plants as PropulsionPlant[],
    hullForms: catalogue.hullForms as HullFormRecord[],
    balance: catalogue.balance as ShipBuildingData["balance"],
    technologies: [...bundle.technologies] as { id: string; year: number }[],
    navalProfiles: catalogue.navalProfiles as NationNavalProfile[],
    armament: catalogue.armament as AuthoredArmamentContent,
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
}
