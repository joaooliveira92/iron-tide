import { ellipse, extrude, iso, lineOf, loft, pathOf, roundedPlan } from "./iso.js";
import type { Flat, Point3 } from "./iso.js";
import { round1, solid, ribbon } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Hull: shaped shell, waterline, boot topping, plating seams, portholes, stern gear. */
export function drawHull(scene: AnatomyShipScene): void {
  const {
    model,
    near,
    L,
    B,
    D,
    T,
    shownB,
    shownD,
    halfAt,
    deckZ,
    keelZ,
    halfAtZ,
    P,
    facts,
    add,
    text,
    DECK_REACH,
    WATER_REACH,
    KEEL_REACH,
    ring,
    sidePoints,
  } = scene;
  const part: PartDraft = {
    id: "hull",
    label: "Hull",
    solids: [],
    inks: [],
    lines: [],
    dots: [],
  };
  part.solids.push(
    solid(
      loft(
        ring(0.96, () => T),
        ring(0.5, keelZ, KEEL_REACH),
        P,
      ),
      "hi",
      { crease: "none", fill: "under" },
    ),
    solid(
      loft(
        ring(1, deckZ, DECK_REACH),
        ring(0.96, () => T),
        P,
      ),
      "hi",
      { crease: "faint" },
    ),
    solid(
      ribbon(
        sidePoints(
          0.01,
          0.99,
          () => T + 0.026 * D,
          (t) => near * halfAtZ(t, T + 0.026 * D),
          30,
        ).map(([x, y, z]) => iso([x!, y!, z!], P)),
        sidePoints(
          0.01,
          0.99,
          () => T - 0.026 * D,
          (t) => near * halfAtZ(t, T - 0.026 * D),
          30,
        ).map(([x, y, z]) => iso([x!, y!, z!], P)),
      ),
      "lo",
      { crease: "none", fill: "boot", flat: true },
    ),
  );
  part.lines.push({
    d: lineOf(
      sidePoints(
        0.02,
        0.98,
        () => T,
        (t) => near * halfAtZ(t, T),
      ),
      P,
    ),
    tone: "lo",
    heavy: true,
  });
  for (let t = 0.06; t < 0.95; t += 0.055) {
    part.lines.push({
      d: lineOf(
        [
          [t * L, near * halfAtZ(t, T + 0.026 * D) * 0.997, T + 0.026 * D],
          [t * L, near * halfAtZ(t, deckZ(t) - 0.02 * D) * 0.998, deckZ(t) - 0.02 * D],
        ],
        P,
      ),
      tone: "faint",
    });
  }
  for (let t = 0.11; t < 0.91; t += 0.044) {
    const [px, py] = iso(
      [t * L, near * halfAtZ(t, deckZ(t) - 0.16 * D) * 0.995, deckZ(t) - 0.16 * D],
      P,
    );
    part.dots.push({ x: px, y: py, r: 0.9, tone: "lo" });
  }
  const hawseZ = deckZ(0.045) - 0.13 * D;
  const hawse: Flat[] = ellipse(0, 0, 1, 1, 14).map(([ex, ey]) => {
    const [px, py] = iso(
      [0.045 * L + ex * 0.006 * L, near * halfAtZ(0.045, hawseZ) + ey * 0.01 * B, hawseZ],
      P,
    );
    return [px, py];
  });
  part.inks.push({ d: pathOf(hawse, true) });
  part.lines.push({
    d: lineOf(
      [
        [0.045 * L, near * halfAtZ(0.045, hawseZ) - 0.008 * B, hawseZ],
        [0.075 * L, near * halfAt(0.075) * 0.9, deckZ(0.075) + 0.015 * D],
      ],
      P,
    ),
    tone: "lo",
    dotted: true,
  });
  {
    // A stocked anchor catted at the hawse: shank, stock across the head and the curved arms.
    const ax = 0.052 * L;
    const ay = near * (halfAtZ(0.052, hawseZ) + 0.012 * B);
    const top = hawseZ - 0.03 * D;
    const foot = hawseZ - 0.22 * D;
    const arm = 0.055 * D;
    part.lines.push(
      {
        d: lineOf(
          [
            [ax, ay, top],
            [ax, ay, foot],
          ],
          P,
        ),
        tone: "mid",
        heavy: true,
      },
      {
        d: lineOf(
          [
            [ax - 0.7 * arm, ay, top - 0.02 * D],
            [ax + 0.7 * arm, ay, top - 0.02 * D],
          ],
          P,
        ),
        tone: "mid",
      },
      {
        d: lineOf(
          [
            [ax - arm, ay, foot + 0.045 * D],
            [ax - 0.5 * arm, ay, foot - 0.005 * D],
            [ax, ay, foot],
            [ax + 0.5 * arm, ay, foot - 0.005 * D],
            [ax + arm, ay, foot + 0.045 * D],
          ],
          P,
        ),
        tone: "mid",
        heavy: true,
      },
    );
  }
  for (let index = 0; index < 6; index++) {
    const t = 0.045 + index * 0.006;
    const z = hawseZ - 0.012 * D * index;
    const [px, py] = iso([t * L, near * (halfAtZ(t, z) + 0.008 * B), z], P);
    part.dots.push({ x: px, y: py, r: 0.7, tone: "mid" });
  }
  if (model.frame.bow === "ram") {
    const bowHalf = Math.max(0.018 * B, halfAt(0.012));
    const ramTop: Point3[] = [
      [-0.002 * L, 0, 0.74 * T],
      [0.024 * L, bowHalf, 0.74 * T],
      [0.024 * L, -bowHalf, 0.74 * T],
    ];
    const ramBottom: Point3[] = [
      [-0.026 * L, 0, 0.5 * T],
      [0.02 * L, bowHalf, 0.5 * T],
      [0.02 * L, -bowHalf, 0.5 * T],
    ];
    part.solids.push(solid(loft(ramTop, ramBottom, P), "hi", { crease: "mid" }));
  }
  const shaftZ = 0.28 * T;
  const rudderX = L + WATER_REACH.stern - 0.01 * L;
  part.solids.push(
    solid(
      extrude(
        roundedPlan({ x: rudderX, y: -0.006 * B, w: 0.016 * L, d: 0.01 * B, r: 0.003 * L }, 3),
        0.16 * T,
        0.5 * T,
        P,
      ),
      "mid",
    ),
  );
  part.lines.push({
    d: lineOf(
      [
        [0.94 * L, 0, shaftZ],
        [0.985 * L, 0, shaftZ],
      ],
      P,
    ),
    tone: "mid",
  });
  const propAt = iso([0.988 * L, 0, shaftZ], P);
  const propR = Math.max(3, Math.min(9, 0.02 * L * P.scale));
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI * 2 + 0.4;
    part.lines.push({
      d: pathOf([
        [propAt[0], propAt[1]],
        [propAt[0] + Math.cos(angle) * propR, propAt[1] + Math.sin(angle) * propR],
      ]),
      tone: "lo",
    });
  }
  part.dots.push({ x: propAt[0], y: propAt[1], r: 1.1, tone: "mid" });
  add(part, text(L / 2, 0, D * 0.55, 40));
  facts.set("hull", `${round1(L)} m · ${round1(shownB)} m beam · ${round1(shownD)} m depth`);
}
