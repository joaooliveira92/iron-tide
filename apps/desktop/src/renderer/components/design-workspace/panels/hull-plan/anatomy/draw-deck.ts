import { cylinder, extrude, iso, lineOf, roundedPlan } from "./iso.js";
import type { Point3 } from "./iso.js";
import { solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { Reach } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Deck: margin, planking, hatches, breakwater, capstans and bollards. */
export function drawDeck(scene: AnatomyShipScene): void {
  const { near, L, B, D, halfAt, deckZ, P, add, DECK_REACH, ring } = scene;
  const part: PartDraft = {
    id: "deck",
    label: "Deck",
    solids: [],
    inks: [],
    lines: [],
    dots: [],
  };
  part.lines.push({
    d: lineOf(
      ring(0.975, (t) => deckZ(t) + 0.006 * D, {
        bow: DECK_REACH.bow * 0.97,
        stern: DECK_REACH.stern * 0.97,
      }),
      P,
      true,
    ),
    tone: "mid",
  });
  part.lines.push({
    d: lineOf(
      [
        [0, 0, deckZ(0) + 0.008 * D],
        [L, 0, deckZ(1) + 0.008 * D],
      ],
      P,
    ),
    tone: "faint",
  });
  // Planking: lanes run fore and aft and stop at the deck edge; butt joints are staggered lane by lane.
  const laneWidth = 0.075 * B;
  const lanes = Math.floor((halfAt(0.5) * 0.97) / laneWidth);
  for (let lane = -lanes; lane <= lanes; lane++) {
    const y = lane * laneWidth;
    const run: Point3[] = [];
    const seams: string[] = [];
    for (let step = 0; step <= 60; step++) {
      const t = 0.04 + (0.92 * step) / 60;
      if (halfAt(t) * 0.97 > Math.abs(y)) run.push([t * L, y, deckZ(t) + 0.006 * D]);
      else if (run.length > 1) {
        seams.push(lineOf(run.splice(0), P));
      } else run.length = 0;
    }
    if (run.length > 1) seams.push(lineOf(run, P));
    if (lane !== 0) {
      for (const d of seams) part.lines.push({ d, tone: "faint" });
    }
    const butts: Point3[] = [];
    const spacing = 0.062;
    for (let t = 0.07 + (((lane % 4) + 4) % 4) * (spacing / 4); t < 0.95; t += spacing) {
      if (halfAt(t) * 0.97 <= Math.abs(y) + laneWidth * 0.5) continue;
      const z = deckZ(t) + 0.006 * D;
      butts.push([t * L, y - laneWidth / 2, z], [t * L, y + laneWidth / 2, z]);
    }
    if (butts.length > 0) part.lines.push({ d: lineOf(butts, P), tone: "faint" });
  }
  // The rail along the deck edge: a line a little above the plating with stanchions on the near side.
  const railReach: Reach = { bow: DECK_REACH.bow * 0.985, stern: DECK_REACH.stern * 0.985 };
  part.lines.push({
    d: lineOf(
      ring(0.985, (t) => deckZ(t) + 0.045 * D, railReach),
      P,
      true,
    ),
    tone: "lo",
  });
  for (let t = 0.1; t < 0.93; t += 0.05) {
    const y = near * halfAt(t) * 0.985;
    const [px, py] = iso([t * L, y, deckZ(t) + 0.045 * D], P);
    part.dots.push({ x: px, y: py, r: 0.6, tone: "mid" });
  }
  for (const t of [0.2, 0.72]) {
    const plan = { x: t * L - 0.028 * L, y: -0.11 * B, w: 0.056 * L, d: 0.22 * B, r: 0.012 * L };
    part.solids.push(
      solid(extrude(roundedPlan(plan, 4), deckZ(t), 0.018 * D, P), "mid", { crease: "lo" }),
    );
    part.lines.push({
      d: lineOf(
        roundedPlan(
          {
            x: plan.x + 0.006 * L,
            y: plan.y + 0.02 * B,
            w: plan.w - 0.012 * L,
            d: plan.d - 0.04 * B,
            r: 0.006 * L,
          },
          4,
        ).map(([x, y]) => [x, y, deckZ(t) + 0.018 * D] as Point3),
        P,
        true,
      ),
      tone: "faint",
    });
    for (const dx of [-0.018, 0.018]) {
      for (const dy of [-0.07, 0.07]) {
        const [px, py] = iso([t * L + dx * L, dy * B, deckZ(t) + 0.018 * D], P);
        part.dots.push({ x: px, y: py, r: 0.65, tone: "mid" });
      }
    }
  }
  part.lines.push({
    d: lineOf(
      [
        [0.12 * L, 0, deckZ(0.12) + 0.02 * D],
        [0.075 * L, -halfAt(0.075) * 0.55, deckZ(0.075) + 0.02 * D],
        [0.12 * L, 0, deckZ(0.12) + 0.02 * D],
        [0.075 * L, halfAt(0.075) * 0.55, deckZ(0.075) + 0.02 * D],
      ],
      P,
    ),
    tone: "mid",
  });
  for (const t of [0.06, 0.94]) {
    for (const side of [-1, 1]) {
      if (Math.abs(side - near) > 0 && t < 0.5) continue;
      const x = t * L;
      const y = side * halfAt(t) * 0.6;
      const cap = cylinder(x, y, 0.032 * B, deckZ(t), 0.035 * D, P, 16);
      part.solids.push(solid(cap, "mid"));
      const [px, py] = iso([x, y, deckZ(t) + 0.035 * D], P);
      part.dots.push({ x: px, y: py, r: 0.7, tone: "lo" });
    }
  }
  for (let index = 1; index < 10; index++) {
    const t = index / 10;
    const [px, py] = iso([t * L, near * halfAt(t) * 0.9, deckZ(t) + 0.012 * D], P);
    part.dots.push({ x: px, y: py, r: 1, tone: "lo" });
  }
  add(part);
}
