import type { LonLat } from "./campaign-anchors.js";

const ADRIATIC_EXIT: readonly LonLat[] = [
  [15.2, 42.8],
  [17.0, 41.8],
  [19.0, 40.2],
  [19.4, 38.2],
];

const AEGEAN_NORTH: readonly LonLat[] = [
  [27.7, 35.9],
  [26.5, 36.7],
  [25.8, 37.5],
  [25.4, 38.4],
  [25.4, 39.2],
  [25.5, 39.7],
  [26.2, 40.05],
  [26.45, 40.2],
  [26.7, 40.4],
  [27.5, 40.45],
];

const MARMARA_TO_BLACK_SEA: readonly LonLat[] = [
  [28.6, 40.8],
  [29.0, 41.0],
  [29.15, 41.2],
  [29.3, 41.4],
  [30.0, 41.8],
];

const YELLOW_SEA_TO_PACIFIC: readonly LonLat[] = [
  [123.5, 34.5],
  [126.0, 32.5],
  [129.4, 31.0],
  [131.5, 30.0],
];

const IBERIAN_ATLANTIC_EXIT: readonly LonLat[] = [
  [-2.0, 36.2],
  [-5.5, 35.95],
  [-9.0, 36.0],
  [-14.0, 37.5],
];

const KYUSHU_SOUTH_TO_KII: readonly LonLat[] = [
  [129.4, 31.0],
  [131.2, 30.8],
  [133.0, 31.8],
  [134.2, 32.4],
  [136.0, 33.0],
  [138.0, 34.0],
];

const DOVER_STRAIT: readonly LonLat[] = [
  [1.3, 50.95],
  [2.0, 51.5],
];

const CAPE_ROUTE_EAST: readonly LonLat[] = [
  [24.0, -36.2],
  [29.0, -33.5],
  [31.8, -30.3],
  [35.5, -25.0],
  [40.5, -17.0],
  [42.0, -12.5],
  [47.0, -9.0],
  [52.0, -4.0],
  [58.0, 3.0],
  [62.0, 10.0],
];

export const LANE_WAYPOINTS: Readonly<Record<string, readonly LonLat[]>> = {
  r_adden_bar: [
    [48.0, 12.2],
    [51.8, 12.0],
    [53.0, 10.5],
    [60.0, 8.0],
    [75.0, 5.5],
    [81.0, 5.3],
  ],
  r_baltic_kron: [
    [20.3, 58.8],
    [22.4, 59.6],
  ],
  r_bombay_ceylon: [[77.0, 7.4]],
  r_capetown_bombay: CAPE_ROUTE_EAST,
  r_carib_home: [
    [-68.0, 15.2],
    [-65.5, 17.2],
  ],
  r_ceylon_singapore: [
    [95.0, 6.5],
    [98.0, 5.5],
    [100.2, 3.8],
    [101.6, 2.3],
    [102.5, 1.6],
    [103.4, 1.1],
    [103.9, 1.1],
  ],
  r_chan_fra: [
    [-5.6, 49.0],
    [-5.6, 48.5],
  ],
  r_chan_gib: [
    [-5.6, 49.0],
    [-6.5, 47.0],
    [-10.0, 44.0],
    [-10.3, 40.0],
    [-10.0, 36.8],
    [-5.5, 35.95],
    [-2.0, 36.2],
  ],
  r_chan_north: DOVER_STRAIT,
  r_gib_malta: [
    [9.0, 38.2],
    [11.2, 37.4],
    [13.5, 36.5],
  ],
  r_gib_medw: [[-2.0, 36.2]],
  r_hk_manila: [
    [119.0, 14.3],
    [120.3, 14.25],
  ],
  r_hk_yokohama: [[121.2, 21.2]],
  r_malta_constant: AEGEAN_NORTH,
  r_malta_suez: [[24.5, 34.0]],
  r_manila_java: [
    [108.0, 6.0],
    [107.5, 2.5],
    [108.5, -1.0],
  ],
  r_med_black: [...AEGEAN_NORTH, ...MARMARA_TO_BLACK_SEA],
  r_north_baltic: [
    [7.5, 57.7],
    [10.7, 57.95],
    [11.6, 57.4],
    [11.9, 56.6],
    [12.65, 56.0],
    [12.8, 55.65],
    [12.7, 55.45],
    [13.2, 55.1],
    [14.9, 55.5],
    [17.5, 56.0],
  ],
  r_ply_capetown: [
    [-32.0, 15.0],
    [-12.0, -18.0],
  ],
  r_redsea_adden: [
    [43.0, 12.8],
    [43.6, 12.2],
  ],
  r_suez_canal: [
    [31.0, 32.0],
    [32.3, 31.6],
    [32.3, 31.3],
    [32.35, 30.5],
    [32.55, 29.95],
    [33.6, 28.0],
    [35.9, 25.0],
  ],
  r_toulon_gib: [[4.5, 41.5]],
  r_vlad_pacific: [
    [139.3, 41.2],
    [140.28, 41.33],
    [140.6, 41.55],
    [141.2, 41.66],
    [142.3, 41.5],
  ],
  r_x_africa_mozambique_sea_indian_ocean: [[47.0, -27.2]],
  r_x_americas_cuba_sea_caribbean: [
    [-85.4, 23.0],
    [-85.5, 21.5],
    [-83.0, 19.0],
  ],
  r_x_auh_adriatic_coast_sea_mediterranean_c: ADRIATIC_EXIT,
  r_x_auh_dalmatia_sea_mediterranean_c: ADRIATIC_EXIT.slice(1),
  r_x_chi_north_coast_sea_pacific_n: [[121.2, 38.2], [123.2, 37.2], ...YELLOW_SEA_TO_PACIFIC],
  r_x_chi_weihaiwei_sea_pacific_n: [[123.3, 37.1], ...YELLOW_SEA_TO_PACIFIC],
  r_x_chi_yangtze_sea_pacific_n: YELLOW_SEA_TO_PACIFIC.slice(2),
  r_x_eng_home_coast_sea_north_sea: DOVER_STRAIT,
  r_x_indian_ceylon_sea_bayofbengal: [[82.5, 5.8]],
  r_x_ita_tyrrhenian_coast_sea_mediterranean_c: [
    [15.3, 38.75],
    [15.6, 38.15],
    [16.0, 37.6],
  ],
  r_x_jpn_inland_sea_jpn_home_coast: [
    [133.1, 34.25],
    [134.0, 34.3],
    [134.6, 34.2],
    [134.9, 33.9],
    [135.0, 33.4],
    [136.0, 33.0],
    [138.0, 34.0],
  ],
  r_x_jpn_kyushu_coast_jpn_home_coast: KYUSHU_SOUTH_TO_KII,
  r_x_jpn_kyushu_coast_sea_pacific_n: [
    [129.4, 31.0],
    [131.5, 30.0],
  ],
  r_x_ott_aegean_coast_sea_mediterranean_e: [
    [26.5, 36.7],
    [27.7, 35.9],
  ],
  r_x_pacific_australia_sea_java_sea: [
    [155.0, -27.0],
    [152.5, -21.0],
    [148.0, -15.5],
    [145.5, -11.5],
    [143.8, -10.0],
    [141.5, -10.0],
    [133.0, -9.7],
    [127.5, -11.0],
    [123.5, -11.6],
    [120.0, -11.0],
    [117.5, -9.9],
    [116.0, -9.3],
    [115.8, -8.2],
    [114.5, -6.2],
  ],
  r_x_sea_mediterranean_w_sea_atlantic_n: IBERIAN_ATLANTIC_EXIT,
  r_x_usa_gulf_coast_sea_caribbean: [
    [-86.0, 21.2],
    [-82.0, 17.5],
  ],
};
