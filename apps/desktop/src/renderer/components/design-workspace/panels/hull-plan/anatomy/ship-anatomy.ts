import { round1 } from "./anatomy-helpers.js";
import { createAnatomyShipScene } from "./anatomy-scene.js";
import type { AnatomyInput, AnatomyPart, AnatomyShip, PartKind } from "./anatomy-types.js";
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
  PartKind,
  AnatomySolid,
} from "./anatomy-types.js";

export function buildAnatomyShip(input: AnatomyInput): AnatomyShip {
  const scene = createAnatomyShipScene(input);
  const kinds = new Map<string, PartKind>();
  const stage = (kind: PartKind, draw: (target: typeof scene) => void) => {
    const before = scene.parts.length;
    draw(scene);
    for (const part of scene.parts.slice(before)) kinds.set(part.id, kind);
  };
  stage("slipway", drawSlipway);
  stage("hull", drawHull);
  stage("deck", drawDeck);
  stage("mast", drawMasts);
  stage("armour", drawArmour);
  stage("superstructure", drawSuperstructure);
  stage("funnel", drawFunnels);
  stage("boat", drawBoats);
  stage("weapon", drawWeapons);
  stage("fitting", drawFittings);
  stage("conning", drawConning);

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
    parts: parts.map((part): AnatomyPart => ({ ...part, kind: kinds.get(part.id) ?? "fitting" })),
    anchors,
    facts,
  };
}
