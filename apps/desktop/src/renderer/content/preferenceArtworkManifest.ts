/**
 * Card artwork for the "Rules of the Naval Age" preset picker (spec §2),
 * presentation content only — never authoritative state (mirrors
 * `nationAssetManifest.ts`).
 *
 * As with the nation art manifest, asset filenames appear only here; callers
 * resolve by a stable id, so renaming a file can never break the screen.
 */
import admiralArtwork from "../assets/player-preferences/comerce.jpg";
import alternateHistoryArtwork from "../assets/player-preferences/fighting.jpg";
import cadetArtwork from "../assets/player-preferences/fog.jpg";
import navalHistorianArtwork from "../assets/player-preferences/shipbuilding.jpg";

/** Preset ids the artwork manifest answers for; kept here so content never imports a screen. */
export type PreferenceArtworkId = "cadet" | "admiral" | "naval_historian" | "alternate_history";

export const PREFERENCE_ARTWORK: Readonly<Record<PreferenceArtworkId, string>> = {
  cadet: cadetArtwork,
  admiral: admiralArtwork,
  naval_historian: navalHistorianArtwork,
  alternate_history: alternateHistoryArtwork,
};

export function getPreferenceArtwork(artworkId: PreferenceArtworkId): string {
  return PREFERENCE_ARTWORK[artworkId];
}
