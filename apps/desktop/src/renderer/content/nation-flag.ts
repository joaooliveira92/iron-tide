import { resolveNationAsset } from "./resolveNationAsset.js";

/** Campaign nation id -> the playable-slot country id its flag art is keyed by. */
const FLAG_COUNTRY_ID: Readonly<Record<string, string>> = {
  uk: "gb",
  germany: "de",
  usa: "us",
  japan: "jp",
  france: "fr",
  italy: "it",
  russia: "ru",
  austria_hungary: "ah",
  spain: "es",
  qing: "qing",
  // Non-playable powers: the manifest keys their flag art by the campaign id.
  brazil: "brazil",
  portugal: "portugal",
  netherlands: "netherlands",
  belgium: "belgium",
  denmark: "denmark",
  greece: "greece",
  ottoman_empire: "ottoman_empire",
  chile: "chile",
  argentina: "argentina",
  siam: "siam",
  korea: "korea",
  egypt: "egypt",
  sweden_norway: "sweden_norway",
};

/**
 * The nation's flag (or ensign) URL, or null for powers without flag art yet.
 * Pure: maps a campaign nation id to the manifest's art; touches no campaign state.
 */
export function nationFlagUrl(nationId: string): string | null {
  const countryId = FLAG_COUNTRY_ID[nationId];
  if (countryId === undefined) return null;
  for (const kind of ["nation_flag", "nation_ensign"] as const) {
    const resolved = resolveNationAsset({ countryId }, kind);
    if (resolved.status === "resolved") return resolved.asset.url;
  }
  return null;
}
