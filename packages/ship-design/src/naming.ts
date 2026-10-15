// packages/ship-design/src/naming.ts
// DESIGN-23 section 4 / SB3-R13: the deterministic, pool-driven ship-name allocator. A class-order batch gets its names
// from the ordering nation's authored name pool (the `NamingPolicy.stems` of the design's type, in authored order). The
// allocator reads no clock, locale, environment or ambient randomness: the same pool, count and already-taken set
// always produce the same names, in the same order, on every platform.
//
// Rule (normative for this module):
//   1. Each ship is named from the pool stems in authored order, skipping any base stem already taken (existing ships,
//      class names, earlier ships of the same batch). The recorded `ordinal` is the stem's 1-based position in the pool.
//   2. When every base stem is taken, the allocator falls back to numbered variants of the earliest pool stem
//      (`<stem> <n>`, `n` from 2 upward) and marks the result `exhausted`.
//   3. When the pool has no stems for the type (the profile is silent, a content gap), the allocator names the ships
//      from the `placeholderStem` (the design's class name) with the same numbered-variant rule, records the clearly
//      marked `PLACEHOLDER_NAME_POOL_ID` as the source and marks the result `exhausted`.
//   4. `exhausted` is true exactly when the pool could not supply `count` distinct fresh base names, so at least one
//      numbered variant or placeholder name was used.
// Every allocation records its source pool id and pool ordinal, so a name can be traced back to authored content.

/** The pool id recorded for a name that came from a missing/silent name pool (a flagged content gap). */
export const PLACEHOLDER_NAME_POOL_ID = "name_pool:placeholder" as const;

/** The authored name pool a batch draws from: a stable id plus its stems in authored order. */
export interface ShipNamePool {
  /** Stable source id, e.g. `name_pool:uk:B`. Recorded on every allocation drawn from this pool. */
  readonly poolId: string;
  /** Authored stems, in order. Empty means the profile is silent for the type. */
  readonly stems: readonly string[];
}

/** One assigned ship name. */
export interface ShipNameAllocation {
  readonly name: string;
  /** Stable id of the pool the name came from (or `PLACEHOLDER_NAME_POOL_ID`). */
  readonly pool: string;
  /** 1-based position of the chosen stem within the pool; `0` for a placeholder name. */
  readonly ordinal: number;
}

export interface ShipNameAllocationResult {
  readonly allocations: readonly ShipNameAllocation[];
  /** True when the pool could not supply `count` distinct fresh base names (variants or placeholders were used). */
  readonly exhausted: boolean;
}

export interface AllocateShipNamesInput {
  readonly pool: ShipNamePool;
  /** Requested number of ships (`>= 0`; the batch path bounds it to `1..12`). */
  readonly count: number;
  /** Names already taken: existing ships, class names and any earlier allocation. */
  readonly taken: readonly string[];
  /** Deterministic stem for a silent pool, typically the design's class name. */
  readonly placeholderStem: string;
}

/**
 * The first free numbered variant of the earliest pool stem. The numbered-variant space is unbounded while `used` is
 * finite, so the earliest stem always has one; `null` only for an empty pool.
 */
function firstFreeVariant(
  stems: readonly string[],
  used: ReadonlySet<string>,
): { readonly name: string; readonly ordinal: number } | null {
  const stem = stems[0];
  if (stem === undefined) return null;
  let n = 2;
  while (used.has(`${stem} ${n}`)) n += 1;
  return { name: `${stem} ${n}`, ordinal: 1 };
}

/** A unique placeholder name from `placeholderStem`, numbered from 1, never colliding with `used`. */
function placeholderName(placeholderStem: string, used: ReadonlySet<string>): string {
  let n = 1;
  let name = placeholderStem;
  while (used.has(name)) {
    n += 1;
    name = `${placeholderStem} ${n}`;
  }
  return name;
}

/**
 * Allocate `count` deterministic ship names (SB3-R13). Pure: no ambient randomness, clock or locale. See the module
 * doc comment for the ordering, collision and exhaustion rules.
 */
export function allocateShipNames(input: AllocateShipNamesInput): ShipNameAllocationResult {
  const { pool, count, taken, placeholderStem } = input;
  const used = new Set<string>(taken);
  const allocations: ShipNameAllocation[] = [];
  let exhausted = false;
  for (let ship = 0; ship < count; ship++) {
    if (pool.stems.length === 0) {
      const name = placeholderName(placeholderStem, used);
      used.add(name);
      allocations.push({ name, pool: PLACEHOLDER_NAME_POOL_ID, ordinal: 0 });
      exhausted = true;
      continue;
    }
    let baseIndex = -1;
    for (let i = 0; i < pool.stems.length; i++) {
      if (!used.has(pool.stems[i]!)) {
        baseIndex = i;
        break;
      }
    }
    if (baseIndex >= 0) {
      const name = pool.stems[baseIndex]!;
      used.add(name);
      allocations.push({ name, pool: pool.poolId, ordinal: baseIndex + 1 });
      continue;
    }
    const variant = firstFreeVariant(pool.stems, used);
    // `firstFreeVariant` cannot be null: the numbered-variant space is unbounded while `used` is finite.
    if (variant === null) continue;
    used.add(variant.name);
    allocations.push({ name: variant.name, pool: pool.poolId, ordinal: variant.ordinal });
    exhausted = true;
  }
  return { allocations, exhausted };
}
