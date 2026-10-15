export interface DisplayPreferences {
  showDetailedTooltips: boolean;
  confirmBeforeTurn: boolean;
  showUnitFatigue: boolean;
  showSupplyOverlay: boolean;
}

export interface CampaignConfigDisplay {
  readonly continuityMode: string;
  readonly fleetSize: string;
  readonly researchSpeed: string;
  readonly technologyVariation: string;
  readonly historicalBudget: string;
  readonly legacyFleetMode: string;
  readonly tacticalRealism: string;
  readonly difficulty: string;
}
