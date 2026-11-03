import type { ProtectedCatalogue } from "./catalogue.ts";
import type { PipelineConfig } from "./config.ts";
import type { GeometryInput } from "./bake.ts";
import type { Position } from "./geodesy.ts";

export const TEST_CONFIG: PipelineConfig = {
  schemaVersion: 1,
  pipelineVersion: "test",
  projection: "EPSG:3857",
  edgeSemantics: "lonlat-linear",
  densifyToleranceMetres: 25,
  maxMercatorLatitude: 85.0511287798066,
  tileExtent: 4096,
  tileBuffer: 64,
  tileMinZoom: 0,
  tileMaxZoom: 6,
  fitForPurposeMaxZoom: 6,
  overscaleMaxZoom: 12,
  bounds: [-180, -85.0511287798066, 180, 85.0511287798066],
  simplificationPixels: 0.35,
  climateSimplificationPixels: 1.5,
  bathymetrySimplificationPixels: 1.5,
  reefMinZoom: 5,
  protectedPinRadiusPixels: 6,
  overlayRenderedWidthPixels: 2.5,
  layers: {
    land: "land",
    protected: "protected",
    areas: "areas",
    areaOutlines: "area_outlines",
    areaLabels: "area_labels",
    climate: "climate",
    bathymetry: "bathymetry",
    reefs: "reefs",
  },
  packFormat: "bluewave-tilepack-1",
  generationTimestampPolicy: "none",
};

function rectangle(west: number, south: number, east: number, north: number): Position[] {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

export function strait(open: boolean): GeometryInput {
  const gap = open ? 0.012 : 0;
  return {
    landPolygons: [
      [rectangle(-2, -1, -gap / 2, 1)],
      [rectangle(gap / 2, -1, 2, 1)],
      ...(open ? [] : [[rectangle(-gap / 2, -1, gap / 2, 1)]]),
    ],
    riverLines: [],
    areas: [],
    climate: [],
    bathymetry: [],
    reefLines: [],
  };
}

const PROVENANCE = {
  method: "validation-probe",
  source: "synthetic fixture for tests only",
  accuracyClass: "dataset",
  positionalAccuracyMetres: 100,
  retrieved: "2026-10-27",
  notes: "test",
} as const;

export function straitCatalogue(withFallback: boolean): ProtectedCatalogue {
  return {
    schemaVersion: 1,
    catalogueVersion: 1,
    edgeSemanticsPolicy: "lon/lat linear segments, densified before tiling",
    features: [
      {
        id: "test-strait",
        name: "Test strait",
        type: "strait",
        representation: "base-water-passage",
        edgeSemantics: "lonlat-linear",
        gameplayReason: "synthetic passage used to exercise closure detection",
        requiredFromZoom: 5,
        transects: [{ id: "t1", from: [-1, 0], to: [1, 0] }],
        referenceWidthMetres: 1300,
        maxNarrowingFraction: 0.5,
        maxDisplacementMetres: 1500,
        visualContinuityRequired: true,
        simulationNavigabilityImplicated: false,
        displayOnly: true,
        provenance: PROVENANCE,
        license: { status: "bluewave-authored", identifier: "test", attributionRequired: false },
        validationNotes: "test",
        ...(withFallback
          ? {
              fallbackOverlay: {
                lines: [
                  [
                    [0, -0.5],
                    [0, 0.5],
                  ],
                ],
                provenance: { ...PROVENANCE, method: "authored", accuracyClass: "schematic" },
              },
            }
          : {}),
      },
    ],
  };
}

export function canalCatalogue(): ProtectedCatalogue {
  return {
    schemaVersion: 1,
    catalogueVersion: 1,
    edgeSemanticsPolicy: "lon/lat linear segments, densified before tiling",
    features: [
      {
        id: "test-canal",
        name: "Test canal",
        type: "canal",
        representation: "overlay-line",
        edgeSemantics: "lonlat-linear",
        gameplayReason: "synthetic canal used to exercise overlay validation",
        requiredFromZoom: 3,
        geometry: {
          source: "authored",
          lines: [
            [
              [-1, 0],
              [0, 0.3],
              [1, 0],
            ],
          ],
        },
        renderedWidthPixels: 2.5,
        maxDisplacementMetres: 1500,
        maxNarrowingFraction: 0,
        visualContinuityRequired: true,
        simulationNavigabilityImplicated: false,
        displayOnly: true,
        provenance: { ...PROVENANCE, method: "authored", accuracyClass: "schematic" },
        license: { status: "bluewave-authored", identifier: "test", attributionRequired: false },
        validationNotes: "test",
      },
    ],
  };
}
