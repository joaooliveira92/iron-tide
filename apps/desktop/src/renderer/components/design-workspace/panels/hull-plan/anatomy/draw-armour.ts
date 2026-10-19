import { extrude, iso, lineOf, pathOf, roundedPlan } from "./iso.js";
import { clamp, round1, solid, ribbon } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Armour: main belt, armoured deck and citadel bounds. */
export function drawArmour(scene: AnatomyShipScene): void {
  const {
    draft,
    near,
    L,
    D,
    T,
    halfAt,
    deckZ,
    halfAtZ,
    P,
    facts,
    add,
    text,
    sidePoints,
    regionOf,
  } = scene;
  const belt = regionOf("BELT_MAIN");
  const beltLengthMm = draft.armour.regions
    .filter((r) => r.region === "BELT_MAIN")
    .reduce((total, r) => total + r.lengthMm, 0);
  if (belt && beltLengthMm > 0) {
    const permille = clamp(
      (beltLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const heightM = clamp(belt.heightMm / 1000, 0.14 * D, 0.62 * D);
    const beltMm = Math.round(belt.thicknessUm / 1000);
    const z0 = T * 0.48;
    const z1 = Math.min(deckZ((from + to) / 2), z0 + heightM);
    const top = sidePoints(
      from,
      to,
      () => z1,
      (t) => near * halfAtZ(t, z1),
      24,
    ).map(([x, y, z]) => iso([x!, y!, z!], P));
    const bottom = sidePoints(
      from,
      to,
      () => z0,
      (t) => near * halfAtZ(t, z0),
      24,
    ).map(([x, y, z]) => iso([x!, y!, z!], P));
    const part: PartDraft = {
      id: "armour:belt",
      label: "Main belt",
      solids: [
        solid(ribbon(top, bottom), beltMm >= 250 ? "mid" : "hi", {
          crease: "none",
          fill: "face",
          flat: true,
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    part.lines.push({ d: pathOf(top, false), tone: "mid", heavy: true });
    // A thick belt reads as a second, lower edge: one extra rule per 100 mm beyond 150 mm, up to three.
    for (let rule = 1; rule <= clamp(Math.floor((beltMm - 150) / 100), 0, 3); rule++) {
      const zr = z0 + ((z1 - z0) * rule) / 5;
      part.lines.push({
        d: pathOf(
          sidePoints(
            from,
            to,
            () => zr,
            (t) => near * halfAtZ(t, zr),
            24,
          ).map(([x, y, z]) => iso([x!, y!, z!], P)),
          false,
        ),
        tone: "lo",
      });
    }
    for (let index = 1; index < 9; index++) {
      const t = from + ((to - from) * index) / 9;
      part.lines.push({
        d: lineOf(
          [
            [t * L, near * halfAtZ(t, z0), z0],
            [t * L, near * halfAtZ(t, z1), z1],
          ],
          P,
        ),
        tone: "faint",
      });
      const [px, py] = iso([t * L, near * halfAtZ(t, (z0 + z1) / 2), (z0 + z1) / 2], P);
      part.dots.push({ x: px, y: py, r: 0.6, tone: "lo" });
    }
    add(part, text(((from + to) / 2) * L, near * halfAt((from + to) / 2) * 0.98, z1, 24));
    facts.set(
      "armour:belt",
      `Main belt ${Math.round(belt.thicknessUm / 1000)} mm · ${round1(beltLengthMm / 1000)} m · ${round1(heightM)} m high`,
    );
  }

  const upperBelt = regionOf("BELT_UPPER");
  if (upperBelt && belt && beltLengthMm > 0) {
    const permille = clamp(
      (Math.min(upperBelt.lengthMm, beltLengthMm) / Math.max(1, Number(draft.hull.lengthWl))) *
        1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const z0 = Math.min(
      deckZ(0.5) - 0.02 * D,
      T * 0.48 + clamp(belt.heightMm / 1000, 0.14 * D, 0.62 * D),
    );
    const z1 = Math.min(
      deckZ((from + to) / 2),
      z0 + clamp(upperBelt.heightMm / 1000, 0.08 * D, 0.3 * D),
    );
    if (z1 > z0) {
      const edge = (z: number) =>
        sidePoints(
          from,
          to,
          () => z,
          (t) => near * halfAtZ(t, z),
          24,
        ).map(([x, y, zz]) => iso([x!, y!, zz!], P));
      const part: PartDraft = {
        id: "armour:belt-upper",
        label: "Upper belt",
        solids: [
          solid(ribbon(edge(z1), edge(z0)), "mid", { crease: "none", fill: "face", flat: true }),
        ],
        inks: [],
        lines: [{ d: pathOf(edge(z1), false), tone: "mid", heavy: true }],
        dots: [],
      };
      add(part, text(((from + to) / 2) * L, near * halfAt((from + to) / 2) * 0.98, z1, 20));
      facts.set("armour:belt-upper", `Upper belt ${Math.round(upperBelt.thicknessUm / 1000)} mm`);
    }
  }

  const deckArmour = regionOf("DECK_MAIN") ?? regionOf("DECK_SLOPE");
  if (deckArmour && beltLengthMm > 0) {
    const permille = clamp(
      (beltLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const plan = {
      x: from * L,
      y: -halfAt((from + to) / 2) * 0.58,
      w: (to - from) * L,
      d: halfAt((from + to) / 2) * 1.16,
      r: 0.012 * L,
    };
    const part: PartDraft = {
      id: "armour:deck",
      label: "Armoured deck",
      solids: [
        solid(extrude(roundedPlan(plan, 4), deckZ((from + to) / 2), 0.011 * D, P), "mid", {
          crease: "lo",
          fill: "face",
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    for (let index = 1; index < 6; index++) {
      const x = plan.x + (plan.w * index) / 6;
      part.lines.push({
        d: lineOf(
          [
            [x, plan.y, deckZ((from + to) / 2) + 0.011 * D],
            [x, plan.y + plan.d, deckZ((from + to) / 2) + 0.011 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    add(part, text((from + to) * 0.5 * L, 0, deckZ(0.5) + 0.02 * D, 18));
    facts.set("armour:deck", `Armoured deck ${Math.round(deckArmour.thicknessUm / 1000)} mm`);
  }

  const citadelLengthMm = Math.max(0, draft.armour.citadelLengthMm);
  if (citadelLengthMm > 0) {
    const permille = clamp(
      (citadelLengthMm / Math.max(1, Number(draft.hull.lengthWl))) * 1000,
      20,
      980,
    );
    const from = (1000 - permille) / 2000;
    const to = (1000 + permille) / 2000;
    const mid = (from + to) / 2;
    const plan = {
      x: from * L,
      y: -halfAt(mid) * 0.66,
      w: (to - from) * L,
      d: halfAt(mid) * 1.32,
      r: 0.008 * L,
    };
    const part: PartDraft = {
      id: "armour:citadel",
      label: "Armoured citadel",
      solids: [
        solid(extrude(roundedPlan(plan, 4), deckZ(mid), 0.008 * D, P), "mid", {
          crease: "lo",
          fill: "face",
        }),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    for (const t of [from, to]) {
      part.lines.push({
        d: lineOf(
          [
            [t * L, near * halfAtZ(t, deckZ(t)), deckZ(t)],
            [t * L, near * halfAtZ(t, T), T],
          ],
          P,
        ),
        tone: "mid",
        dotted: true,
      });
    }
    for (let index = 1; index < 4; index++) {
      const x = plan.x + (plan.w * index) / 4;
      part.lines.push({
        d: lineOf(
          [
            [x, plan.y, deckZ(mid) + 0.008 * D],
            [x, plan.y + plan.d, deckZ(mid) + 0.008 * D],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    add(part, text(mid * L, 0, deckZ(mid) + 0.02 * D, 20));
    facts.set("armour:citadel", `Armoured citadel ${round1(citadelLengthMm / 1000)} m long`);
  }
}
