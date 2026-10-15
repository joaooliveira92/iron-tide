// DESIGN-39 §28 + AC-7: exact per-type ammunition accounting and ATOMIC reserve +
// consume for a salvo. Reservations never partially consume: a salvo is committed
// in full from a single permitted ammunition type, or fails entirely with
// GUNNERY_AMMUNITION_UNAVAILABLE. Pure/deterministic: no I/O, clock, or random.
import { BluewaveError } from "@bluewave/contracts";
import { AMMUNITION_TYPES, type AmmunitionType } from "./constants.js";
import { GUNNERY_AMMUNITION_UNAVAILABLE } from "./reasonCodes.js";

export interface AmmunitionAccount {
  type: AmmunitionType;
  count: number; // rounds reserved + consumed
  before: number; // count in the type before the salvo
  after: number; // count in the type after the salvo (never negative)
}

export interface AmmunitionReserve {
  ammunition: Record<AmmunitionType, number>; // the FULL new ammunition record
  account: AmmunitionAccount;
}

// AC-7: reserve and consume `count` rounds atomically from the battery's exact
// per-type ammunition record. `preferredType` is tried first; failing that, the
// other `permittedTypes` are tried in declaration order. The FULL count must be
// available from a single permitted type — never split across types, never
// partially consumed. When no permitted type holds enough, throws
// GUNNERY_AMMUNITION_UNAVAILABLE. Returns the immutable new ammunition record +
// the account for the committed type, WITHOUT mutating the caller's record.
export function reserveAndConsumeAmmunition(
  ammunition: Record<AmmunitionType, number>,
  count: number,
  preferredType: AmmunitionType,
  permittedTypes: readonly AmmunitionType[] = AMMUNITION_TYPES,
): AmmunitionReserve {
  if (!Number.isInteger(count) || count <= 0) {
    throw new BluewaveError(GUNNERY_AMMUNITION_UNAVAILABLE, {
      code: GUNNERY_AMMUNITION_UNAVAILABLE,
      reason: "salvo ammunition count must be a positive integer",
      count,
    });
  }

  // preferred first, then the other permitted types in declaration order.
  const ordered: AmmunitionType[] = [
    preferredType,
    ...permittedTypes.filter((t) => t !== preferredType),
  ];

  let committed: AmmunitionAccount | null = null;
  for (const type of ordered) {
    const before = ammunition[type];
    if (!Number.isInteger(before) || (before as number) < 0) {
      // never trust a malformed authoritative count; abort before any commit.
      throw new BluewaveError(GUNNERY_AMMUNITION_UNAVAILABLE, {
        code: GUNNERY_AMMUNITION_UNAVAILABLE,
        type,
        reason: "invalid ammunition count in battery record",
        count: before,
      });
    }
    if (before >= count) {
      committed = { type, count, before, after: before - count };
      break;
    }
  }
  if (!committed) {
    throw new BluewaveError(GUNNERY_AMMUNITION_UNAVAILABLE, {
      code: GUNNERY_AMMUNITION_UNAVAILABLE,
      reason: "no permitted ammunition type holds enough rounds for the salvo",
      count,
      preferredType,
      permittedTypes: [...permittedTypes],
      available: { ...ammunition },
    });
  }

  const next: Record<AmmunitionType, number> = { ...ammunition };
  next[committed.type] = committed.after;
  return { ammunition: next, account: committed };
}
