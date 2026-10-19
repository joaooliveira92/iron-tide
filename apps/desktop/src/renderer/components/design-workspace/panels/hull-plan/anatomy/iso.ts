/**
 * A compact isometric drawing core for the ship anatomy figure. World units are metres; x runs from the bow
 * (0) to the stern (+x), y is athwartships and z is up from the keel. It keeps the parts of `iso-kit` the
 * figure needs — projection, extrusion, lofting between shaped rings, fitting and screen-space widths — while
 * leaving out the page and plate machinery the desktop app already owns.
 */

export type Flat = [number, number];
export type Plane = [number, number];
export type Point3 = [number, number, number];

export type Tone = "hi" | "mid" | "lo" | "faint";

export interface Projection {
  readonly origin: Flat;
  readonly scale: number;
  readonly azimuth: number;
  readonly elevation: number;
  /** Display exaggeration of vertical distances; the ship is a model, not a lines plan. */
  readonly zScale: number;
}

export interface SolidPaths {
  readonly fill: string;
  readonly outline: string;
  readonly crease: string;
  readonly top: string;
  readonly shades: readonly string[];
}

const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
const tenth = (value: number) => {
  // A value already rounded to a tenth prints its shortest form ("12", "12.5"); -0 prints as "0".
  const text = String(Math.round(value * 10) / 10);
  return text === "-0" ? "0" : text;
};

const camera = (projection: Projection) => {
  const a = projection.azimuth * RADIANS;
  const e = projection.elevation * RADIANS;
  return {
    sinA: Math.sin(a),
    cosA: Math.cos(a),
    sinE: Math.sin(e),
    cosE: Math.cos(e),
    k: projection.scale * UNIT,
  };
};

export function iso([x, y, z]: Point3, projection: Projection): Flat {
  const { origin } = projection;
  const { sinA, cosA, sinE, cosE, k } = camera(projection);
  return [
    origin[0] + (x * sinA - y * cosA) * k,
    origin[1] + ((x * cosA + y * sinA) * sinE - z * projection.zScale * cosE) * k,
  ];
}

export function towardViewer(projection: Projection): Plane {
  const { sinA, cosA } = camera(projection);
  return [cosA, sinA];
}

export function depthOf([x, y, z]: Point3, projection: Projection): number {
  const { sinA, cosA, sinE, cosE } = camera(projection);
  return (x * cosA + y * sinA) * cosE + z * projection.zScale * sinE;
}

export function pathOf(points: readonly Flat[], closed = false): string {
  if (points.length === 0) return "";
  return (
    points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") +
    (closed ? "Z" : "")
  );
}

export function lineOf(points: readonly Point3[], projection: Projection, closed = false): string {
  return pathOf(
    points.map((point) => iso(point, projection)),
    closed,
  );
}

export interface Plan {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly r: number;
}

export function roundedPlan(plan: Plan, steps = 6): Plane[] {
  const radius = Math.max(0, Math.min(plan.r, plan.w / 2, plan.d / 2));
  const corners: readonly (readonly [number, number, number])[] = [
    [plan.x + plan.w - radius, plan.y + radius, -Math.PI / 2],
    [plan.x + plan.w - radius, plan.y + plan.d - radius, 0],
    [plan.x + radius, plan.y + plan.d - radius, Math.PI / 2],
    [plan.x + radius, plan.y + radius, Math.PI],
  ];
  const ring: Plane[] = [];
  for (const [cx, cy, start] of corners) {
    for (let step = 0; step <= steps; step++) {
      const angle = start + (step / steps) * (Math.PI / 2);
      ring.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  }
  return ring;
}

export function circle(cx: number, cy: number, radius: number, steps = 32): Plane[] {
  return Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as Plane;
  });
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 28): Plane[] {
  return Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)] as Plane;
  });
}

function signedArea(ring: readonly Plane[]): number {
  let total = 0;
  for (let index = 0; index < ring.length; index++) {
    const [ax, ay] = ring[index]!;
    const [bx, by] = ring[(index + 1) % ring.length]!;
    total += ax * by - bx * ay;
  }
  return total / 2;
}

function facings(ring: readonly Plane[], projection: Projection): readonly boolean[] {
  const [vx, vy] = towardViewer(projection);
  const facing: boolean[] = [];
  for (let index = 0; index < ring.length; index++) {
    const [ax, ay] = ring[index]!;
    const [bx, by] = ring[(index + 1) % ring.length]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    facing.push((dy / length) * vx + (-dx / length) * vy > 1e-9);
  }
  return facing;
}

function runsOf(states: readonly boolean[], want: boolean): number[][] {
  const count = states.length;
  if (count === 0) return [];
  const wanted = states.filter((state) => state === want).length;
  if (wanted === 0) return [];
  if (wanted === count) return [states.map((_, index) => index)];
  const runs: number[][] = [];
  for (let start = 0; start < count; start++) {
    if (states[start] !== want || states[(start + count - 1) % count] === want) continue;
    const run: number[] = [];
    for (let at = start; states[at] === want; at = (at + 1) % count) {
      run.push(at);
      if (run.length === count) break;
    }
    runs.push(run);
  }
  return runs;
}

function shadeBuckets(ring: readonly Plane[], projection: Projection): number[] {
  const { sinA, cosA } = camera(projection);
  const [lx, ly] = [-sinA, cosA];
  return ring.map((_, index) => {
    const [ax, ay] = ring[index]!;
    const [bx, by] = ring[(index + 1) % ring.length]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dy / length;
    const ny = -dx / length;
    const lit = (nx * lx + ny * ly + 1) / 2;
    return Math.min(3, Math.max(0, Math.floor(lit * 4)));
  });
}

/** Extrudes a plan ring straight up; the deck/bridge/box workhorse. */
export function extrude(
  ring: readonly Plane[],
  z: number,
  height: number,
  projection: Projection,
): SolidPaths {
  const top = ring.map(([x, y]): Point3 => [x, y, z + height]);
  const bottom = ring.map(([x, y]): Point3 => [x, y, z]);
  return loft(top, bottom, projection);
}

/**
 * Lofts between two matching rings of world points. The top ring may follow a sheer, so hull deck edges and
 * tapered funnels share one routine.
 */
export function loft(
  givenTop: readonly Point3[],
  givenBottom: readonly Point3[],
  projection: Projection,
): SolidPaths {
  if (givenTop.length !== givenBottom.length || givenTop.length < 3) {
    return { fill: "", outline: "", crease: "", top: "", shades: ["", "", "", ""] };
  }
  const topPlan = givenTop.map(([x, y]) => [x, y] as Plane);
  const reverse = signedArea(topPlan) < 0;
  const top = reverse ? [...givenTop].reverse() : [...givenTop];
  const bottom = reverse ? [...givenBottom].reverse() : [...givenBottom];
  const plan = top.map(([x, y]) => [x, y] as Plane);
  const facing = facings(plan, projection);
  const flatsTop = top.map((point) => iso(point, projection));
  const flatsBottom = bottom.map((point) => iso(point, projection));
  const count = top.length;

  const fillParts = [pathOf(flatsTop, true), pathOf(flatsBottom, true)];
  const buckets: string[][] = Array.from({ length: 4 }, () => []);
  const shades = shadeBuckets(plan, projection);

  for (let index = 0; index < count; index++) {
    if (!facing[index]) continue;
    const next = (index + 1) % count;
    const quad = [flatsTop[index]!, flatsTop[next]!, flatsBottom[next]!, flatsBottom[index]!];
    fillParts.push(pathOf(quad, true));
    buckets[shades[index]!]!.push(pathOf(quad, true));
  }

  const outline: string[] = [];
  const crease: string[] = [];
  for (const run of runsOf(facing, false)) {
    outline.push(
      pathOf(
        run.map((index) => flatsTop[index]!),
        false,
      ),
    );
  }
  for (const run of runsOf(facing, true)) {
    crease.push(
      pathOf(
        run.map((index) => flatsTop[index]!),
        false,
      ),
    );
    outline.push(
      pathOf(
        run.map((index) => flatsBottom[index]!),
        false,
      ),
    );
  }
  for (let index = 0; index < count; index++) {
    if (facing[(index + count - 1) % count] !== facing[index]) {
      outline.push(pathOf([flatsTop[index]!, flatsBottom[index]!], false));
    }
  }

  return {
    fill: fillParts.join(""),
    outline: outline.join(""),
    crease: crease.join(""),
    top: pathOf(flatsTop, true),
    shades: buckets.map((paths) => paths.join("")),
  };
}

export function cylinder(
  cx: number,
  cy: number,
  radius: number,
  z: number,
  height: number,
  projection: Projection,
  steps = 32,
): SolidPaths {
  return extrude(circle(cx, cy, radius, steps), z, height, projection);
}

export function discPath(
  cx: number,
  cy: number,
  radius: number,
  z: number,
  projection: Projection,
  steps = 28,
): string {
  return pathOf(
    circle(cx, cy, radius, steps).map(([x, y]) => iso([x, y, z], projection)),
    true,
  );
}

export interface FitOptions {
  readonly pad?: number;
  readonly headroom?: number;
  readonly azimuth: number;
  readonly elevation?: number;
  readonly zScale?: number;
}

export function fitProjection(
  points: readonly Point3[],
  width: number,
  height: number,
  options: FitOptions,
): Projection {
  const { pad = 18, headroom = 0, azimuth, elevation = 28, zScale = 1.3 } = options;
  const unit: Projection = { origin: [0, 0], scale: 1, azimuth, elevation, zScale };
  const flat = points.map((point) => iso(point, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  const scale = Math.min(
    (width - pad * 2) / (right - left || 1),
    (height - pad * 2 - headroom) / (down - up || 1),
  );
  return {
    origin: [
      width / 2 - ((left + right) / 2) * scale,
      headroom + (height - headroom) / 2 - ((up + down) / 2) * scale,
    ],
    scale,
    azimuth,
    elevation,
    zScale,
  };
}

export function screenWidth(metres: number, projection: Projection): number {
  return metres * projection.scale;
}
