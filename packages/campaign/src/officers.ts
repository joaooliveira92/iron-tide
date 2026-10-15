import { SafeInt } from "@bluewave/contracts";

/**
 * Naval officers (ADR-0065). A nation's officer corps is a deterministic, fictional
 * roster generated from the nation id at compile time: no real person is named, and
 * the same pack always produces the same officers. Each officer has one command
 * rating (`skill`, 30..90) that a division commander adds to gunnery accuracy.
 */
export interface Officer {
  id: string;
  name: string;
  rank: OfficerRank;
  /** Command rating, 30..90; 50 is average. */
  skill: SafeInt;
}

export const OFFICER_RANKS = ["CAPTAIN", "COMMODORE", "REAR_ADMIRAL"] as const;
export type OfficerRank = (typeof OFFICER_RANKS)[number];

/** Accuracy multiplier (basis points) a division's commander gives its ships. */
export const OFFICER_ACCURACY_PER_SKILL_BP = 20;
export const OFFICER_NEUTRAL_SKILL = 50;
/** Multiplier for a division with no commander (DESIGN-26 vacant-commander penalty). */
export const VACANT_COMMANDER_ACCURACY_BP = 9_000;

export function officerAccuracyBp(skill: number): number {
  return 10_000 + (skill - OFFICER_NEUTRAL_SKILL) * OFFICER_ACCURACY_PER_SKILL_BP;
}

const GIVEN: Record<string, readonly string[]> = {
  uk: ["Edmund", "Charles", "Hugh", "Reginald", "Algernon", "Julian"],
  germany: ["Friedrich", "Otto", "Wilhelm", "Hans", "Karl", "Ernst"],
  usa: ["Nathaniel", "Josiah", "Thomas", "Warren", "Elias", "Samuel"],
  japan: ["Kenji", "Masaru", "Tadashi", "Hiroshi", "Yoshio", "Takeo"],
  france: ["Louis", "Henri", "Armand", "Gaston", "Etienne", "Lucien"],
  italy: ["Alberto", "Giovanni", "Carlo", "Enrico", "Paolo", "Vittorio"],
  russia: ["Nikolai", "Pavel", "Dmitri", "Alexei", "Sergei", "Mikhail"],
  austria_hungary: ["Franz", "Maximilian", "Leopold", "Anton", "Rudolf", "Ferenc"],
  spain: ["Fernando", "Alfonso", "Rafael", "Joaquin", "Ignacio", "Manuel"],
  qing: ["Wei", "Zhen", "Hong", "Ming", "Bao", "Lian"],
  ottoman_empire: ["Hasan", "Mehmed", "Osman", "Halil", "Mustafa", "Ahmed"],
  netherlands: ["Willem", "Jan", "Cornelis", "Pieter", "Joost", "Hendrik"],
  portugal: ["Joao", "Duarte", "Afonso", "Tomas", "Vasco", "Diogo"],
  brazil: ["Pedro", "Antonio", "Sebastiao", "Candido", "Luiz", "Marcos"],
};
const FAMILY: Record<string, readonly string[]> = {
  uk: ["Harcourt", "Wyndham", "Ashdown", "Pemberton", "Corbett", "Fairfax"],
  germany: ["von Rittberg", "Brandt", "Lindner", "von Haller", "Kessler", "Moltzau"],
  usa: ["Whitcomb", "Hargrove", "Tillman", "Prescott", "Dunmore", "Calloway"],
  japan: ["Aoyama", "Kuroda", "Sakurai", "Tomita", "Hayashida", "Ishikari"],
  france: ["de Valmont", "Duchesne", "Lacombe", "de Sarrian", "Rochefort", "Beaulieu"],
  italy: ["Montefiori", "Castellani", "Ruggieri", "Benedetti", "Sanfelice", "Orsolini"],
  russia: ["Kharitonov", "Belyaev", "Strogov", "Ostrovsky", "Vorontsev", "Tarasov"],
  austria_hungary: ["von Tessin", "Hartl", "Zichy", "von Wallner", "Erdody", "Kolowrat"],
  spain: ["de Alcazar", "Montoya", "Villaverde", "Cisneros", "de Aranda", "Bustillo"],
  qing: ["Liang", "Zhao", "Fang", "Shen", "Gu", "Tang"],
  ottoman_empire: ["Pasha Kemal", "Rauf", "Sadik", "Nazim", "Vehbi", "Tahir"],
  netherlands: ["van Heusden", "de Graaf", "Verbeek", "van Rijn", "Kuiper", "Dekker"],
  portugal: ["de Almeida", "Sarmento", "Cabral", "Vilhena", "Pinheiro", "Mascarenhas"],
  brazil: ["Tavares", "de Albuquerque", "Barroso", "Siqueira", "Camargo", "Rezende"],
};
const FALLBACK_GIVEN = ["Alex", "Morgan", "Robin", "Casey", "Jordan", "Sam"];
const FALLBACK_FAMILY = ["Stone", "Reed", "Hale", "Cross", "Marsh", "Vance"];

const ROSTER_SIZE = 6;

/** A small stable hash of a string (FNV-1a), for deterministic skill spread. */
function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The nation's officer corps: six officers, junior to senior, with a spread of skill. */
export function buildOfficerRoster(nationId: string): Officer[] {
  const given = GIVEN[nationId] ?? FALLBACK_GIVEN;
  const family = FAMILY[nationId] ?? FALLBACK_FAMILY;
  const officers: Officer[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) {
    const id = `off_${nationId}_${String(i + 1)}`;
    officers.push({
      id,
      name: `${given[i]!} ${family[(i + 2) % family.length]!}`,
      rank: i < 3 ? "CAPTAIN" : i < 5 ? "COMMODORE" : "REAR_ADMIRAL",
      skill: SafeInt(30 + (fnv(id) % 61)),
    });
  }
  return officers;
}
