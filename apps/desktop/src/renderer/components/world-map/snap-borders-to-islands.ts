import type { FlatPolygon } from "../../lib/simplify-geometry.js";

const ISLAND_SPAN_DEGREES = 15;
const OWNERSHIP_SHARE = 0.6;

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function boxOf(polygon: FlatPolygon): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const outer = polygon[0] ?? [];
  for (let k = 0; k < outer.length; k += 2) {
    const x = outer[k] as number;
    const y = outer[k + 1] as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function isIslandSized(box: Box): boolean {
  return box.maxX - box.minX < ISLAND_SPAN_DEGREES && box.maxY - box.minY < ISLAND_SPAN_DEGREES;
}

function area(box: Box): number {
  return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
}

function mutualShare(a: Box, b: Box): number {
  return Math.min(overlapShare(a, b), overlapShare(b, a));
}

function overlapShare(of: Box, by: Box): number {
  const width = Math.min(of.maxX, by.maxX) - Math.max(of.minX, by.minX);
  const height = Math.min(of.maxY, by.maxY) - Math.max(of.minY, by.minY);
  const total = area(of);
  return width > 0 && height > 0 && total > 0 ? (width * height) / total : 0;
}

export interface SnappedBorders {
  readonly id: string;
  readonly polygons: readonly FlatPolygon[];
}

export function snapBordersToIslands<T extends SnappedBorders>(
  sets: readonly T[],
  landmasses: readonly FlatPolygon[],
): (T & { readonly polygons: readonly FlatPolygon[] })[] {
  const boxes = sets.map((set) => set.polygons.map(boxOf));
  const owned: FlatPolygon[][] = sets.map(() => []);
  const consumed: Set<number>[] = sets.map(() => new Set<number>());

  for (const land of landmasses) {
    const box = boxOf(land);
    if (!isIslandSized(box)) continue;
    let best = OWNERSHIP_SHARE;
    let owner = -1;
    boxes.forEach((setBoxes, s) => {
      for (const coarse of setBoxes) {
        if (!isIslandSized(coarse)) continue;
        const share = mutualShare(box, coarse);
        if (share > best) {
          best = share;
          owner = s;
        }
      }
    });
    if (owner < 0) continue;
    owned[owner]?.push(land);
    boxes[owner]?.forEach((coarse, p) => {
      if (isIslandSized(coarse) && mutualShare(box, coarse) >= OWNERSHIP_SHARE)
        consumed[owner]?.add(p);
    });
  }

  return sets.map((set, s) => ({
    ...set,
    polygons: [...set.polygons.filter((_, p) => !consumed[s]?.has(p)), ...(owned[s] ?? [])],
  }));
}
