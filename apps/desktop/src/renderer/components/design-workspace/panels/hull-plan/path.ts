export interface Point {
  readonly x: number;
  readonly y: number;
}

export type PathSegment =
  | { readonly kind: "M" | "L"; readonly to: Point }
  | { readonly kind: "Q"; readonly control: Point; readonly to: Point }
  | { readonly kind: "C"; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly kind: "Z" };

const fmt = (n: number) => n.toFixed(2);
const pt = (p: Point) => `${fmt(p.x)} ${fmt(p.y)}`;

export function serializePath(segments: readonly PathSegment[]): string {
  return segments
    .map((s) => {
      switch (s.kind) {
        case "M":
        case "L":
          return `${s.kind} ${pt(s.to)}`;
        case "Q":
          return `Q ${pt(s.control)} ${pt(s.to)}`;
        case "C":
          return `C ${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`;
        case "Z":
          return "Z";
      }
    })
    .join(" ");
}

export function pathPoints(segments: readonly PathSegment[]): Point[] {
  return segments.flatMap((s): Point[] => {
    switch (s.kind) {
      case "M":
      case "L":
        return [s.to];
      case "Q":
        return [s.control, s.to];
      case "C":
        return [s.c1, s.c2, s.to];
      case "Z":
        return [];
    }
  });
}

export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function samplePath(segments: readonly PathSegment[], steps = 24): Point[] {
  const out: Point[] = [];
  let cursor: Point | undefined;
  for (const s of segments) {
    if (s.kind === "M" || s.kind === "L") {
      out.push(s.to);
      cursor = s.to;
    } else if (s.kind === "Q" && cursor) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        out.push(lerp(lerp(cursor, s.control, t), lerp(s.control, s.to, t), t));
      }
      cursor = s.to;
    } else if (s.kind === "C" && cursor) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ab = lerp(cursor, s.c1, t);
        const bc = lerp(s.c1, s.c2, t);
        const cd = lerp(s.c2, s.to, t);
        out.push(lerp(lerp(ab, bc, t), lerp(bc, cd, t), t));
      }
      cursor = s.to;
    }
  }
  return out;
}

export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
export const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

export const polygonPoints = (points: readonly Point[]): string =>
  points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
