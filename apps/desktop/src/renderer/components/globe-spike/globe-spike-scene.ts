import type { FlatPolygon } from "../../lib/simplify-geometry.js";

export interface SpikeMarker {
  readonly id: string;
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
}

export interface SpikeRoute {
  readonly id: string;
  readonly from: string;
  readonly to: string;
}

export const SPIKE_MARKERS: readonly SpikeMarker[] = [
  { id: "spike-plymouth", name: "Plymouth", lon: -4.14, lat: 50.37 },
  { id: "spike-halifax", name: "Halifax", lon: -63.57, lat: 44.65 },
  { id: "spike-gibraltar", name: "Gibraltar", lon: -5.35, lat: 36.14 },
  { id: "spike-malta", name: "Malta", lon: 14.51, lat: 35.9 },
  { id: "spike-honolulu", name: "Honolulu", lon: -157.86, lat: 21.31 },
  { id: "spike-yokohama", name: "Yokohama", lon: 139.65, lat: 35.45 },
  { id: "spike-murmansk", name: "Murmansk", lon: 33.08, lat: 68.97 },
  { id: "spike-longyearbyen", name: "Longyearbyen", lon: 15.63, lat: 78.22 },
  { id: "spike-suva", name: "Suva", lon: 178.44, lat: -18.14 },
  { id: "spike-capetown", name: "Cape Town", lon: 18.42, lat: -33.92 },
];

export const SPIKE_ROUTES: readonly SpikeRoute[] = [
  { id: "spike-route-atlantic", from: "spike-plymouth", to: "spike-halifax" },
  { id: "spike-route-pacific", from: "spike-honolulu", to: "spike-yokohama" },
  { id: "spike-route-arctic", from: "spike-murmansk", to: "spike-longyearbyen" },
];

export interface GeoFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly {
    readonly type: "Feature";
    readonly properties: Record<string, string | number>;
    readonly geometry:
      | { readonly type: "Point"; readonly coordinates: readonly [number, number] }
      | {
          readonly type: "LineString";
          readonly coordinates: readonly (readonly [number, number])[];
        }
      | {
          readonly type: "Polygon";
          readonly coordinates: readonly (readonly (readonly [number, number])[])[];
        };
  }[];
}

export function markerCollection(): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: SPIKE_MARKERS.map((marker) => ({
      type: "Feature",
      properties: { id: marker.id, name: marker.name },
      geometry: { type: "Point", coordinates: [marker.lon, marker.lat] },
    })),
  };
}

export function routeCollection(): GeoFeatureCollection {
  const byId = new Map(SPIKE_MARKERS.map((marker) => [marker.id, marker]));
  const features: GeoFeatureCollection["features"][number][] = [];
  for (const route of SPIKE_ROUTES) {
    const from = byId.get(route.from);
    const to = byId.get(route.to);
    if (from === undefined || to === undefined) continue;
    const toLon = route.id === "spike-route-pacific" ? to.lon - 360 : to.lon;
    features.push({
      type: "Feature",
      properties: { id: route.id },
      geometry: {
        type: "LineString",
        coordinates: [
          [from.lon, from.lat],
          [toLon, to.lat],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function coastlineCollection(polygons: readonly FlatPolygon[]): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: polygons.map((rings, index) => ({
      type: "Feature",
      properties: { id: index },
      geometry: {
        type: "Polygon",
        coordinates: rings.map((flat) => {
          const ring: [number, number][] = [];
          for (let k = 0; k + 1 < flat.length; k += 2) {
            ring.push([flat[k] as number, flat[k + 1] as number]);
          }
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (
            first !== undefined &&
            last !== undefined &&
            (first[0] !== last[0] || first[1] !== last[1])
          ) {
            ring.push(first);
          }
          return ring;
        }),
      },
    })),
  };
}
