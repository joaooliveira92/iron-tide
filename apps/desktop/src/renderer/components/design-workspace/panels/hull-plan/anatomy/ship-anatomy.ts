import { round1 } from "./anatomy-helpers.js";
import { createAnatomyShipScene } from "./anatomy-scene.js";
import type { AnatomyInput, AnatomyShip } from "./anatomy-types.js";
import { drawArmour } from "./draw-armour.js";
import { drawBoats } from "./draw-boats.js";
import { drawConning } from "./draw-conning-tower.js";
import { drawDeck } from "./draw-deck.js";
import { drawFittings } from "./draw-fittings.js";
import { drawFunnels } from "./draw-funnels.js";
import { drawHull } from "./draw-hull.js";
import { drawMasts } from "./draw-masts.js";
import { drawSlipway } from "./draw-slipway.js";
import { drawSuperstructure } from "./draw-superstructure.js";
import { drawWeapons } from "./draw-weapons.js";

export type {
  AnatomyAnchor,
  AnatomyInk,
  AnatomyInput,
  AnatomyLine,
  AnatomyDot,
  AnatomyPart,
  AnatomyShip,
  AnatomySolid,
} from "./anatomy-types.js";

/**
 * Builds the isometric ship plate as plain data. The scene holds the shared geometry; each draw module appends
 * its parts in painter's order, so the call order below is the stacking order.
 */
export function buildAnatomyShip(input: AnatomyInput): AnatomyShip {
  const scene = createAnatomyShipScene(input);
  drawSlipway(scene);
  drawHull(scene);
  drawDeck(scene);
  drawMasts(scene);
  drawArmour(scene);
  drawSuperstructure(scene);
  drawFunnels(scene);
  drawBoats(scene);
  drawWeapons(scene);
  drawFittings(scene);
  drawConning(scene);

  const { draft, profile, L, B, shownB, funnels, facts, parts, anchors } = scene;
  facts.set(
    "ship",
    `${profile.name} · ${round1(L)} m · ${round1(B)} m beam · ${draft.placements.length} fittings`,
  );

  return {
    width: scene.width,
    height: scene.height,
    label: `Isometric ship anatomy of a ${profile.name.toLowerCase()}: ${round1(L)} metres long, ${round1(shownB)} metres in the beam, with ${funnels.length} funnel${funnels.length === 1 ? "" : "s"} and ${draft.placements.length} fitted part${draft.placements.length === 1 ? "" : "s"}.`,
    azimuth: scene.azimuth,
    parts,
    anchors,
    facts,
  };
}
