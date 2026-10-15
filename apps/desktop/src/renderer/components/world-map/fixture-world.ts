/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * A hand-authored 36-area world at ticket 01's fidelity, standing in for the
 * dataset that milestone 6 implementation will author. Nothing here is
 * canonical: the ids do not exist in any content pack, the ownerships are
 * roughly 1910 and roughly right, and the polygons are coarse by intent.
 *
 * Its job is to be *dense enough to judge* — 36 areas, 8 nations, 9 passages,
 * 34 possessions, 12 fleets, ~80 edges — because ticket 06's question ("how
 * does this look and feel") cannot be answered against the two-area fixture
 * the repo ships today.
 *
 * Three geometry representations sit side by side on purpose, because which
 * of them the real schema needs is one of the things this prototype is for:
 *
 *   ring   — a coarse lon/lat polygon, authored in *continuous* longitude so
 *            a ring may run past 180 (see `area_central_pacific`). Normalising
 *            happens at render time.
 *   label  — a hand-placed lon/lat label anchor. Variant C ignores it and uses
 *            a computed centroid instead, so the two can be compared directly.
 *   tile   — a column/row on a stylised board. Independent of the polygon; this
 *            is the "a second authored layout" cost, made visible.
 */

export type AreaId = string;
export type NationId = string;
export type PassageId = string;

export type Climate = "arctic" | "temperate" | "subtropical" | "tropical";

export interface PrototypeArea {
  readonly id: AreaId;
  readonly name: string;
  /** Board-variant tile caption; the full name does not fit a tile. */
  readonly short: string;
  readonly ring: readonly (readonly [number, number])[];
  readonly label: readonly [number, number];
  readonly tile: readonly [number, number];
  readonly climate: Climate;
}

export interface PrototypeNation {
  readonly id: NationId;
  readonly name: string;
  /** Authored as an OKLCH hue so every nation shares one lightness/chroma ramp. */
  readonly hue: number;
}

export interface PrototypePassage {
  readonly id: PassageId;
  readonly name: string;
  readonly kind: "canal" | "strait";
  readonly controller: NationId;
  readonly owner: NationId;
  readonly open: boolean;
  readonly note: string;
}

export interface PrototypeEdge {
  readonly a: AreaId;
  readonly b: AreaId;
  readonly passage?: PassageId;
}

export interface PrototypePossession {
  readonly id: string;
  readonly name: string;
  readonly area: AreaId;
  readonly at: readonly [number, number];
  readonly owner: NationId;
  readonly base: "major" | "minor";
}

export interface PrototypeFleet {
  readonly id: string;
  readonly name: string;
  readonly area: AreaId;
  readonly owner: NationId;
  readonly ships: number;
  /** Locked multi-turn route, per ticket 03. Empty means in station. */
  readonly route: readonly AreaId[];
}

export const NATIONS: readonly PrototypeNation[] = [
  { id: "britain", name: "Britain", hue: 15 },
  { id: "france", name: "France", hue: 255 },
  { id: "germany", name: "Germany", hue: 60 },
  { id: "russia", name: "Russia", hue: 145 },
  { id: "italy", name: "Italy", hue: 155 },
  { id: "united_states", name: "United States", hue: 285 },
  { id: "japan", name: "Japan", hue: 25 },
  { id: "netherlands", name: "Netherlands", hue: 75 },
];

export const AREAS: readonly PrototypeArea[] = [
  {
    id: "area_arctic_barents",
    name: "Arctic and Barents Sea",
    short: "Barents",
    ring: [
      [-25, 72],
      [70, 72],
      [70, 84],
      [-25, 84],
    ],
    label: [25, 77],
    tile: [7, 0],
    climate: "arctic",
  },
  {
    id: "area_norwegian_sea",
    name: "Norwegian Sea",
    short: "Norwegian",
    ring: [
      [-20, 62],
      [20, 62],
      [20, 72],
      [-25, 72],
      [-20, 66],
    ],
    label: [-2, 67],
    tile: [7, 1],
    climate: "arctic",
  },
  {
    id: "area_north_sea",
    name: "North Sea",
    short: "North Sea",
    ring: [
      [-2, 52],
      [9, 52],
      [9, 58],
      [6, 61],
      [-2, 61],
    ],
    label: [3, 56],
    tile: [7, 2],
    climate: "temperate",
  },
  {
    id: "area_baltic",
    name: "Baltic Sea",
    short: "Baltic",
    ring: [
      [9, 53],
      [22, 53],
      [30, 59],
      [26, 66],
      [17, 63],
      [12, 57],
      [9, 57],
    ],
    label: [19, 58],
    tile: [8, 2],
    climate: "temperate",
  },
  {
    id: "area_western_approaches",
    name: "Western Approaches",
    short: "W Approaches",
    ring: [
      [-18, 35],
      [-6, 35],
      [-6, 43],
      [-1, 44],
      [2, 50],
      [2, 52],
      [-2, 52],
      [-2, 56],
      [-14, 56],
      [-18, 50],
    ],
    label: [-9, 47],
    tile: [6, 2],
    climate: "temperate",
  },
  {
    id: "area_north_atlantic",
    name: "North Atlantic",
    short: "N Atlantic",
    ring: [
      [-60, 45],
      [-20, 45],
      [-20, 62],
      [-45, 62],
      [-58, 55],
    ],
    label: [-38, 53],
    tile: [5, 2],
    climate: "temperate",
  },
  {
    id: "area_western_atlantic",
    name: "Western Atlantic",
    short: "W Atlantic",
    ring: [
      [-82, 27],
      [-62, 27],
      [-52, 40],
      [-56, 46],
      [-70, 45],
      [-80, 35],
    ],
    label: [-68, 35],
    tile: [4, 3],
    climate: "subtropical",
  },
  {
    id: "area_caribbean",
    name: "Caribbean and Gulf",
    short: "Caribbean",
    ring: [
      [-98, 30],
      [-98, 18],
      [-84, 8],
      [-60, 9],
      [-60, 24],
      [-80, 27],
    ],
    label: [-76, 17],
    tile: [4, 4],
    climate: "tropical",
  },
  {
    id: "area_central_atlantic",
    name: "Central Atlantic",
    short: "C Atlantic",
    ring: [
      [-62, 8],
      [-16, 8],
      [-12, 25],
      [-18, 35],
      [-20, 45],
      [-52, 45],
      [-52, 27],
      [-62, 20],
    ],
    label: [-34, 24],
    tile: [5, 3],
    climate: "subtropical",
  },
  {
    id: "area_south_atlantic",
    name: "South Atlantic",
    short: "S Atlantic",
    ring: [
      [-60, 8],
      [-16, 8],
      [8, -20],
      [12, -32],
      [-15, -55],
      [-62, -55],
      [-70, -25],
    ],
    label: [-25, -25],
    tile: [5, 6],
    climate: "subtropical",
  },
  {
    id: "area_cape_waters",
    name: "Cape Waters",
    short: "Cape",
    ring: [
      [12, -25],
      [45, -25],
      [48, -40],
      [20, -48],
      [10, -40],
    ],
    label: [28, -36],
    tile: [8, 7],
    climate: "temperate",
  },
  {
    id: "area_mediterranean",
    name: "Mediterranean Sea",
    short: "Mediterranean",
    ring: [
      [-6, 36],
      [3, 44],
      [13, 45],
      [19, 41],
      [28, 41],
      [36, 36],
      [33, 31],
      [10, 32],
      [-3, 35],
    ],
    label: [15, 36],
    tile: [8, 3],
    climate: "subtropical",
  },
  {
    id: "area_adriatic",
    name: "Adriatic Sea",
    short: "Adriatic",
    ring: [
      [12, 45],
      [14, 45],
      [20, 40],
      [18, 39],
      [13, 42],
    ],
    label: [15, 43],
    tile: [9, 3],
    climate: "subtropical",
  },
  {
    id: "area_aegean",
    name: "Aegean Sea",
    short: "Aegean",
    ring: [
      [23, 41],
      [27, 41],
      [28, 36],
      [23, 35],
    ],
    label: [25, 38],
    tile: [9, 4],
    climate: "subtropical",
  },
  {
    id: "area_black_sea",
    name: "Black Sea",
    short: "Black Sea",
    ring: [
      [28, 41],
      [42, 41],
      [42, 47],
      [29, 47],
    ],
    label: [35, 44],
    tile: [10, 3],
    climate: "temperate",
  },
  {
    id: "area_red_sea",
    name: "Red Sea",
    short: "Red Sea",
    ring: [
      [32, 30],
      [36, 29],
      [45, 12],
      [42, 11],
      [36, 20],
      [31, 29],
    ],
    label: [38, 20],
    tile: [9, 5],
    climate: "tropical",
  },
  {
    id: "area_persian_gulf",
    name: "Persian Gulf",
    short: "Persian Gulf",
    ring: [
      [48, 30],
      [57, 26],
      [59, 24],
      [56, 23],
      [47, 28],
    ],
    label: [52, 27],
    tile: [10, 4],
    climate: "tropical",
  },
  {
    id: "area_arabian_sea",
    name: "Arabian Sea",
    short: "Arabian Sea",
    ring: [
      [41, 14],
      [52, 25],
      [68, 25],
      [76, 8],
      [60, -2],
      [43, 8],
    ],
    label: [60, 12],
    tile: [10, 5],
    climate: "tropical",
  },
  {
    id: "area_bay_of_bengal",
    name: "Bay of Bengal",
    short: "Bengal",
    ring: [
      [78, 22],
      [95, 22],
      [100, 5],
      [95, -2],
      [80, 2],
    ],
    label: [88, 12],
    tile: [11, 5],
    climate: "tropical",
  },
  {
    id: "area_western_indian",
    name: "Western Indian Ocean",
    short: "W Indian",
    ring: [
      [35, -5],
      [65, -5],
      [65, -28],
      [42, -28],
      [33, -15],
    ],
    label: [50, -17],
    tile: [9, 6],
    climate: "tropical",
  },
  {
    id: "area_southern_indian",
    name: "Southern Indian Ocean",
    short: "S Indian",
    ring: [
      [65, -8],
      [110, -10],
      [118, -33],
      [112, -45],
      [50, -45],
      [42, -30],
      [65, -28],
    ],
    label: [85, -28],
    tile: [10, 7],
    climate: "subtropical",
  },
  {
    id: "area_malacca",
    name: "Malacca and Singapore Approaches",
    short: "Malacca",
    ring: [
      [95, 8],
      [103, 6],
      [105, 1],
      [101, -1],
      [96, 3],
    ],
    label: [99, 4],
    tile: [11, 6],
    climate: "tropical",
  },
  {
    id: "area_java_sea",
    name: "Java Sea",
    short: "Java Sea",
    ring: [
      [104, 2],
      [120, 2],
      [125, -4],
      [120, -9],
      [105, -8],
      [102, -5],
    ],
    label: [113, -4],
    tile: [12, 6],
    climate: "tropical",
  },
  {
    id: "area_south_china_sea",
    name: "South China Sea",
    short: "S China Sea",
    ring: [
      [105, 3],
      [120, 3],
      [122, 18],
      [113, 23],
      [105, 20],
      [102, 10],
    ],
    label: [113, 12],
    tile: [12, 5],
    climate: "tropical",
  },
  {
    id: "area_east_china_sea",
    name: "East China Sea",
    short: "E China Sea",
    ring: [
      [118, 24],
      [130, 24],
      [131, 33],
      [122, 33],
      [117, 28],
    ],
    label: [124, 28],
    tile: [12, 4],
    climate: "subtropical",
  },
  {
    id: "area_yellow_sea",
    name: "Yellow Sea",
    short: "Yellow Sea",
    ring: [
      [119, 33],
      [127, 33],
      [127, 41],
      [121, 40],
      [118, 37],
    ],
    label: [123, 37],
    tile: [12, 3],
    climate: "temperate",
  },
  {
    id: "area_sea_of_japan",
    name: "Sea of Japan",
    short: "Sea of Japan",
    ring: [
      [128, 34],
      [140, 34],
      [142, 46],
      [137, 52],
      [130, 44],
    ],
    label: [135, 41],
    tile: [13, 3],
    climate: "temperate",
  },
  {
    id: "area_okhotsk",
    name: "Sea of Okhotsk",
    short: "Okhotsk",
    ring: [
      [137, 44],
      [157, 44],
      [163, 56],
      [150, 60],
      [140, 54],
    ],
    label: [149, 52],
    tile: [13, 2],
    climate: "arctic",
  },
  {
    id: "area_philippine_sea",
    name: "Philippine Sea",
    short: "Philippine Sea",
    ring: [
      [122, 4],
      [145, 4],
      [150, 24],
      [140, 32],
      [128, 24],
      [122, 18],
    ],
    label: [136, 16],
    tile: [13, 5],
    climate: "tropical",
  },
  {
    id: "area_north_pacific",
    name: "North Pacific",
    short: "N Pacific",
    ring: [
      [145, 30],
      [180, 30],
      [180, 52],
      [160, 56],
      [150, 42],
    ],
    label: [163, 41],
    tile: [14, 3],
    climate: "temperate",
  },
  {
    id: "area_northeast_pacific",
    name: "Northeast Pacific",
    short: "NE Pacific",
    ring: [
      [-180, 32],
      [-125, 32],
      [-118, 48],
      [-140, 58],
      [-175, 54],
    ],
    label: [-150, 43],
    tile: [2, 2],
    climate: "temperate",
  },
  {
    id: "area_central_pacific",
    name: "Central Pacific",
    short: "C Pacific",
    ring: [
      [150, -8],
      [215, -8],
      [220, 26],
      [150, 26],
    ],
    label: [185, 10],
    tile: [1, 5],
    climate: "tropical",
  },
  {
    id: "area_eastern_pacific",
    name: "Eastern Pacific",
    short: "E Pacific",
    ring: [
      [-125, -10],
      [-78, -10],
      [-70, 5],
      [-80, 20],
      [-118, 30],
      [-125, 20],
    ],
    label: [-102, 9],
    tile: [3, 5],
    climate: "tropical",
  },
  {
    id: "area_coral_sea",
    name: "Coral Sea",
    short: "Coral Sea",
    ring: [
      [145, -8],
      [168, -8],
      [172, -24],
      [150, -28],
      [142, -18],
    ],
    label: [157, -17],
    tile: [13, 7],
    climate: "tropical",
  },
  {
    id: "area_tasman_sea",
    name: "Tasman Sea",
    short: "Tasman",
    ring: [
      [147, -30],
      [175, -30],
      [178, -46],
      [150, -46],
    ],
    label: [162, -38],
    tile: [13, 8],
    climate: "temperate",
  },
  {
    id: "area_south_pacific",
    name: "South Pacific",
    short: "S Pacific",
    ring: [
      [172, -10],
      [250, -10],
      [255, -45],
      [180, -50],
      [172, -30],
    ],
    label: [210, -28],
    tile: [1, 7],
    climate: "subtropical",
  },
];

export const PASSAGES: readonly PrototypePassage[] = [
  {
    id: "passage_gibraltar",
    name: "Strait of Gibraltar",
    kind: "strait",
    controller: "britain",
    owner: "britain",
    open: true,
    note: "Held from the Rock; no traveller conditions in this era.",
  },
  {
    id: "passage_suez",
    name: "Suez Canal",
    kind: "canal",
    controller: "britain",
    owner: "britain",
    open: true,
    note: "1888 Convention: open to all in peace and war.",
  },
  {
    id: "passage_bab_el_mandeb",
    name: "Bab-el-Mandeb",
    kind: "strait",
    controller: "britain",
    owner: "britain",
    open: true,
    note: "Covered from Aden and Perim.",
  },
  {
    id: "passage_turkish_straits",
    name: "Turkish Straits",
    kind: "strait",
    controller: "italy",
    owner: "italy",
    open: false,
    note: "Closed to warships of non-littoral powers. Standing closure.",
  },
  {
    id: "passage_danish_straits",
    name: "Danish Straits",
    kind: "strait",
    controller: "germany",
    owner: "germany",
    open: true,
    note: "Shallow; the Kiel Canal is the way the fleet actually moves.",
  },
  {
    id: "passage_otranto",
    name: "Strait of Otranto",
    kind: "strait",
    controller: "italy",
    owner: "italy",
    open: true,
    note: "Narrow enough to be barraged, which is an edge-level act.",
  },
  {
    id: "passage_panama",
    name: "Panama Canal",
    kind: "canal",
    controller: "united_states",
    owner: "united_states",
    open: false,
    note: "Not yet open at this campaign date. Opens 1914.",
  },
  {
    id: "passage_malacca_strait",
    name: "Singapore Strait",
    kind: "strait",
    controller: "britain",
    owner: "britain",
    open: true,
    note: "The reason Singapore is where it is.",
  },
  {
    id: "passage_tsushima",
    name: "Tsushima Strait",
    kind: "strait",
    controller: "japan",
    owner: "japan",
    open: true,
    note: "Contested rather than closed.",
  },
  {
    id: "passage_magellan",
    name: "Strait of Magellan",
    kind: "strait",
    controller: "britain",
    owner: "britain",
    open: true,
    note: "Neutral water; Drake Passage is the alternative and costs a month.",
  },
];

export const EDGES: readonly PrototypeEdge[] = [
  { a: "area_arctic_barents", b: "area_norwegian_sea" },
  { a: "area_norwegian_sea", b: "area_north_sea" },
  { a: "area_norwegian_sea", b: "area_north_atlantic" },
  {
    a: "area_north_sea",
    b: "area_baltic",
    passage: "passage_danish_straits",
  },
  { a: "area_north_sea", b: "area_western_approaches" },
  { a: "area_western_approaches", b: "area_north_atlantic" },
  { a: "area_western_approaches", b: "area_central_atlantic" },
  {
    a: "area_western_approaches",
    b: "area_mediterranean",
    passage: "passage_gibraltar",
  },
  { a: "area_north_atlantic", b: "area_central_atlantic" },
  { a: "area_north_atlantic", b: "area_western_atlantic" },
  { a: "area_western_atlantic", b: "area_central_atlantic" },
  { a: "area_western_atlantic", b: "area_caribbean" },
  { a: "area_caribbean", b: "area_central_atlantic" },
  {
    a: "area_caribbean",
    b: "area_eastern_pacific",
    passage: "passage_panama",
  },
  { a: "area_central_atlantic", b: "area_south_atlantic" },
  { a: "area_south_atlantic", b: "area_cape_waters" },
  {
    a: "area_south_atlantic",
    b: "area_south_pacific",
    passage: "passage_magellan",
  },
  { a: "area_cape_waters", b: "area_western_indian" },
  { a: "area_cape_waters", b: "area_southern_indian" },
  {
    a: "area_mediterranean",
    b: "area_adriatic",
    passage: "passage_otranto",
  },
  { a: "area_mediterranean", b: "area_aegean" },
  { a: "area_mediterranean", b: "area_red_sea", passage: "passage_suez" },
  {
    a: "area_aegean",
    b: "area_black_sea",
    passage: "passage_turkish_straits",
  },
  {
    a: "area_red_sea",
    b: "area_arabian_sea",
    passage: "passage_bab_el_mandeb",
  },
  { a: "area_arabian_sea", b: "area_persian_gulf" },
  { a: "area_arabian_sea", b: "area_bay_of_bengal" },
  { a: "area_arabian_sea", b: "area_western_indian" },
  { a: "area_arabian_sea", b: "area_southern_indian" },
  { a: "area_bay_of_bengal", b: "area_malacca" },
  { a: "area_bay_of_bengal", b: "area_southern_indian" },
  { a: "area_western_indian", b: "area_southern_indian" },
  { a: "area_southern_indian", b: "area_java_sea" },
  { a: "area_southern_indian", b: "area_tasman_sea" },
  {
    a: "area_malacca",
    b: "area_south_china_sea",
    passage: "passage_malacca_strait",
  },
  { a: "area_malacca", b: "area_java_sea" },
  { a: "area_java_sea", b: "area_south_china_sea" },
  { a: "area_java_sea", b: "area_philippine_sea" },
  { a: "area_java_sea", b: "area_coral_sea" },
  { a: "area_south_china_sea", b: "area_east_china_sea" },
  { a: "area_south_china_sea", b: "area_philippine_sea" },
  { a: "area_east_china_sea", b: "area_yellow_sea" },
  { a: "area_east_china_sea", b: "area_philippine_sea" },
  {
    a: "area_east_china_sea",
    b: "area_sea_of_japan",
    passage: "passage_tsushima",
  },
  { a: "area_sea_of_japan", b: "area_okhotsk" },
  { a: "area_okhotsk", b: "area_north_pacific" },
  { a: "area_philippine_sea", b: "area_north_pacific" },
  { a: "area_philippine_sea", b: "area_central_pacific" },
  { a: "area_philippine_sea", b: "area_coral_sea" },
  { a: "area_north_pacific", b: "area_northeast_pacific" },
  { a: "area_north_pacific", b: "area_central_pacific" },
  { a: "area_northeast_pacific", b: "area_central_pacific" },
  { a: "area_northeast_pacific", b: "area_eastern_pacific" },
  { a: "area_central_pacific", b: "area_eastern_pacific" },
  { a: "area_central_pacific", b: "area_coral_sea" },
  { a: "area_central_pacific", b: "area_south_pacific" },
  { a: "area_eastern_pacific", b: "area_south_pacific" },
  { a: "area_coral_sea", b: "area_tasman_sea" },
  { a: "area_coral_sea", b: "area_south_pacific" },
  { a: "area_tasman_sea", b: "area_south_pacific" },
];

export const POSSESSIONS: readonly PrototypePossession[] = [
  {
    id: "poss_scapa",
    name: "Scapa Flow",
    area: "area_north_sea",
    at: [-3, 58.9],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_portsmouth",
    name: "Portsmouth",
    area: "area_western_approaches",
    at: [-1.1, 50.8],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_gibraltar",
    name: "Gibraltar",
    area: "area_mediterranean",
    at: [-5.3, 36.1],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_malta",
    name: "Malta",
    area: "area_mediterranean",
    at: [14.5, 35.9],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_alexandria",
    name: "Alexandria",
    area: "area_mediterranean",
    at: [29.9, 31.2],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_aden",
    name: "Aden",
    area: "area_red_sea",
    at: [45, 12.8],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_bombay",
    name: "Bombay",
    area: "area_arabian_sea",
    at: [72.8, 19],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_trincomalee",
    name: "Trincomalee",
    area: "area_bay_of_bengal",
    at: [81.2, 8.6],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_singapore",
    name: "Singapore",
    area: "area_malacca",
    at: [103.8, 1.3],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_hong_kong",
    name: "Hong Kong",
    area: "area_south_china_sea",
    at: [114.2, 22.3],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_simonstown",
    name: "Simon's Town",
    area: "area_cape_waters",
    at: [18.4, -34.2],
    owner: "britain",
    base: "major",
  },
  {
    id: "poss_freetown",
    name: "Freetown",
    area: "area_central_atlantic",
    at: [-13.2, 8.5],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_bermuda",
    name: "Bermuda",
    area: "area_western_atlantic",
    at: [-64.8, 32.3],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_halifax",
    name: "Halifax",
    area: "area_north_atlantic",
    at: [-63.6, 44.7],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_falklands",
    name: "Port Stanley",
    area: "area_south_atlantic",
    at: [-57.9, -51.7],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_sydney",
    name: "Sydney",
    area: "area_tasman_sea",
    at: [151.2, -33.9],
    owner: "britain",
    base: "minor",
  },
  {
    id: "poss_toulon",
    name: "Toulon",
    area: "area_mediterranean",
    at: [5.9, 43.1],
    owner: "france",
    base: "major",
  },
  {
    id: "poss_brest",
    name: "Brest",
    area: "area_western_approaches",
    at: [-4.5, 48.4],
    owner: "france",
    base: "major",
  },
  {
    id: "poss_dakar",
    name: "Dakar",
    area: "area_central_atlantic",
    at: [-17.4, 14.7],
    owner: "france",
    base: "minor",
  },
  {
    id: "poss_diego_suarez",
    name: "Diego Suarez",
    area: "area_western_indian",
    at: [49.3, -12.3],
    owner: "france",
    base: "minor",
  },
  {
    id: "poss_saigon",
    name: "Saigon",
    area: "area_south_china_sea",
    at: [106.7, 10.8],
    owner: "france",
    base: "minor",
  },
  {
    id: "poss_wilhelmshaven",
    name: "Wilhelmshaven",
    area: "area_north_sea",
    at: [8.1, 53.5],
    owner: "germany",
    base: "major",
  },
  {
    id: "poss_kiel",
    name: "Kiel",
    area: "area_baltic",
    at: [10.1, 54.3],
    owner: "germany",
    base: "major",
  },
  {
    id: "poss_tsingtao",
    name: "Tsingtao",
    area: "area_yellow_sea",
    at: [120.4, 36.1],
    owner: "germany",
    base: "minor",
  },
  {
    id: "poss_kronstadt",
    name: "Kronstadt",
    area: "area_baltic",
    at: [29.8, 60],
    owner: "russia",
    base: "major",
  },
  {
    id: "poss_sevastopol",
    name: "Sevastopol",
    area: "area_black_sea",
    at: [33.5, 44.6],
    owner: "russia",
    base: "major",
  },
  {
    id: "poss_vladivostok",
    name: "Vladivostok",
    area: "area_sea_of_japan",
    at: [131.9, 43.1],
    owner: "russia",
    base: "major",
  },
  {
    id: "poss_taranto",
    name: "Taranto",
    area: "area_adriatic",
    at: [17.2, 40.5],
    owner: "italy",
    base: "major",
  },
  {
    id: "poss_massawa",
    name: "Massawa",
    area: "area_red_sea",
    at: [39.5, 15.6],
    owner: "italy",
    base: "minor",
  },
  {
    id: "poss_norfolk",
    name: "Norfolk",
    area: "area_western_atlantic",
    at: [-76.3, 36.9],
    owner: "united_states",
    base: "major",
  },
  {
    id: "poss_pearl_harbor",
    name: "Pearl Harbor",
    area: "area_central_pacific",
    at: [202.1, 21.3],
    owner: "united_states",
    base: "major",
  },
  {
    id: "poss_cavite",
    name: "Cavite",
    area: "area_philippine_sea",
    at: [120.9, 14.5],
    owner: "united_states",
    base: "minor",
  },
  {
    id: "poss_guantanamo",
    name: "Guantanamo",
    area: "area_caribbean",
    at: [-75.2, 20],
    owner: "united_states",
    base: "minor",
  },
  {
    id: "poss_yokosuka",
    name: "Yokosuka",
    area: "area_philippine_sea",
    at: [139.7, 35.3],
    owner: "japan",
    base: "major",
  },
  {
    id: "poss_sasebo",
    name: "Sasebo",
    area: "area_east_china_sea",
    at: [129.7, 33.2],
    owner: "japan",
    base: "major",
  },
  {
    id: "poss_surabaya",
    name: "Surabaya",
    area: "area_java_sea",
    at: [112.7, -7.2],
    owner: "netherlands",
    base: "minor",
  },
];

export const FLEETS: readonly PrototypeFleet[] = [
  {
    id: "fleet_home",
    name: "Home Fleet",
    area: "area_north_sea",
    owner: "britain",
    ships: 24,
    route: [],
  },
  {
    id: "fleet_mediterranean",
    name: "Mediterranean Fleet",
    area: "area_mediterranean",
    owner: "britain",
    ships: 14,
    route: ["area_red_sea", "area_arabian_sea"],
  },
  {
    id: "fleet_china",
    name: "China Station",
    area: "area_south_china_sea",
    owner: "britain",
    ships: 6,
    route: [],
  },
  {
    id: "fleet_atlantic",
    name: "Atlantic Fleet",
    area: "area_western_approaches",
    owner: "britain",
    ships: 11,
    route: [],
  },
  {
    id: "fleet_hochseeflotte",
    name: "Hochseeflotte",
    area: "area_north_sea",
    owner: "germany",
    ships: 21,
    route: [],
  },
  {
    id: "fleet_ostasien",
    name: "Ostasiengeschwader",
    area: "area_yellow_sea",
    owner: "germany",
    ships: 4,
    route: ["area_east_china_sea", "area_philippine_sea"],
  },
  {
    id: "fleet_escadre_mediterranee",
    name: "Escadre de la Mediterranee",
    area: "area_mediterranean",
    owner: "france",
    ships: 12,
    route: [],
  },
  {
    id: "fleet_baltic",
    name: "Baltic Fleet",
    area: "area_baltic",
    owner: "russia",
    ships: 9,
    route: [],
  },
  {
    id: "fleet_pacific_squadron",
    name: "Pacific Squadron",
    area: "area_sea_of_japan",
    owner: "russia",
    ships: 7,
    route: [],
  },
  {
    id: "fleet_combined",
    name: "Combined Fleet",
    area: "area_east_china_sea",
    owner: "japan",
    ships: 16,
    route: [],
  },
  {
    id: "fleet_atlantic_us",
    name: "Atlantic Fleet",
    area: "area_western_atlantic",
    owner: "united_states",
    ships: 13,
    route: ["area_caribbean"],
  },
  {
    id: "fleet_asiatic",
    name: "Asiatic Squadron",
    area: "area_philippine_sea",
    owner: "united_states",
    ships: 5,
    route: [],
  },
];

export const AREAS_BY_ID = new Map(AREAS.map((area) => [area.id, area]));
export const NATIONS_BY_ID = new Map(NATIONS.map((nation) => [nation.id, nation]));
export const PASSAGES_BY_ID = new Map(PASSAGES.map((passage) => [passage.id, passage]));

/**
 * Ownership is derived, not authored: an area is "held" by whoever owns the
 * most possessions in it, and contested when two nations tie. Ticket 01 made
 * coastal-ness derived the same way, so this checks whether a derived fill is
 * legible before the schema commits to an authored one.
 */
export interface AreaControl {
  readonly owner: NationId | null;
  readonly contested: boolean;
  readonly possessions: number;
}

export function deriveAreaControl(): ReadonlyMap<AreaId, AreaControl> {
  const counts = new Map<AreaId, Map<NationId, number>>();
  for (const possession of POSSESSIONS) {
    const byNation = counts.get(possession.area) ?? new Map<NationId, number>();
    byNation.set(possession.owner, (byNation.get(possession.owner) ?? 0) + 1);
    counts.set(possession.area, byNation);
  }
  const control = new Map<AreaId, AreaControl>();
  for (const area of AREAS) {
    const byNation = counts.get(area.id);
    if (byNation === undefined) {
      control.set(area.id, { owner: null, contested: false, possessions: 0 });
      continue;
    }
    const ranked = [...byNation.entries()].sort(
      (left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1),
    );
    const top = ranked[0];
    if (top === undefined) continue;
    control.set(area.id, {
      owner: top[0],
      contested: ranked.length > 1 && ranked[1]?.[1] === top[1],
      possessions: [...byNation.values()].reduce((sum, n) => sum + n, 0),
    });
  }
  return control;
}

/** Ticket 03's router, in miniature: BFS with a codepoint-ascending tie-break. */
export function routeBetween(
  from: AreaId,
  to: AreaId,
  options: { readonly avoidClosedPassages: boolean },
): readonly AreaId[] | null {
  const neighbours = new Map<AreaId, { id: AreaId; passage?: PassageId }[]>();
  for (const edge of EDGES) {
    const forward = neighbours.get(edge.a) ?? [];
    const backward = neighbours.get(edge.b) ?? [];
    forward.push(
      edge.passage === undefined ? { id: edge.b } : { id: edge.b, passage: edge.passage },
    );
    backward.push(
      edge.passage === undefined ? { id: edge.a } : { id: edge.a, passage: edge.passage },
    );
    neighbours.set(edge.a, forward);
    neighbours.set(edge.b, backward);
  }
  for (const list of neighbours.values()) {
    // Codepoint-ascending, never localeCompare — see ticket 03.
    list.sort((left, right) => (left.id < right.id ? -1 : 1));
  }

  const previous = new Map<AreaId, AreaId | null>([[from, null]]);
  const queue: AreaId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (current === to) {
      const path: AreaId[] = [];
      let cursor: AreaId | null | undefined = current;
      while (cursor !== null && cursor !== undefined) {
        path.unshift(cursor);
        cursor = previous.get(cursor);
      }
      return path;
    }
    for (const next of neighbours.get(current) ?? []) {
      if (previous.has(next.id)) continue;
      if (options.avoidClosedPassages && next.passage !== undefined) {
        const passage = PASSAGES_BY_ID.get(next.passage);
        if (passage !== undefined && !passage.open) continue;
      }
      previous.set(next.id, current);
      queue.push(next.id);
    }
  }
  return null;
}
