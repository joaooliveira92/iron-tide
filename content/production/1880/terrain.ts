import { TerrainAreaSchema, list } from "@bluewave/content-authoring";

const provenance = (place: string) => ({
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
  note: `PROVISIONAL: the ${place} coastline is a schematic convex outline in whole metres, not a survey. It exists to exercise the terrain queries (#935); replace it with surveyed outlines once battle placement and movement consume terrain.`,
});

export default list(TerrainAreaSchema, [
  {
    areaId: "med_cyprus",
    box: { minXM: -25_000, minYM: -10_000, maxXM: 25_000, maxYM: 20_000 },
    polygons: [
      {
        id: "cyprus_island",
        layer: "LAND",
        vertices: [
          { xM: -20_000, yM: 5_000 },
          { xM: -5_000, yM: 2_000 },
          { xM: 10_000, yM: 3_000 },
          { xM: 20_000, yM: 8_000 },
          { xM: 18_000, yM: 16_000 },
          { xM: 0, yM: 18_000 },
          { xM: -15_000, yM: 14_000 },
        ],
      },
      {
        id: "cyprus_south_shoal",
        layer: "SHALLOWS",
        vertices: [
          { xM: -5_000, yM: 2_000 },
          { xM: -6_000, yM: -3_000 },
          { xM: 11_000, yM: -2_000 },
          { xM: 10_000, yM: 3_000 },
        ],
      },
    ],
    bases: [{ portId: "gbr_cyprus", xM: 2_000, yM: 1_000 }],
    provenance: provenance("Cyprus"),
  },
  {
    areaId: "med_gibraltar",
    box: { minXM: -10_000, minYM: -10_000, maxXM: 10_000, maxYM: 10_000 },
    polygons: [
      {
        id: "gibraltar_rock",
        layer: "LAND",
        vertices: [
          { xM: -2_500, yM: -4_000 },
          { xM: 1_500, yM: -4_000 },
          { xM: 2_000, yM: 0 },
          { xM: 1_000, yM: 6_000 },
          { xM: -2_500, yM: 6_000 },
        ],
      },
    ],
    bases: [{ portId: "gbr_gibraltar", xM: 2_800, yM: -3_000 }],
    provenance: provenance("Gibraltar"),
  },
  {
    areaId: "med_malta",
    box: { minXM: -15_000, minYM: -10_000, maxXM: 15_000, maxYM: 10_000 },
    polygons: [
      {
        id: "malta_island",
        layer: "LAND",
        vertices: [
          { xM: -8_000, yM: -2_000 },
          { xM: -2_000, yM: -5_000 },
          { xM: 5_000, yM: -4_000 },
          { xM: 9_000, yM: -500 },
          { xM: 8_000, yM: 3_000 },
          { xM: 2_000, yM: 5_000 },
          { xM: -5_000, yM: 3_500 },
          { xM: -9_000, yM: 1_000 },
        ],
      },
      {
        id: "malta_east_bank",
        layer: "SHALLOWS",
        vertices: [
          { xM: 9_000, yM: -500 },
          { xM: 12_000, yM: -1_500 },
          { xM: 12_000, yM: 3_500 },
          { xM: 8_000, yM: 3_000 },
        ],
      },
    ],
    bases: [{ portId: "gbr_valletta", xM: 8_800, yM: 2_000 }],
    provenance: provenance("Malta"),
  },
]);
