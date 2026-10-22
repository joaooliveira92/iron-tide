import type { MountPart, PartCatalog, Shape } from "./catalog.js";
import { resolveMount, type FallbackStep } from "./resolve.js";
import { mountClassOfTraits } from "./traits.js";
import {
  DEFAULT_ERA,
  UNIVERSAL_STYLE,
  type NationStyle,
  type SizeBand,
  type VisualEra,
} from "./vocabulary.js";

export interface VisualTraitQuery {
  readonly style: NationStyle;
  readonly era: VisualEra;
  readonly size: SizeBand;
  readonly presentationForm: string;
  readonly enclosure?: string | undefined;
  readonly guns: number;
}

export type VisualResolutionStep = "override" | FallbackStep | "family" | "missing";

export interface VisualTraitUnmatched {
  readonly code: "VISUAL_TRAIT_UNMATCHED";
  readonly trait: "presentation_form";
  readonly value: string;
}

export interface VisualResolution {
  readonly part: MountPart;
  readonly step: VisualResolutionStep;
  readonly diagnostics: readonly VisualTraitUnmatched[];
}

const MISSING_ASSET_SHAPE: Shape = { tone: "void", d: "M -4 4 L 4 -4 M -4 -4 L 4 4" };

export const MISSING_ASSET_PART: MountPart = {
  id: "missing_asset",
  key: {
    style: UNIVERSAL_STYLE,
    era: DEFAULT_ERA,
    sizes: ["SMALL", "MEDIUM", "LARGE"],
    mountClass: "TURRET",
  },
  profile: {
    widthM: 8,
    shapes: [MISSING_ASSET_SHAPE],
    barrel: { x: 0, y: -1, lengthM: 8, boreM: 0.4 },
  },
  plan: { body: "RING", diameterM: 8, barrel: { lengthM: 8, boreM: 0.4, spacingM: 2 } },
  provenance: {
    sourceStatus: "PLACEHOLDER",
    confidence: "LOW",
    kind: "game_conversion",
    sources: [{ title: "missing-asset glyph (D16)" }],
  },
};

export function resolveVisualMount(
  catalog: PartCatalog,
  query: VisualTraitQuery,
  overrideId?: string,
): VisualResolution {
  if (overrideId !== undefined) {
    const overridden = catalog.mounts.find((p) => p.id === overrideId);
    if (overridden !== undefined) return { part: overridden, step: "override", diagnostics: [] };
  }

  const mountClass = mountClassOfTraits(query.presentationForm, query.enclosure);
  if (mountClass !== undefined) {
    const matched = resolveMount(catalog, {
      style: query.style,
      era: query.era,
      size: query.size,
      mountClass,
      guns: query.guns,
    });
    if (matched !== null) return { part: matched.part, step: matched.step, diagnostics: [] };
  }

  const diagnostics: readonly VisualTraitUnmatched[] = [
    { code: "VISUAL_TRAIT_UNMATCHED", trait: "presentation_form", value: query.presentationForm },
  ];
  const family = resolveInterfaceFamily(catalog, query.size);
  if (family !== undefined) return { part: family, step: "family", diagnostics };
  return { part: MISSING_ASSET_PART, step: "missing", diagnostics };
}

function resolveInterfaceFamily(catalog: PartCatalog, size: SizeBand): MountPart | undefined {
  return catalog.mounts.find(
    (p) =>
      p.key.style === UNIVERSAL_STYLE && p.key.era === DEFAULT_ERA && p.key.sizes.includes(size),
  );
}
