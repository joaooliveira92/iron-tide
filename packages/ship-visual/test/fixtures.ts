import type { MastPart, MountKey, MountPart, PartCatalog, Provenance } from "../src/index.js";

export const provenance: Provenance = {
  sourceStatus: "ESTIMATE",
  confidence: "LOW",
  kind: "game_conversion",
  sources: [{ title: "Rule the Waves 3 manual", page: "139-142" }],
};

export function mount(id: string, key: MountKey): MountPart {
  return {
    id,
    key,
    profile: {
      widthM: 10,
      shapes: [{ tone: "structure", d: "M -5 0 L 5 0 L 4 -3 L -4 -3 Z" }],
      barrel: { x: -4, y: -1.5, lengthM: 12, boreM: 0.5 },
    },
    plan: { body: "ROUND", diameterM: 9, barrel: { lengthM: 12, boreM: 0.5, spacingM: 2 } },
    provenance,
  };
}

export function mast(id: string, style: MastPart["key"]["style"], era: MastPart["key"]["era"]) {
  return {
    id,
    key: { style, era },
    profile: {
      heightM: 20,
      shapes: [{ tone: "structure" as const, d: "M -0.3 0 L 0 -20 L 0.3 0 Z" }],
    },
    provenance,
  } satisfies MastPart;
}

export function catalog(
  mounts: readonly MountPart[],
  masts: readonly MastPart[] = [],
): PartCatalog {
  return { mounts, masts };
}
