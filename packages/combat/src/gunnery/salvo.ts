import { BluewaveError } from "@bluewave/contracts";
import { AMMUNITION_TYPES, type AmmunitionType } from "./constants.js";
import { GUNNERY_AMMUNITION_UNAVAILABLE } from "./reasonCodes.js";

export interface AmmunitionAccount {
  type: AmmunitionType;
  count: number;
  before: number;
  after: number;
}

export interface AmmunitionReserve {
  ammunition: Record<AmmunitionType, number>;
  account: AmmunitionAccount;
}

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

  const ordered: AmmunitionType[] = [
    preferredType,
    ...permittedTypes.filter((t) => t !== preferredType),
  ];

  let committed: AmmunitionAccount | null = null;
  for (const type of ordered) {
    const before = ammunition[type];
    if (!Number.isInteger(before) || (before as number) < 0) {
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
