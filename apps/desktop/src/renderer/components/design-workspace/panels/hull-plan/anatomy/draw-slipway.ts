import { extrude, iso, lineOf, pathOf, roundedPlan } from "./iso.js";
import type { Point3, Tone } from "./iso.js";
import { solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

export function drawSlipway(scene: AnatomyShipScene): void {
  const { near, L, B, D, halfAt, keelZ, wayHalf, wayBase, way, P, add, ring } = scene;
  const part: PartDraft = {
    id: "slipway",
    label: "Building slip",
    solids: [],
    inks: [],
    lines: [],
    dots: [],
  };
  part.halo = pathOf(
    roundedPlan(way, 8).map(([x, y]) => iso([x, y, wayBase], P)),
    true,
  );
  part.solids.push(
    solid(extrude(roundedPlan(way, 8), wayBase, 0.075 * D, P), "lo", { crease: "faint" }),
  );
  part.lines.push({
    d: lineOf(
      roundedPlan(
        {
          ...way,
          x: way.x + 0.01 * L,
          y: way.y + 0.01 * L,
          w: way.w - 0.02 * L,
          d: way.d - 0.02 * L,
        },
        8,
      ).map(([x, y]) => [x, y, wayBase + 0.075 * D] as Point3),
      P,
      true,
    ),
    tone: "faint",
  });
  const top = wayBase + 0.075 * D;
  part.inks.push({
    d: lineOf(
      ring(0.92, () => top).map(([x, y, z]): Point3 => [x + 0.012 * L, y - near * 0.05 * B, z]),
      P,
      true,
    ),
    tone: "shadow",
  });
  for (const t of [0.13, 0.3, 0.5, 0.7, 0.87]) {
    const bw = 0.052 * L;
    const bd = 0.15 * B;
    const bx = t * L;
    const blockZ = Math.min(keelZ(t) - 0.004 * D, top + 0.11 * D);
    part.solids.push(
      solid(
        extrude(
          roundedPlan({ x: bx - bw / 2, y: -bd / 2, w: bw, d: bd, r: 0.008 * L }, 3),
          top,
          Math.max(0.01, blockZ - top),
          P,
        ),
        "mid",
      ),
    );
    part.lines.push({
      d: lineOf(
        [
          [bx - bw * 0.4, -bd * 0.4, blockZ],
          [bx + bw * 0.4, bd * 0.4, blockZ],
        ],
        P,
      ),
      tone: "faint",
    });
  }
  for (const t of [0.32, 0.68]) {
    const sx = t * L;
    const sy = near * halfAt(t) * 0.63;
    const shore = {
      x: sx - 0.008 * L,
      y: sy - 0.012 * B,
      w: 0.016 * L,
      d: 0.024 * B,
      r: 0.004 * L,
    };
    part.solids.push(
      solid(extrude(roundedPlan(shore, 3), top, Math.max(0.01, 0.48 * D - top), P), "mid"),
    );
    const [shoreX, shoreY] = iso([sx, sy, 0.48 * D], P);
    part.dots.push({ x: shoreX, y: shoreY, r: 0.8, tone: "lo" });
  }
  const strip = {
    x: 0.06 * L,
    y: near * (wayHalf * 0.84) - 0.028 * B,
    w: 0.88 * L,
    d: 0.056 * B,
    r: 0.004 * L,
  };
  part.solids.push(
    solid(extrude(roundedPlan(strip, 3), top, 0.008 * D, P), "lo", { crease: "none" }),
  );
  const minor: Point3[] = [];
  const major: Point3[] = [];
  const count = 26;
  for (let index = 1; index < count; index++) {
    const x = strip.x + (strip.w * index) / count;
    const long = index % 5 === 0;
    const length = long ? 0.042 * B : 0.024 * B;
    const y0 = strip.y + (near > 0 ? strip.d - 0.004 * B : 0.004 * B);
    const y1 = y0 - near * length;
    (long ? major : minor).push([x, y0, top + 0.008 * D], [x, y1, top + 0.008 * D]);
  }
  part.lines.push({ d: lineOf(minor, P), tone: "lo" });
  part.lines.push({ d: lineOf(major, P), tone: "mid" });
  const plate = {
    x: 0.7 * L,
    y: near * (wayHalf * 0.5) - 0.06 * B,
    w: 0.16 * L,
    d: 0.1 * B,
    r: 0.006 * L,
  };
  part.solids.push(
    solid(extrude(roundedPlan(plate, 3), top, 0.012 * D, P), "lo", { crease: "none" }),
  );
  for (let index = 0; index < 3; index++) {
    const y = plate.y + plate.d * (0.28 + index * 0.2);
    part.lines.push({
      d: lineOf(
        [
          [plate.x + plate.w * 0.12, y, top + 0.012 * D],
          [plate.x + plate.w * (index === 2 ? 0.55 : 0.86), y, top + 0.012 * D],
        ],
        P,
      ),
      tone: "lo",
      dotted: index === 2,
    });
  }
  part.dots.push(
    ...[
      [plate.x + plate.w * 0.1, plate.y + plate.d * 0.15, top + 0.012 * D],
      [plate.x + plate.w * 0.9, plate.y + plate.d * 0.15, top + 0.012 * D],
    ].map(([x, y, z]) => {
      const [px, py] = iso([x!, y!, z!], P);
      return { x: px, y: py, r: 0.75, tone: "mid" as Tone };
    }),
  );
  add(part);
}
