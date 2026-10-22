export type FlatRing = readonly number[];
export type FlatPolygon = readonly FlatRing[];

function perpendicularDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function simplifyRing(ring: FlatRing, tolerance: number): number[] {
  const count = ring.length / 2;
  if (count <= 2) return [...ring];
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack: [number, number][] = [[0, count - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(
        ring[i * 2] as number,
        ring[i * 2 + 1] as number,
        ring[first * 2] as number,
        ring[first * 2 + 1] as number,
        ring[last * 2] as number,
        ring[last * 2 + 1] as number,
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (keep[i] === 1) out.push(ring[i * 2] as number, ring[i * 2 + 1] as number);
  }
  return out;
}

export function simplifyPolygons(
  polygons: readonly FlatPolygon[],
  tolerance: number,
): FlatPolygon[] {
  const result: FlatPolygon[] = [];
  for (const polygon of polygons) {
    const rings = polygon
      .map((ring) => simplifyRing(ring, tolerance))
      .filter((ring) => ring.length >= 8);
    const exterior = polygon[0];
    if (
      exterior !== undefined &&
      rings.length > 0 &&
      simplifyRing(exterior, tolerance).length >= 8
    ) {
      result.push(rings);
    }
  }
  return result;
}
