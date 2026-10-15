import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";

export type GlobePoint = {
  countryId: PlayableSlotCountryId;
  lat: number;
  lng: number;
  label: string;
  flagColor: string;
};
