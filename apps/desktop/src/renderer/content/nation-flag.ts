import { resolveNationAsset } from "./resolveNationAsset.js";

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

export function nationFlagUrl(nationId: string): string | null {
  const countryId = FLAG_COUNTRY_ID[nationId];
  if (countryId === undefined) return null;
  for (const kind of ["nation_flag", "nation_ensign"] as const) {
    const resolved = resolveNationAsset({ countryId }, kind);
    if (resolved.status === "resolved") return resolved.asset.url;
  }
  return null;
}
