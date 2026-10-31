import {
  overlaysOf,
  type ShipOverlay,
} from "../../components/design-workspace/panels/hull-plan/ship-view.js";
import type { DesignSectionId } from "./design-sections.js";

const EXTRA_LAYERS: { readonly [S in DesignSectionId]: readonly ShipOverlay[] } = {
  overview: [],
  hull: ["mass"],
  machinery: ["machinery", "compartments"],
  protection: ["armour"],
  armament: [],
  systems: [],
  review: [],
};

export function layersFor(section: DesignSectionId | null): Set<ShipOverlay> {
  const layers = overlaysOf("top");
  if (section !== null) for (const layer of EXTRA_LAYERS[section]) layers.add(layer);
  return layers;
}

export function focusesArcs(section: DesignSectionId | null): boolean {
  return section === "armament";
}
