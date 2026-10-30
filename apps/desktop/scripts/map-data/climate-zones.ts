export interface ClimateZone {
  readonly id: number;
  readonly name: string;
  readonly koppen: readonly [number, number];
}

export const CLIMATE_ZONES: readonly ClimateZone[] = [
  { id: 1, name: "tropical-wet", koppen: [1, 2] },
  { id: 2, name: "tropical-seasonal", koppen: [3, 3] },
  { id: 3, name: "arid", koppen: [4, 5] },
  { id: 4, name: "semi-arid", koppen: [6, 7] },
  { id: 5, name: "temperate", koppen: [8, 16] },
  { id: 6, name: "cold", koppen: [17, 28] },
  { id: 7, name: "polar", koppen: [29, 30] },
];

export function zoneOfKoppen(value: number): number {
  for (const zone of CLIMATE_ZONES) {
    if (value >= zone.koppen[0] && value <= zone.koppen[1]) return zone.id;
  }
  return 0;
}
