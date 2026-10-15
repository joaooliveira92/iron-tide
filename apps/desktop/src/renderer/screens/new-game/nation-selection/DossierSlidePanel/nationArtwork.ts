import type { MediaAsset } from "@/content/mediaAsset.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { getNationPresentation } from "@/content/nationPresentationCatalog.js";

export function resolveNationColours(countryId: PlayableSlotCountryId): MediaAsset | null {
  const colours = getNationPresentation(countryId).nationalColours;
  return colours.status === "resolved" ? colours.asset : null;
}

export function resolveNationShip(countryId: PlayableSlotCountryId): MediaAsset | null {
  const ship = getNationPresentation(countryId).shipArtwork;
  return ship.status === "resolved" ? ship.asset : null;
}

export function getCountryCode(countryId: PlayableSlotCountryId): string {
  return getNationPresentation(countryId).code;
}
