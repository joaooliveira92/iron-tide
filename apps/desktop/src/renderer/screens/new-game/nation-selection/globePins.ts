import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { getNationPresentation } from "@/content/nationPresentationCatalog.js";
import type { GlobePoint } from "./globeTypes.js";

/**
 * Marker colours for the globe pins, derived from the decoded presentation
 * corpus (the same authored record that carries each nation's coordinates and
 * flavor). Compatibility export for the globe's pin fill.
 */
export function dominantFlagColors(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    PLAYABLE_SLOT_COUNTRY_IDS.map((countryId) => [
      countryId,
      getNationPresentation(countryId).markerColour,
    ]),
  );
}

/** Globe markers derived from the decoded nation presentation records. */
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
