import grandAdmiralArtwork from "../assets/archetype/grand_admiral-1.jpg";
import merchantPrinceArtwork from "../assets/archetype/merchant_prince-1.jpg";
import shipyardBaronArtwork from "../assets/archetype/shipyard_baron-1.jpg";

export type ArchetypeArtworkId = "merchant_prince" | "shipyard_baron" | "grand_admiral";

export const ARCHETYPE_ARTWORK: Readonly<Record<ArchetypeArtworkId, string>> = {
  merchant_prince: merchantPrinceArtwork,
  shipyard_baron: shipyardBaronArtwork,
  grand_admiral: grandAdmiralArtwork,
};

export function isArchetypeArtworkId(id: string): id is ArchetypeArtworkId {
  return Object.hasOwn(ARCHETYPE_ARTWORK, id);
}

export function getArchetypeArtwork(artworkId: ArchetypeArtworkId): string {
  return ARCHETYPE_ARTWORK[artworkId];
}
