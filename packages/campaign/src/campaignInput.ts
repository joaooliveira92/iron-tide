import type {
  CampaignConstruction,
  CampaignDesign,
  CampaignDiplomacy,
  CampaignDivision,
  CampaignEconomy,
  CampaignFleet,
  CampaignResearch,
} from "@bluewave/content-schema";

export interface CampaignFileData {
  readonly fleets: readonly CampaignFleet[];
  readonly economies: readonly CampaignEconomy[];
  readonly constructions: readonly CampaignConstruction[];
  readonly diplomacy: readonly CampaignDiplomacy[];
  readonly research: readonly CampaignResearch[];
  readonly designs: readonly CampaignDesign[];
  readonly divisions: readonly CampaignDivision[];
}
