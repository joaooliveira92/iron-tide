import type { MastPart, MountPart, PartCatalog } from "./catalog.js";
import {
  DEFAULT_ERA,
  UNIVERSAL_STYLE,
  type MountClass,
  type NationStyle,
  type SizeBand,
  type VisualEra,
} from "./vocabulary.js";

/** A fully specified mount to draw. */
export interface MountQuery {
  readonly style: NationStyle;
  readonly era: VisualEra;
  readonly size: SizeBand;
  readonly mountClass: MountClass;
  readonly guns: number;
}

/** Which fallback step matched: 1 exact, 2 universal style, 3 own style in the default era, 4 universal default. */
export type FallbackStep = 1 | 2 | 3 | 4;

export interface Resolution<P> {
  readonly part: P;
  readonly step: FallbackStep;
}

/** The (style, era) pairs tried in order (ADR-0148 §4). Duplicates are harmless: an earlier step already missed. */
function chain(style: NationStyle, era: VisualEra): readonly (readonly [NationStyle, VisualEra])[] {
  return [
    [style, era],
    [UNIVERSAL_STYLE, era],
    [style, DEFAULT_ERA],
    [UNIVERSAL_STYLE, DEFAULT_ERA],
  ];
}

/** The first fallback step at which `pick` finds a part, with that step. */
function firstInChain<P>(
  style: NationStyle,
  era: VisualEra,
  pick: (style: NationStyle, era: VisualEra) => P | undefined,
): Resolution<P> | null {
  const steps = chain(style, era);
  for (let i = 0; i < steps.length; i++) {
    const part = pick(...steps[i]!);
    if (part !== undefined) return { part, step: (i + 1) as FallbackStep };
  }
  return null;
}

/**
 * The drawing for a mount: the first fallback step with a match on size and class, where an entry for the exact gun
 * count beats a count-agnostic one. An entry serves every size band it lists; size and class never fall back. Null only when the catalog has no drawing at all
 * for this size and class (the catalog test forbids that for the universal default).
 */
export function resolveMount(
  catalog: PartCatalog,
  query: MountQuery,
): Resolution<MountPart> | null {
  return firstInChain(query.style, query.era, (style, era) => {
    const candidates = catalog.mounts.filter(
      (p) =>
        p.key.style === style &&
        p.key.era === era &&
        p.key.sizes.includes(query.size) &&
        p.key.mountClass === query.mountClass,
    );
    return (
      candidates.find((p) => p.key.guns === query.guns) ??
      candidates.find((p) => p.key.guns === undefined)
    );
  });
}

/** The drawing for a mast, by the same style/era chain. */
export function resolveMast(
  catalog: PartCatalog,
  style: NationStyle,
  era: VisualEra,
): Resolution<MastPart> | null {
  return firstInChain(style, era, (s, e) =>
    catalog.masts.find((p) => p.key.style === s && p.key.era === e),
  );
}
