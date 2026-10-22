import admiralArtwork from "../assets/player-preferences/comerce.jpg";
import alternateHistoryArtwork from "../assets/player-preferences/fighting.jpg";
import cadetArtwork from "../assets/player-preferences/fog.jpg";
import navalHistorianArtwork from "../assets/player-preferences/shipbuilding.jpg";

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
