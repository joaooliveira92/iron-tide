export type NamingConvention = "historical" | "generated" | "custom";
export type ShipNameReuse = "allowed" | "disabled";
export type MeasurementSystem = "imperial" | "metric";

export interface IdentityFieldOption<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly description?: string;
}

export const NAMING_CONVENTION_OPTIONS: ReadonlyArray<IdentityFieldOption<NamingConvention>> = [
  { value: "historical", label: "Historical", description: "Real names from the period" },
  { value: "generated", label: "Generated", description: "The Admiralty names your ships" },
  { value: "custom", label: "Custom", description: "Name every ship yourself" },
];

export const SHIP_NAME_REUSE_OPTIONS: ReadonlyArray<IdentityFieldOption<ShipNameReuse>> = [
  { value: "disabled", label: "Disabled", description: "A lost name is retired for good" },
  { value: "allowed", label: "Allowed", description: "Reuse the names of lost ships" },
];

export const MEASUREMENT_SYSTEM_OPTIONS: ReadonlyArray<IdentityFieldOption<MeasurementSystem>> = [
  { value: "imperial", label: "Imperial", description: "Inches, feet and yards" },
  { value: "metric", label: "Metric", description: "Metres and kilometres" },
];

export interface CampaignIdentityDraft {
  readonly admiralName: string;
  readonly campaignName: string;
  readonly namingConvention: NamingConvention;
  readonly shipNameReuse: ShipNameReuse;
  readonly measurementSystem: MeasurementSystem;
}

const ADMIRAL_CAMPAIGN_NAME_MAX_LENGTH = 60;

export function defaultCampaignIdentity(): CampaignIdentityDraft {
  return {
    admiralName: "",
    campaignName: "",
    namingConvention: "historical",
    shipNameReuse: "disabled",
    measurementSystem: "imperial",
  };
}

export function isCampaignIdentityValid(identity: CampaignIdentityDraft): boolean {
  return identity.admiralName.trim().length > 0 && identity.campaignName.trim().length > 0;
}

export function updateCampaignIdentity<K extends keyof CampaignIdentityDraft>(
  identity: CampaignIdentityDraft,
  field: K,
  value: CampaignIdentityDraft[K],
): CampaignIdentityDraft {
  if (field === "admiralName" || field === "campaignName") {
    const trimmedLength = (value as string).length;
    if (trimmedLength > ADMIRAL_CAMPAIGN_NAME_MAX_LENGTH) return identity;
  }
  return { ...identity, [field]: value };
}
