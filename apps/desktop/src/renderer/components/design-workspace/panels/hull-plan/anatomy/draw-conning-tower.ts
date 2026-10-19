import { cylinder, lineOf } from "./iso.js";
import { clamp, solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Armoured conning tower, the citadel's forward eye. */
export function drawConning(scene: AnatomyShipScene): void {
  const { L, B, D, hasHouse, houseT0, houseW, upperTop, P, facts, add, text, regionOf } = scene;
  const conning = regionOf("CONNING_TOWER");
  if (conning && hasHouse) {
    const x = houseT0 * L + houseW * 0.2;
    const baseZ = upperTop + 0.022 * D;
    const heightM = clamp(conning.heightMm / 1000, 0.08 * D, 0.2 * D);
    const radius = clamp(0.012 * L, 0.7, B * 0.09);
    const part: PartDraft = {
      id: "armour:conning",
      label: "Conning tower",
      solids: [
        solid(cylinder(x, 0, radius, baseZ, heightM, P, 20), "hi", { crease: "lo" }),
        solid(cylinder(x, 0, radius * 0.72, baseZ + heightM, 0.016 * D, P, 16), "mid"),
      ],
      inks: [],
      lines: [],
      dots: [],
    };
    part.lines.push({
      d: lineOf(
        [
          [x - radius * 0.5, 0, baseZ + heightM * 0.62],
          [x + radius * 0.5, 0, baseZ + heightM * 0.62],
        ],
        P,
      ),
      tone: "ink",
      heavy: true,
    });
    add(part, text(x, 0, baseZ + heightM * 0.5, 14));
    facts.set("armour:conning", `Conning tower ${Math.round(conning.thicknessUm / 1000)} mm`);
  }
}
