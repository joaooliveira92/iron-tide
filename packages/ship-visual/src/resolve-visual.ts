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

/**
 * The drawing resolution order (D16, proposal §8.2): part-specific override → trait match →
 * interface-family fallback → a visibly marked missing-asset glyph. `trait match` translates the
 * (presentation form, enclosure) pair to the drawn mount class (ADR-0148 translation map) and runs
 * the style/era fallback chain; `family` is the interface-family glyph — the universal dreadnought
 * drawing for the same size — used when no class matches. A gap is never silent: an unmatched trait
 * value emits `VISUAL_TRAIT_UNMATCHED`.
 */

/** The traits the renderer selects a drawing with. */
export interface VisualTraitQuery {
  readonly style: NationStyle;
  readonly era: VisualEra;
  readonly size: SizeBand;
  /** The effective `presentation_form` (from `@bluewave/content-schema` derive/override). */
  readonly presentationForm: string;
  /** The effective `enclosure`, when the form has one. */
  readonly enclosure?: string | undefined;
  readonly guns: number;
}

export type VisualResolutionStep = "override" | FallbackStep | "family" | "missing";

/** The one diagnostic an unmatched trait emits, so a gap surfaces instead of drawing silently. */
export interface VisualTraitUnmatched {
  readonly code: "VISUAL_TRAIT_UNMATCHED";
  readonly trait: "presentation_form";
  readonly value: string;
}

export interface VisualResolution {
  /** The drawing to place; the missing-asset glyph for the `missing` step. */
  readonly part: MountPart;
  readonly step: VisualResolutionStep;
  readonly diagnostics: readonly VisualTraitUnmatched[];
}

const MISSING_ASSET_SHAPE: Shape = { tone: "void", d: "M -4 4 L 4 -4 M -4 -4 L 4 4" };

/**
 * A visibly marked placeholder drawn when no drawing resolves: an X-cross, id `missing_asset`.
 * It is never a member of the authored catalog, so a real trait match can never select it.
 */
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

/**
 * Resolve the drawing for one mounted part. `overrideId` is the part's authored `visual.override`
 * (a catalog entry id); when it names an entry it wins. Otherwise the trait pair selects a class
 * and the style/era chain runs; a class-less or unmatched trait falls to the interface-family
 * drawing for the same size, or the missing-asset glyph. Pure and deterministic.
 */
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

/** The interface-family fallback: the universal dreadnought drawing for a size, any class. */
function resolveInterfaceFamily(catalog: PartCatalog, size: SizeBand): MountPart | undefined {
  return catalog.mounts.find(
    (p) =>
      p.key.style === UNIVERSAL_STYLE && p.key.era === DEFAULT_ERA && p.key.sizes.includes(size),
  );
}
