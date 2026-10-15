import type { MediaAsset } from "@/content/mediaAsset.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { getNationPresentation } from "@/content/nationPresentationCatalog.js";

export function getCountryName(countryId: PlayableSlotCountryId): string {
  return getNationPresentation(countryId).name;
}

export function getCountryCode(countryId: PlayableSlotCountryId): string {
  return getNationPresentation(countryId).code;
}

export function resolveNationShip(countryId: PlayableSlotCountryId): MediaAsset | null {
  const ship = getNationPresentation(countryId).shipArtwork;
  return ship.status === "resolved" ? ship.asset : null;
}
