import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { getNationPresentation } from "@/content/nationPresentationCatalog.js";
import type { GlobePoint } from "./globeTypes.js";

export function dominantFlagColors(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    PLAYABLE_SLOT_COUNTRY_IDS.map((countryId) => [
      countryId,
      getNationPresentation(countryId).markerColour,
    ]),
  );
}

export function globePoints(): GlobePoint[] {
  return PLAYABLE_SLOT_COUNTRY_IDS.map((countryId) => {
    const nation = getNationPresentation(countryId);
    return {
      countryId,
      lat: nation.coordinates.lat,
      lng: nation.coordinates.lng,
      label: nation.name,
      flagColor: nation.markerColour,
    };
  });
}
