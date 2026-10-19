import { extrude, iso, lineOf, pathOf, roundedPlan } from "./iso.js";
import type { Point3 } from "./iso.js";
import { round1, solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Superstructure: stepped deckhouse, bridge platform, windows, rails and ladders. */
export function drawSuperstructure(scene: AnatomyShipScene): void {
  const {
    near,
    L,
    B,
    D,
    deckZ,
    hasHouse,
    houseT0,
    houseT1,
    houseW,
    houseHalf,
    houseMid,
    lowerTop,
    upperTop,
    P,
    facts,
    add,
    text,
  } = scene;
  if (hasHouse) {
    const house: PartDraft = {
      id: "superstructure",
      label: "Superstructure",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const lowerPlan = {
      x: houseT0 * L,
      y: -houseHalf,
      w: houseW,
      d: houseHalf * 2,
      r: 0.05 * houseW,
    };
    house.solids.push(
      solid(
        extrude(roundedPlan(lowerPlan, 5), deckZ(houseMid) - 0.05 * D, 0.22 * D + 0.05 * D, P),
        "mid",
        { crease: "lo" },
      ),
    );
    const upperPlan = {
      x: lowerPlan.x + houseW * 0.18,
      y: -houseHalf * 0.7,
      w: houseW * 0.44,
      d: houseHalf * 1.4,
      r: 0.04 * houseW,
    };
    house.solids.push(
      solid(
        extrude(roundedPlan(upperPlan, 5), lowerTop - 0.01 * D, 0.14 * D + 0.01 * D, P),
        "mid",
        { crease: "lo" },
      ),
    );
    const bridgePlan = {
      x: upperPlan.x - houseW * 0.03,
      y: -houseHalf * 0.82,
      w: upperPlan.w + houseW * 0.06,
      d: houseHalf * 1.64,
      r: 0.03 * houseW,
    };
    house.solids.push(
      solid(extrude(roundedPlan(bridgePlan, 5), upperTop, 0.022 * D, P), "hi", { crease: "mid" }),
    );
    const windowY = near * (houseHalf + 0.006 * B);
    const lowerWindows: string[] = [];
    for (let index = 0; index < 7; index++) {
      const x0 = lowerPlan.x + houseW * (0.08 + index * 0.12);
      const x1 = x0 + houseW * 0.065;
      const z0 = lowerTop - 0.095 * D;
      const z1 = lowerTop - 0.052 * D;
      lowerWindows.push(
        pathOf(
          [
            iso([x0, windowY, z0], P),
            iso([x1, windowY, z0], P),
            iso([x1, windowY, z1], P),
            iso([x0, windowY, z1], P),
          ],
          true,
        ),
      );
    }
    house.inks.push({ d: lowerWindows.join(""), tone: "glass" });
    const upperWindows: string[] = [];
    for (let index = 0; index < 4; index++) {
      const x0 = upperPlan.x + upperPlan.w * (0.1 + index * 0.21);
      const x1 = x0 + upperPlan.w * 0.12;
      const z0 = upperTop - 0.07 * D;
      const z1 = upperTop - 0.03 * D;
      upperWindows.push(
        pathOf(
          [
            iso([x0, windowY * 0.7, z0], P),
            iso([x1, windowY * 0.7, z0], P),
            iso([x1, windowY * 0.7, z1], P),
            iso([x0, windowY * 0.7, z1], P),
          ],
          true,
        ),
      );
    }
    house.inks.push({ d: upperWindows.join(""), tone: "glass" });
    for (const xShare of [0.48, 0.54]) {
      const x0 = lowerPlan.x + houseW * xShare;
      house.inks.push({
        tone: "glass",
        d: pathOf(
          [
            iso([x0, windowY, deckZ(houseMid) + 0.01 * D], P),
            iso([x0 + houseW * 0.03, windowY, deckZ(houseMid) + 0.01 * D], P),
            iso([x0 + houseW * 0.03, windowY, lowerTop - 0.03 * D], P),
            iso([x0, windowY, lowerTop - 0.03 * D], P),
          ],
          true,
        ),
      });
    }
    house.lines.push({
      d: lineOf(
        roundedPlan(
          {
            x: bridgePlan.x + 0.01 * houseW,
            y: bridgePlan.y + 0.02 * houseHalf,
            w: bridgePlan.w - 0.02 * houseW,
            d: bridgePlan.d - 0.04 * houseHalf,
            r: 0.02 * houseW,
          },
          5,
        ).map(([x, y]) => [x, y, upperTop + 0.022 * D] as Point3),
        P,
        true,
      ),
      tone: "faint",
    });
    const railY = bridgePlan.y + (near > 0 ? bridgePlan.d : 0);
    for (let index = 0; index <= 6; index++) {
      const railX = bridgePlan.x + (bridgePlan.w * index) / 6;
      const [rx, ry] = iso([railX, railY, upperTop + 0.024 * D], P);
      house.dots.push({ x: rx, y: ry, r: 0.6, tone: "lo" });
    }
    for (const t of [houseT0 + 0.12 * (houseT1 - houseT0), houseT0 + 0.74 * (houseT1 - houseT0)]) {
      house.lines.push({
        d: lineOf(
          [
            [t * L, near * houseHalf, deckZ(t) + 0.04 * D],
            [t * L, near * houseHalf, lowerTop - 0.02 * D],
          ],
          P,
        ),
        tone: "faint",
        dotted: true,
      });
      for (let index = 0; index < 4; index++) {
        const [px, py] = iso([t * L, near * houseHalf, deckZ(t) + (0.04 + index * 0.05) * D], P);
        house.dots.push({ x: px, y: py, r: 0.55, tone: "lo" });
      }
    }
    add(house, text(houseMid * L, 0, upperTop + 0.05 * D, 26));
    facts.set("superstructure", `${round1(houseW)} m deckhouse`);
  }
}
