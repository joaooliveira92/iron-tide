import type {
  OpeningBriefingArea,
  OpeningBriefingProjection,
  OpeningBriefingRelationsRow,
} from "@bluewave/campaign-engine";

const area = (areaId: string, name: string): OpeningBriefingArea => ({ areaId, name });

function row(
  nationId: string,
  name: string,
  relation: OpeningBriefingRelationsRow["relation"],
  tension: number,
  controlledAreas: readonly OpeningBriefingArea[],
  nap = false,
): OpeningBriefingRelationsRow {
  return { nationId, name, relation, tension, nap, controlledAreas };
}

export const JAPAN_RELATIONS: readonly OpeningBriefingRelationsRow[] = [
  row("qing", "Qing Dynasty", "neutral", 6, [
    area("chi_north_coast", "North China Coast"),
    area("chi_yangtze", "Yangtze Estuary (Shanghai)"),
  ]),
  row("russia", "Russian Empire", "neutral", 4, [
    area("rus_baltic_coast", "Russian Baltic Coast"),
    area("rus_pacific_coast", "Russian Pacific Coast (Vladivostok)"),
  ]),
  row("uk", "United Kingdom", "neutral", 5, [
    area("eng_home_coast", "English Home Waters"),
    area("sea_hong_kong", "Hong Kong"),
    area("sea_singapore", "Singapore / Straits"),
    area("pacific_australia", "Australia / NZ"),
  ]),
  row("france", "French Republic", "neutral", 5, [
    area("fra_chan_coast", "French Channel / Atlantic Coast"),
    area("indochina_cochinchina", "Cochinchina (Saigon)"),
    area("pacific_tahiti", "French Polynesia"),
  ]),
  row("usa", "United States", "neutral", 5, [
    area("usa_atlantic_coast", "US Atlantic Coast"),
    area("usa_pacific_coast", "US Pacific Coast"),
  ]),
  row("germany", "German Empire", "neutral", 5, [area("ger_baltic_coast", "German Baltic Coast")]),
  row("austria_hungary", "Austro-Hungarian Empire", "neutral", 5, [
    area("auh_adriatic_coast", "Adriatic Coast (Pola/Trieste)"),
  ]),
  row("brazil", "Empire of Brazil", "neutral", 5, [area("bra_rio_coast", "Rio de Janeiro")]),
];

export function japanProjection(
  overrides: Partial<OpeningBriefingProjection["foreignIntelligence"]> = {},
): OpeningBriefingProjection {
  return {
    nationId: "japan",
    nationName: "Empire of Japan",
    month: { month: 1, year: 1880 },
    stateOfTheNavy: {
      shipClassCounts: [],
      shipsUnderConstruction: 0,
      mostExpensiveActiveClass: null,
      largestDockCapacity: 0,
      totalMaintenance: 0,
      constructionCommitted: 0,
    },
    treasury: {
      governmentAllocation: 0,
      fleetMaintenance: 0,
      constructionCommitted: 0,
      researchExpenditure: 0,
      projectedSurplus: 0,
      status: "healthy",
      obligations: 0,
    },
    foreignIntelligence: {
      relations: JAPAN_RELATIONS,
      playerAreas: [
        area("jpn_home_coast", "Japan Home Waters (Tokyo/Yokosuka)"),
        area("jpn_kyushu_coast", "Kyushu (Sasebo/Nagasaki)"),
      ],
      ...overrides,
    },
    immediateConcerns: [],
  };
}
