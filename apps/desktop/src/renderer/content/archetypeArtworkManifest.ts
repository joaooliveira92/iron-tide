/**
 * Card artwork for the "Choose your archetype" preset picker, presentation
 * content only — never authoritative state (mirrors
 * `preferenceArtworkManifest.ts`).
 *
 * Asset filenames appear only here; callers resolve by a stable id, so renaming
 * a file can never break the screen. The ids match the engine's validated
 * `ARCHETYPE_PRESETS` ids (`packages/campaign-engine/src/archetype.ts`).
 */
import grandAdmiralArtwork from "../assets/archetype/grand_admiral-1.jpg";
import merchantPrinceArtwork from "../assets/archetype/merchant_prince-1.jpg";
import shipyardBaronArtwork from "../assets/archetype/shipyard_baron-1.jpg";

/** Archetype ids the artwork manifest answers for; kept here so content never imports a screen. */
export type ArchetypeArtworkId = "merchant_prince" | "shipyard_baron" | "grand_admiral";

export const ARCHETYPE_ARTWORK: Readonly<Record<ArchetypeArtworkId, string>> = {
  merchant_prince: merchantPrinceArtwork,
  shipyard_baron: shipyardBaronArtwork,
  grand_admiral: grandAdmiralArtwork,
};

/** Narrows an engine preset id to one the manifest has artwork for. */
export function isArchetypeArtworkId(id: string): id is ArchetypeArtworkId {
  return Object.hasOwn(ARCHETYPE_ARTWORK, id);
}

export function getArchetypeArtwork(artworkId: ArchetypeArtworkId): string {
  return ARCHETYPE_ARTWORK[artworkId];
}
