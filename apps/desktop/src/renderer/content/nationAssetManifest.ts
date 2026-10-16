import brazil0Flag from "../assets/flags/brazil_empire_flag.png";
import portugal1Flag from "../assets/flags/portugal_monarchy_flag.png";
import netherlands2Flag from "../assets/flags/netherlands_flag.png";
import belgium3Flag from "../assets/flags/belgium_flag.png";
import denmark4Flag from "../assets/flags/denmark_flag.png";
import greece5Flag from "../assets/flags/greece_flag_1822.png";
import ottoman6Flag from "../assets/flags/ottoman_flag.png";
import chile7Flag from "../assets/flags/chile_flag.png";
import argentina8Flag from "../assets/flags/argentina_flag.png";
import siam9Flag from "../assets/flags/siam_flag_1855.png";
import korea10Flag from "../assets/flags/korea_joseon_flag.png";
import egypt11Flag from "../assets/flags/egypt_khedivate_flag.png";
import sweden12Flag from "../assets/flags/sweden_norway_union_jack.png";
import austrianFlag from "../assets/flags/austria_hungary_flag.png";
import frenchFlag from "../assets/flags/french_tricolor.png";
import germanFlag from "../assets/flags/german_imperial_tricolor.png";
import italianFlag from "../assets/flags/italian_savoy_flag.png";
import japanFlag from "../assets/flags/japan_rising_sun.png";
import qingFlag from "../assets/flags/qing_dragon_flag.png";
import russianFlag from "../assets/flags/russia_imperial_flag.png";
import spanishFlag from "../assets/flags/spain_flag_1880.png";
// The bundler owns the emitted URLs; these imports are the *only* place asset
// filenames appear. Components reach art through `resolveNationAsset`, keyed by
// stable id, so renaming a file can never break a screen.
import ukEnsign from "../assets/flags/uk_white_ensign_1880.png";
import usFlag from "../assets/flags/us_flag_44_stars.png";
import usShip from "../assets/ships/1880-naval-american-ship.png";
import austrianShip from "../assets/ships/1880-naval-austro-hungarian-ship.png";

import ukShip from "../assets/ships/1880-naval-british-ship.png";
import qingShip from "../assets/ships/1880-naval-chinese-ship.png";
import frenchShip from "../assets/ships/1880-naval-french-ship.png";
import germanShip from "../assets/ships/1880-naval-german-ship.png";
import italianShip from "../assets/ships/1880-naval-italian-ship.png";
import japanShip from "../assets/ships/1880-naval-japanese-ship.png";
import russianShip from "../assets/ships/1880-naval-russian-ship.png";
import spanishShip from "../assets/ships/1880-naval-spanish-ship.png";
import type { MediaAsset } from "./mediaAsset.js";
import type { NationAssetManifest } from "./resolveNationAsset.js";

/**
 * The country-identity id of each canonical playable slot, in CONTEXT.md §4
 * order. These are stable *content* ids, not the slots themselves — a slot is a
 * selection identity, while art binds to the identity layers (ADR-0003).
 */
export const PLAYABLE_SLOT_COUNTRY_IDS = [
  "gb",
  "de",
  "us",
  "jp",
  "fr",
  "it",
  "ru",
  "ah",
  "es",
  "qing",
] as const;

export type PlayableSlotCountryId = (typeof PLAYABLE_SLOT_COUNTRY_IDS)[number];

/** Terse constructor keeping the manifest table readable. */
function asset(assetId: string, kind: MediaAsset["kind"], url: string, label: string): MediaAsset {
  return { assetId, kind, url, label, provenance: "CANONICAL_CONTENT" };
}

/**
 * The 1880 content pack's nation art. Only the country layer is populated for
 * now: every playable slot's national colours plus its symbolic ship. Later
 * scenarios add regime/instance overrides without touching callers.
 *
 * The United Kingdom carries a `nation_ensign` (the white ensign) rather than a
 * `nation_flag` — a deliberate kind distinction, not an omission.
 */
export const NATION_ASSET_MANIFEST: NationAssetManifest = {
  countries: {
    gb: {
      nation_ensign: asset("gb.ensign.1880", "nation_ensign", ukEnsign, "White Ensign"),
      ship_silhouette: asset("gb.ship.1880", "ship_silhouette", ukShip, "British ironclad"),
    },
    de: {
      nation_flag: asset("de.flag.1880", "nation_flag", germanFlag, "Imperial German tricolour"),
      ship_silhouette: asset("de.ship.1880", "ship_silhouette", germanShip, "German ironclad"),
    },
    us: {
      nation_flag: asset("us.flag.1880", "nation_flag", usFlag, "United States flag, 44 stars"),
      ship_silhouette: asset("us.ship.1880", "ship_silhouette", usShip, "American ironclad"),
    },
    jp: {
      nation_flag: asset("jp.flag.1880", "nation_flag", japanFlag, "Rising Sun flag"),
      ship_silhouette: asset("jp.ship.1880", "ship_silhouette", japanShip, "Japanese ironclad"),
    },
    fr: {
      nation_flag: asset("fr.flag.1880", "nation_flag", frenchFlag, "French tricolour"),
      ship_silhouette: asset("fr.ship.1880", "ship_silhouette", frenchShip, "French ironclad"),
    },
    it: {
      nation_flag: asset(
        "it.flag.1880",
        "nation_flag",
        italianFlag,
        "Italian flag with Savoy arms",
      ),
      ship_silhouette: asset("it.ship.1880", "ship_silhouette", italianShip, "Italian ironclad"),
    },
    ru: {
      nation_flag: asset("ru.flag.1880", "nation_flag", russianFlag, "Russian imperial flag"),
      ship_silhouette: asset("ru.ship.1880", "ship_silhouette", russianShip, "Russian ironclad"),
    },
    ah: {
      nation_flag: asset("ah.flag.1880", "nation_flag", austrianFlag, "Austro-Hungarian flag"),
      ship_silhouette: asset(
        "ah.ship.1880",
        "ship_silhouette",
        austrianShip,
        "Austro-Hungarian ironclad",
      ),
    },
    es: {
      nation_flag: asset("es.flag.1880", "nation_flag", spanishFlag, "Spanish flag"),
      ship_silhouette: asset("es.ship.1880", "ship_silhouette", spanishShip, "Spanish ironclad"),
    },
    qing: {
      nation_flag: asset("qing.flag.1880", "nation_flag", qingFlag, "Qing dragon flag"),
      ship_silhouette: asset("qing.ship.1880", "ship_silhouette", qingShip, "Chinese ironclad"),
    },
    brazil: {
      nation_flag: asset("brazil.flag.1880", "nation_flag", brazil0Flag, "Empire of Brazil flag"),
    },
    portugal: {
      nation_flag: asset(
        "portugal.flag.1880",
        "nation_flag",
        portugal1Flag,
        "Portuguese monarchy flag",
      ),
    },
    netherlands: {
      nation_flag: asset(
        "netherlands.flag.1880",
        "nation_flag",
        netherlands2Flag,
        "Dutch tricolour",
      ),
    },
    belgium: {
      nation_flag: asset("belgium.flag.1880", "nation_flag", belgium3Flag, "Belgian tricolour"),
    },
    denmark: {
      nation_flag: asset("denmark.flag.1880", "nation_flag", denmark4Flag, "Danish flag"),
    },
    greece: {
      nation_flag: asset(
        "greece.flag.1880",
        "nation_flag",
        greece5Flag,
        "Greek flag (1822 pattern)",
      ),
    },
    ottoman_empire: {
      nation_flag: asset("ottoman_empire.flag.1880", "nation_flag", ottoman6Flag, "Ottoman flag"),
    },
    chile: {
      nation_flag: asset("chile.flag.1880", "nation_flag", chile7Flag, "Chilean flag"),
    },
    argentina: {
      nation_flag: asset("argentina.flag.1880", "nation_flag", argentina8Flag, "Argentine flag"),
    },
    siam: {
      nation_flag: asset("siam.flag.1880", "nation_flag", siam9Flag, "Siamese flag (1855)"),
    },
    korea: {
      nation_flag: asset("korea.flag.1880", "nation_flag", korea10Flag, "Joseon flag (1882)"),
    },
    egypt: {
      nation_flag: asset("egypt.flag.1880", "nation_flag", egypt11Flag, "Khedivate of Egypt flag"),
    },
    sweden_norway: {
      nation_flag: asset(
        "sweden_norway.flag.1880",
        "nation_flag",
        sweden12Flag,
        "Sweden-Norway union flag",
      ),
    },
  },
  regimes: {},
  instances: {},
};
