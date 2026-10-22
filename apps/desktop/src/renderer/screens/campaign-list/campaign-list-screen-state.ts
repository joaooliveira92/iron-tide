import type { SaveMetadata } from "@bluewave/persistence";

export interface CampaignListScreenState {
  readonly saves: readonly SaveMetadata[] | null;
  readonly loadError: string | null;
}

export function initialCampaignListScreenState(): CampaignListScreenState {
  return { saves: null, loadError: null };
}

export function applyListLoaded(
  state: CampaignListScreenState,
  saves: readonly SaveMetadata[],
): CampaignListScreenState {
  return { saves, loadError: null };
}

export function applyLoadFailed(
  state: CampaignListScreenState,
  error: string,
): CampaignListScreenState {
  return { ...state, loadError: error };
}

export function campaignDateLabel(metadata: SaveMetadata): string {
  if (metadata.campaignDate !== undefined) {
    const month = String(metadata.campaignDate.month).padStart(2, "0");
    return `${metadata.campaignDate.year}-${month}`;
  }
  return `Turn ${metadata.turnNumber}`;
}
