import { cylinder, iso, lineOf, pathOf } from "./iso.js";
import { clamp, solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Masts: the ship type sets how many, the era sets the rig (yards, fighting top or tripod). */
export function drawMasts(scene: AnatomyShipScene): void {
  const {
    L,
    B,
    D,
    deckZ,
    profile,
    era,
    hasHouse,
    houseT0,
    houseT1,
    lowerTop,
    upperTop,
    mastRise,
    P,
    add,
    text,
  } = scene;
  if (hasHouse) {
    const span = houseT1 - houseT0;
    const stations =
      profile.masts === 1 ? [houseT0 + span * 0.3] : [houseT0 + span * 0.22, houseT1 - span * 0.08];
    stations.forEach((t, index) => {
      const baseZ = index === 0 ? upperTop : lowerTop;
      const topZ = baseZ + mastRise;
      const x = t * L;
      const radius = clamp(0.0013 * L, 0.12, 0.24);
      const part: PartDraft = {
        id: index === 0 ? "mast:fore" : "mast:main",
        label: index === 0 ? "Foremast" : "Mainmast",
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      const tripod = era === "DREADNOUGHT" || era === "LATE_DREADNOUGHT";
      part.solids.push(
        solid(
          cylinder(
            x,
            0,
            tripod ? radius * 1.6 : radius,
            baseZ - 0.04 * D,
            mastRise + 0.04 * D,
            P,
            12,
          ),
          "mid",
          { crease: "none" },
        ),
      );
      if (tripod) {
        // Legs rake aft and out to the deck, bracing the tall tower mast.
        for (const side of [-1, 1]) {
          part.lines.push({
            d: lineOf(
              [
                [x, 0, baseZ + mastRise * 0.72],
                [x + 0.018 * L, side * B * 0.1, baseZ],
              ],
              P,
            ),
            tone: "mid",
            heavy: true,
          });
        }
      }
      const nestZ = baseZ + mastRise * (tripod ? 0.72 : 0.58);
      const nestR = radius * (era === "PRE_DREADNOUGHT" ? 4.6 : tripod ? 4 : 3.2);
      part.solids.push(
        solid(cylinder(x, 0, nestR, nestZ, 0.025 * D, P, 16), "mid", { crease: "faint" }),
      );
      if (tripod) {
        // Fire-control top above the platform.
        part.solids.push(
          solid(cylinder(x, 0, nestR * 0.6, nestZ + 0.05 * D, 0.04 * D, P, 12), "hi", {
            crease: "lo",
          }),
        );
      }
      part.lines.push({
        d: pathOf([iso([x, 0, topZ], P), iso([x, 0, topZ + 0.06 * D], P)]),
        tone: "hi",
      });
      const yards: readonly (readonly [number, number])[] =
        era === "VICTORIAN"
          ? [
              [0.45, 0.47],
              [0.72, 0.34],
              [0.88, 0.22],
            ]
          : era === "PRE_DREADNOUGHT"
            ? [[0.8, 0.3]]
            : [[0.86, 0.16]];
      for (const [share, yardSpan] of yards) {
        const z = baseZ + mastRise * share;
        part.lines.push({
          d: lineOf(
            [
              [x, -B * yardSpan, z],
              [x, B * yardSpan, z],
            ],
            P,
          ),
          tone: "mid",
          heavy: true,
        });
        for (const side of [-1, 1]) {
          const [px, py] = iso([x, side * B * yardSpan, z], P);
          part.dots.push({ x: px, y: py, r: 0.75, tone: "mid" });
        }
      }
      // Standing rigging: full stays in the sailing era, a single light stay once steam took over.
      const stays = era === "VICTORIAN" ? [0.02, 0.98] : index === 0 ? [0.02] : [0.98];
      for (const end of stays) {
        part.lines.push({
          d: lineOf(
            [
              [x, 0, topZ],
              [end * L, 0, deckZ(end) + 0.02 * D],
            ],
            P,
          ),
          tone: "faint",
        });
      }
      add(part, text(x, 0, baseZ + mastRise * 0.5, 10));
    });
  }
}
