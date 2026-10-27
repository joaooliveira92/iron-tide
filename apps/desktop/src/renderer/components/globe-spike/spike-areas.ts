import { AREAS } from "../world-map/map-geometry.js";
import { densifyRing, type Position } from "./densify.js";
import type { GeoFeatureCollection } from "./globe-spike-scene.js";

export const AREA_TOLERANCE_METRES = 10;

function closed(ring: readonly Position[]): readonly Position[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first === undefined || last === undefined) return ring;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function areaRing(id: string): readonly Position[] {
  const area = AREAS.find((entry) => entry.id === id);
  return area === undefined ? [] : closed(area.ring as readonly Position[]);
}

export function areaCollection(densify: boolean): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: AREAS.map((area) => {
      const ring = closed(area.ring as readonly Position[]);
      return {
        type: "Feature",
        properties: { id: area.id, name: area.short },
        geometry: {
          type: "Polygon",
          coordinates: [densify ? densifyRing(ring, AREA_TOLERANCE_METRES) : ring],
        },
      };
    }),
  };
}

export function areaLabelCollection(): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: AREAS.map((area) => ({
      type: "Feature",
      properties: { id: area.id, name: area.short },
      geometry: { type: "Point", coordinates: [area.label[0], area.label[1]] },
    })),
  };
}

function inside(ring: readonly Position[], x: number, y: number): boolean {
  let result = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index] as Position;
    const [xj, yj] = ring[previous] as Position;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
  }
  return result;
}

export function truthAreaIds(longitude: number, latitude: number): readonly string[] {
  const ids: string[] = [];
  for (const area of AREAS) {
    const ring = closed(area.ring as readonly Position[]);
    if ([0, 360, -360].some((shift) => inside(ring, longitude + shift, latitude)))
      ids.push(area.id);
  }
  return ids;
}

export function areaIds(): readonly string[] {
  return AREAS.map((area) => area.id);
}

export function areaLabelPoint(id: string): readonly [number, number] | null {
  const area = AREAS.find((entry) => entry.id === id);
  return area === undefined ? null : [area.label[0], area.label[1]];
}
