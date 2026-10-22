import { SafeInt } from "@bluewave/contracts";

export interface Officer {
  id: string;
  name: string;
  rank: OfficerRank;
  skill: SafeInt;
}

export const OFFICER_RANKS = ["CAPTAIN", "COMMODORE", "REAR_ADMIRAL"] as const;
export type OfficerRank = (typeof OFFICER_RANKS)[number];

export const OFFICER_ACCURACY_PER_SKILL_BP = 20;
export const OFFICER_NEUTRAL_SKILL = 50;
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

const ROSTER_SHAPE: Readonly<Record<string, readonly [number, number, number]>> = {
  uk: [5, 3, 1],
  france: [4, 3, 1],
  germany: [4, 2, 1],
  russia: [3, 3, 1],
  usa: [3, 2, 1],
  italy: [3, 2, 1],
  japan: [3, 2, 1],
  austria_hungary: [2, 2, 1],
  spain: [2, 2, 1],
  qing: [2, 2, 1],
  ottoman_empire: [2, 2, 1],
  netherlands: [2, 1, 1],
  portugal: [2, 1, 1],
  brazil: [2, 2, 1],
};
const DEFAULT_ROSTER_SHAPE: readonly [number, number, number] = [2, 2, 1];

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function buildOfficerRoster(nationId: string): Officer[] {
  const given = GIVEN[nationId] ?? FALLBACK_GIVEN;
  const family = FAMILY[nationId] ?? FALLBACK_FAMILY;
  const [captains, commodores, rearAdmirals] = ROSTER_SHAPE[nationId] ?? DEFAULT_ROSTER_SHAPE;
  const ranks: OfficerRank[] = [
    ...Array<OfficerRank>(captains).fill("CAPTAIN"),
    ...Array<OfficerRank>(commodores).fill("COMMODORE"),
    ...Array<OfficerRank>(rearAdmirals).fill("REAR_ADMIRAL"),
  ];
  return ranks.map((rank, i) => {
    const id = `off_${nationId}_${String(i + 1)}`;
    return {
      id,
      name: `${given[i % given.length]!} ${family[(i + 2) % family.length]!}`,
      rank,
      skill: SafeInt(30 + (fnv(id) % 61)),
    };
  });
}
