import type { MastPart, MountPart, PartCatalog } from "./catalog.js";
import {
  DEFAULT_ERA,
  UNIVERSAL_STYLE,
  type MountClass,
  type NationStyle,
  type SizeBand,
  type VisualEra,
} from "./vocabulary.js";

export interface MountQuery {
  readonly style: NationStyle;
  readonly era: VisualEra;
  readonly size: SizeBand;
  readonly mountClass: MountClass;
  readonly guns: number;
}

export type FallbackStep = 1 | 2 | 3 | 4;

export interface Resolution<P> {
  readonly part: P;
  readonly step: FallbackStep;
}

function chain(style: NationStyle, era: VisualEra): readonly (readonly [NationStyle, VisualEra])[] {
  return [
    [style, era],
    [UNIVERSAL_STYLE, era],
    [style, DEFAULT_ERA],
    [UNIVERSAL_STYLE, DEFAULT_ERA],
  ];
}

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

export function resolveMast(
  catalog: PartCatalog,
  style: NationStyle,
  era: VisualEra,
): Resolution<MastPart> | null {
  return firstInChain(style, era, (s, e) =>
    catalog.masts.find((p) => p.key.style === s && p.key.era === e),
  );
}
