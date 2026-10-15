import { describe, expect, it } from "vite-plus/test";
import { type BowStyle, type SternStyle, stationX } from "./geometry.js";
import {
  displaySheerRise,
  funnelShapes,
  houseMasses,
  type PathSegment,
  pathPoints,
  type Point,
  PROFILE_H,
  PROFILE_W,
  profileFrame,
  samplePath,
  serializePath,
} from "./profile-geometry.js";

const hull = (lengthM: number, depthM: number, draughtM: number) =>
  ({
    lengthWl: lengthM * 1000,
    beam: 12000,
    draught: draughtM * 1000,
    depthToMainDeck: depthM * 1000,
  }) as never;
const CRUISER = hull(85, 7, 4.2);
const BOWS: BowStyle[] = ["ram", "spoon", "plumb"];
const STERNS: SternStyle[] = ["counter", "transom", "round"];

/** Do two segments properly cross (touching at endpoints does not count)? */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const orient = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = orient(a, b, c);
  const d2 = orient(a, b, d);
  const d3 = orient(c, d, a);
  const d4 = orient(c, d, b);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}
function selfIntersects(poly: readonly Point[]): boolean {
  for (let i = 0; i < poly.length - 1; i++)
    for (let j = i + 2; j < poly.length - 1; j++) {
      if (i === 0 && j === poly.length - 2) continue;
      if (crosses(poly[i]!, poly[i + 1]!, poly[j]!, poly[j + 1]!)) return true;
    }
  return false;
}
const minX = (pts: readonly Point[]) => Math.min(...pts.map((p) => p.x));

describe("profile silhouette", () => {
  it("is one closed path for every bow and stern", () => {
    for (const bow of BOWS)
      for (const stern of STERNS) {
        const { outline } = profileFrame(CRUISER, 11000, bow, stern);
        expect(outline[0]!.kind).toBe("M");
        expect(outline.at(-1)!.kind).toBe("Z");
        expect(outline.filter((s) => s.kind === "M")).toHaveLength(1);
        expect(serializePath(outline).endsWith("Z")).toBe(true);
      }
  });

  it("has only finite coordinates and stays inside the view box, controls included", () => {
    for (const bow of BOWS)
      for (const stern of STERNS)
        for (const sheerBp of [0, 10000, 11000, 15000, 40000])
          for (const h of [CRUISER, hull(30, 3, 1.5), hull(140, 12, 7)]) {
            const pts = pathPoints(profileFrame(h, sheerBp, bow, stern).outline);
            for (const p of pts) {
              expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
              expect(p.x).toBeGreaterThanOrEqual(0);
              expect(p.x).toBeLessThanOrEqual(PROFILE_W);
              expect(p.y).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(PROFILE_H);
            }
          }
  });

  it("keeps the deck above the waterline above the keel, for supported forms", () => {
    for (const h of [CRUISER, hull(30, 3, 1.5), hull(140, 12, 7), hull(85, 7, 7)]) {
      const f = profileFrame(h, 11000);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(f.deckY(t)).toBeLessThan(f.waterlineY);
      expect(f.waterlineY).toBeLessThan(f.keelBaseY);
    }
  });

  it("does not self-intersect for any bow, stern or sheer", () => {
    for (const bow of BOWS)
      for (const stern of STERNS)
        for (const sheerBp of [10000, 11000, 30000])
          expect(
            selfIntersects(samplePath(profileFrame(CRUISER, sheerBp, bow, stern).outline)),
          ).toBe(false);
  });

  it("is continuous: every segment starts where the previous one ended", () => {
    for (const bow of BOWS)
      for (const stern of STERNS) {
        const { outline, anchors } = profileFrame(CRUISER, 11000, bow, stern);
        const ends = outline.filter(
          (s): s is Exclude<PathSegment, { kind: "Z" }> => s.kind !== "Z",
        );
        expect(ends.at(-1)!.to).toEqual(anchors.head);
      }
  });
});

describe("sheer", () => {
  it("displaySheerRise keeps zero, is monotonic and is capped", () => {
    expect(displaySheerRise(10000)).toBe(0);
    expect(displaySheerRise(9000)).toBe(0);
    expect(displaySheerRise(Number.NaN)).toBe(0);
    const low = displaySheerRise(10500);
    const medium = displaySheerRise(11000);
    const high = displaySheerRise(13000);
    expect(low).toBeGreaterThan(0.05);
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect(displaySheerRise(100000)).toBeLessThanOrEqual(0.4);
    // Amplified but not absurd: the sample 10% sheer reads as 10-25% of depth.
    expect(medium).toBeGreaterThan(0.1);
    expect(medium).toBeLessThan(0.25);
  });

  it("more sheer lifts the bow more than the stern; none is flat", () => {
    const flat = profileFrame(CRUISER, 10000);
    expect(flat.deckY(0)).toBeCloseTo(flat.deckY(0.5), 9);
    const f = profileFrame(CRUISER, 11000);
    const g = profileFrame(CRUISER, 13000);
    const bowRise = (p: typeof f) => p.deckMidY - p.deckY(0);
    const sternRise = (p: typeof f) => p.deckMidY - p.deckY(1);
    expect(bowRise(f)).toBeGreaterThan(sternRise(f));
    expect(sternRise(f)).toBeGreaterThan(0);
    expect(bowRise(g)).toBeGreaterThan(bowRise(f));
    expect(sternRise(g)).toBeGreaterThan(sternRise(f));
  });

  it("is smooth at midships (no flat-to-curve kink)", () => {
    const f = profileFrame(CRUISER, 11000);
    const slope = (t: number) => (f.deckY(t + 0.001) - f.deckY(t - 0.001)) / 0.002;
    // One-sided slopes vanish at midships (the bow and stern halves use different rises, so a centred
    // difference would straddle them), and grow toward the ends.
    const forward = (f.deckY(0.5 + 1e-4) - f.deckY(0.5)) / 1e-4;
    const backward = (f.deckY(0.5) - f.deckY(0.5 - 1e-4)) / 1e-4;
    expect(Math.abs(forward)).toBeLessThan(0.01);
    expect(Math.abs(backward)).toBeLessThan(0.01);
    expect(Math.abs(slope(0.52))).toBeLessThan(Math.abs(slope(0.6)));
  });
});

describe("bow and stern character", () => {
  const frames = Object.fromEntries(
    BOWS.map((b) => [b, profileFrame(CRUISER, 11000, b)]),
  ) as Record<BowStyle, ReturnType<typeof profileFrame>>;

  it("spoon, plumb and ram produce measurably different stems", () => {
    const heads = BOWS.map((b) => frames[b].anchors.head.x - stationX(0));
    expect(heads[1]!).toBeLessThan(0); // spoon: the head overhangs forward
    expect(Math.abs(heads[2]!)).toBeLessThan(1e-9); // plumb: upright above the waterline stem
    expect(heads[0]!).toBeGreaterThan(0); // ram: the upper stem returns aft
    const foot = BOWS.map((b) => frames[b].anchors.stemFoot.y - frames[b].waterlineY);
    expect(foot[2]!).toBeGreaterThan(foot[1]!); // plumb forefoot sits deeper than the spoon's
  });

  it("only a ram has a tip, and it is the foremost point without self-intersection", () => {
    expect(frames.spoon.anchors.ramTip).toBeUndefined();
    expect(frames.plumb.anchors.ramTip).toBeUndefined();
    const ram = frames.ram;
    const tip = ram.anchors.ramTip!;
    expect(tip.x).toBeLessThan(stationX(0));
    expect(tip.y).toBeGreaterThan(ram.waterlineY);
    expect(tip.y).toBeLessThan(ram.keelBaseY);
    expect(minX(samplePath(ram.outline))).toBeGreaterThanOrEqual(tip.x - 1e-6);
    expect(selfIntersects(samplePath(ram.outline))).toBe(false);
  });

  it("joins the keel to the stern cut-up and the sternpost cleanly", () => {
    for (const stern of STERNS) {
      const f = profileFrame(CRUISER, 11000, "ram", stern);
      const { keelAft, sternPost, deckStern } = f.anchors;
      expect(keelAft.y).toBeCloseTo(f.keelBaseY, 9);
      expect(sternPost.y).toBeGreaterThan(f.waterlineY);
      expect(sternPost.y).toBeLessThan(f.keelBaseY);
      expect(sternPost.x).toBeLessThanOrEqual(deckStern.x);
      expect(sternPost.x).toBeGreaterThan(keelAft.x);
      // The cut-up is an actual curve between the keel and the heel: its midpoint lies between them in y.
      const cutUp = samplePath(f.outline).filter(
        (p) => p.x > keelAft.x && p.x < sternPost.x && p.y > sternPost.y - 1e-6,
      );
      for (const p of cutUp) expect(p.y).toBeLessThanOrEqual(f.keelBaseY + 1e-6);
    }
  });

  it("stern styles differ", () => {
    const posts = STERNS.map((s) => profileFrame(CRUISER, 11000, "ram", s).anchors.sternPost);
    expect(new Set(posts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size).toBe(3);
  });
});

describe("extreme data", () => {
  it("never produces negative, inverted or non-finite geometry", () => {
    const hulls = [
      hull(0, 0, 0),
      hull(85, -5, -2),
      hull(85, 7, 20),
      hull(85, 0.1, 0.05),
      hull(85, 70, 3),
      { lengthWl: Number.NaN, beam: 0, draught: Number.NaN, depthToMainDeck: Number.NaN } as never,
    ];
    for (const h of hulls)
      for (const sheerBp of [Number.NaN, -500, 0, 10000, 500000]) {
        const f = profileFrame(h, sheerBp, "ram", "counter");
        expect(f.keelBaseY).toBeGreaterThan(f.waterlineY);
        expect(f.waterlineY).toBeGreaterThan(f.deckMidY - 1e-9);
        for (const p of pathPoints(f.outline)) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(PROFILE_H);
        }
        expect(selfIntersects(samplePath(f.outline))).toBe(false);
      }
  });

  it("keeps raw values for labels while drawing clamped ones", () => {
    const f = profileFrame(hull(85, 70, 3), 11000);
    expect(f.raw.depthM).toBe(70);
    expect(f.depthM).toBeLessThan(70);
    expect(f.depthM).toBeCloseTo(85 * 0.2, 6);
  });
});

describe("deck structures", () => {
  const frame = profileFrame(CRUISER, 13000);
  const zone = { startPermille: 520, endPermille: 640 };

  it("the superstructure rests on the sampled deck and its top follows the sheer", () => {
    const houses = houseMasses(frame, zone)!;
    const bottom = houses.lower.slice(0, 9);
    for (const p of bottom) {
      const permille = ((p.x - stationX(0)) / (stationX(1000) - stationX(0))) * 1000;
      expect(p.y).toBeCloseTo(frame.deckY(permille / 1000), 6);
    }
    for (const p of houses.lower) {
      const station = (p.x - stationX(0)) / (stationX(1000) - stationX(0));
      // Never below the deck, never more than one house-height above it (the chamfered corner is within 1 px).
      expect(p.y).toBeLessThanOrEqual(frame.deckY(station) + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(houses.lowerTopY(station) - 1);
    }
    expect(houses.lowerTopY(0.55)).toBeLessThan(frame.deckY(0.55));
  });

  it("is kept off the stem and stern and ignores empty zones", () => {
    const wide = houseMasses(frame, { startPermille: -100, endPermille: 2000 })!;
    expect(wide.startPermille).toBe(50);
    expect(wide.endPermille).toBe(950);
    expect(houseMasses(frame, undefined)).toBeUndefined();
    expect(houseMasses(frame, { startPermille: 500, endPermille: 502 })).toBeUndefined();
  });

  it("the bridge sits on the lower mass", () => {
    const houses = houseMasses(frame, zone)!;
    const lowerTop = Math.min(...houses.lower.map((p) => p.y));
    expect(Math.min(...houses.upper.map((p) => p.y))).toBeLessThan(lowerTop);
    expect(Math.max(...houses.upper.map((p) => p.y))).toBeLessThanOrEqual(
      Math.max(...houses.lower.map((p) => p.y)),
    );
  });

  it("zero funnels produce no funnel shapes", () => {
    expect(funnelShapes(frame, [], houseMasses(frame, zone))).toEqual([]);
  });

  it("funnels sit at their real stations, in stable order, seated on the house or deck, inside the view", () => {
    const houses = houseMasses(frame, zone);
    const input = [
      { instanceId: "f-b", stationPermille: 600 },
      { instanceId: "f-a", stationPermille: 560 },
      { instanceId: "f-c", stationPermille: 300 },
    ];
    const shapes = funnelShapes(frame, input, houses);
    expect(shapes.map((s) => s.instanceId)).toEqual(["f-c", "f-a", "f-b"]);
    expect(shapes.map((s) => s.centreX)).toEqual([300, 560, 600].map(stationX));
    for (const s of shapes) {
      const t = s.stationPermille / 1000;
      const inside = s.stationPermille >= 520 && s.stationPermille <= 640;
      expect(s.baseY).toBeCloseTo(inside ? houses!.lowerTopY(t) : frame.deckY(t), 9);
      expect(s.baseY).toBeLessThanOrEqual(frame.deckY(t) + 1e-9);
      expect(s.topY).toBeLessThan(s.baseY);
      expect(s.topY).toBeGreaterThanOrEqual(0);
      for (const p of s.polygon) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    // Neighbouring funnels 40 permille apart keep a visible gap.
    const [, a, b] = shapes;
    expect(b!.centreX - a!.centreX - (a!.widthPx / 2 + b!.widthPx / 2)).toBeGreaterThan(1);
  });

  it("is deterministic", () => {
    const input = [{ instanceId: "f", stationPermille: 580 }];
    expect(funnelShapes(frame, input, houseMasses(frame, zone))).toEqual(
      funnelShapes(frame, input, houseMasses(frame, zone)),
    );
  });
});
