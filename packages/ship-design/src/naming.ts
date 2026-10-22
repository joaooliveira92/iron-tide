export const PLACEHOLDER_NAME_POOL_ID = "name_pool:placeholder" as const;

export interface ShipNamePool {
  readonly poolId: string;
  readonly stems: readonly string[];
}

export interface ShipNameAllocation {
  readonly name: string;
  readonly pool: string;
  readonly ordinal: number;
}

export interface ShipNameAllocationResult {
  readonly allocations: readonly ShipNameAllocation[];
  readonly exhausted: boolean;
}

export interface AllocateShipNamesInput {
  readonly pool: ShipNamePool;
  readonly count: number;
  readonly taken: readonly string[];
  readonly placeholderStem: string;
}

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

function placeholderName(placeholderStem: string, used: ReadonlySet<string>): string {
  let n = 1;
  let name = placeholderStem;
  while (used.has(name)) {
    n += 1;
    name = `${placeholderStem} ${n}`;
  }
  return name;
}

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
    if (variant === null) continue;
    used.add(variant.name);
    allocations.push({ name: variant.name, pool: pool.poolId, ordinal: variant.ordinal });
    exhausted = true;
  }
  return { allocations, exhausted };
}
