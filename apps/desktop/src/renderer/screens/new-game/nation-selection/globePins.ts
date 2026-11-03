import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { getNationPresentation } from "@/content/nationPresentationCatalog.js";
import type { GlobePoint } from "./globeTypes.js";

export interface GlobePins {
  readonly points: readonly GlobePoint[];
  readonly colors: Readonly<Record<string, string>>;
}

export function globePins(): GlobePins {
  const points = PLAYABLE_SLOT_COUNTRY_IDS.map((countryId): GlobePoint => {
    const nation = getNationPresentation(countryId);
    return {
      countryId,
      lat: nation.coordinates.lat,
      lng: nation.coordinates.lng,
      label: nation.name,
      flagColor: nation.markerColour,
    };
  });
  return {
    points,
    colors: Object.fromEntries(points.map((point) => [point.countryId, point.flagColor])),
  };
}
