export type Position = readonly [number, number];

const KM_PER_DEGREE = 111.32;
const DEGREES = Math.PI / 180;

function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * DEGREES) / 2));
}

function inverseMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEGREES;
}

export function edgeSplitCount(from: Position, to: Position, toleranceMetres: number): number {
  const lonLatLinear = (to[1] - from[1]) / 2;
  const midpointMercator = inverseMercatorY((mercatorY(from[1]) + mercatorY(to[1])) / 2);
  const midpointLinear = from[1] + lonLatLinear;
  const deviationMetres = Math.abs(midpointMercator - midpointLinear) * KM_PER_DEGREE * 1000;
  if (deviationMetres <= toleranceMetres) return 1;
  return Math.max(1, Math.ceil(Math.sqrt(deviationMetres / toleranceMetres) * 2));
}

function canonicalOrder(a: Position, b: Position): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
}

export function densifyEdge(
  from: Position,
  to: Position,
  toleranceMetres: number,
): readonly Position[] {
  const forward = canonicalOrder(from, to);
  const start = forward ? from : to;
  const end = forward ? to : from;
  const count = edgeSplitCount(start, end, toleranceMetres);
  const points: Position[] = [];
  for (let step = 0; step <= count; step++) {
    const t = step / count;
    points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
  }
  return forward ? points : points.reverse();
}

export function densifyRing(
  ring: readonly Position[],
  toleranceMetres: number,
): readonly Position[] {
  const out: Position[] = [];
  for (let index = 0; index + 1 < ring.length; index++) {
    const from = ring[index] as Position;
    const to = ring[index + 1] as Position;
    const edge = densifyEdge(from, to, toleranceMetres);
    for (let k = index === 0 ? 0 : 1; k < edge.length; k++) out.push(edge[k] as Position);
  }
  return out;
}

export function maxEdgeDeviationMetres(from: Position, to: Position): number {
  let worst = 0;
  for (let k = 1; k < 64; k++) {
    const t = k / 64;
    const linearLat = from[1] + (to[1] - from[1]) * t;
    const mercatorLat = inverseMercatorY(
      mercatorY(from[1]) + (mercatorY(to[1]) - mercatorY(from[1])) * t,
    );
    worst = Math.max(worst, Math.abs(linearLat - mercatorLat) * KM_PER_DEGREE * 1000);
  }
  return worst;
}
