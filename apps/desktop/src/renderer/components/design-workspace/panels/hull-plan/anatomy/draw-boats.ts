import { ellipse, lineOf, loft } from "./iso.js";
import type { Point3 } from "./iso.js";
import { solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Boats on the deckhouse: the ship type sets how many clinker hulls ride the cradles. */
export function drawBoats(scene: AnatomyShipScene): void {
  const { near, L, D, profile, hasHouse, houseT0, houseT1, houseHalf, lowerTop, P, add } = scene;
  if (hasHouse && profile.boats > 0) {
    const shares: readonly number[] =
      profile.boats === 4 ? [0.2, 0.4, 0.6, 0.8] : profile.boats === 2 ? [0.34, 0.68] : [0.5];
    for (const [index, share] of shares.entries()) {
      const t = houseT0 + (houseT1 - houseT0) * share;
      const boatHalf = 0.012 * L;
      const x = t * L;
      const y = near * (houseHalf + boatHalf * 1.2);
      const z = lowerTop + 0.03 * D;
      const part: PartDraft = {
        id: `boat:${index + 1}`,
        label: "Ship's boat",
        solids: [],
        inks: [],
        lines: [],
        dots: [],
      };
      part.solids.push(
        solid(
          loft(
            ellipse(x, y, 0.045 * L, boatHalf, 18).map(
              ([px, py]) => [px, py, z + 0.055 * D] as Point3,
            ),
            ellipse(x, y, 0.036 * L, boatHalf * 0.62, 18).map(([px, py]) => [px, py, z] as Point3),
            P,
          ),
          "mid",
          { crease: "lo" },
        ),
      );
      part.lines.push({
        d: lineOf(
          ellipse(x, y, 0.036 * L, boatHalf * 0.74, 14).map(
            ([px, py]) => [px, py, z + 0.047 * D] as Point3,
          ),
          P,
          true,
        ),
        tone: "faint",
      });
      for (const dx of [-0.02, 0.012]) {
        part.lines.push({
          d: lineOf(
            [
              [x + dx * L, y - boatHalf * 0.55, z + 0.048 * D],
              [x + dx * L, y + boatHalf * 0.55, z + 0.048 * D],
            ],
            P,
          ),
          tone: "lo",
        });
      }
      add(part);
    }
  }
}
