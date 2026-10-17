import type { CompiledContentBundle } from "@bluewave/content-schema";
import { lifecycleStatus, shiftMonth, unlockedTechIds } from "@bluewave/ship-design";

import type { ProgressionLedger } from "./progression-ledger.js";

/**
 * N-3 named unlocks (spec #47 R3): the plan's named progression points, read
 * from content and checked against the designer's month-based availability.
 * The ids only select records; the dates always come from the compiled pack.
 */
export type NamedUnlockKind = "part" | "technology";

export interface NamedUnlock {
  readonly label: string;
  readonly kind: NamedUnlockKind;
  readonly id: string;
}

export const NAMED_UNLOCKS: readonly NamedUnlock[] = [
  { label: "dry dock", kind: "technology", id: "infra_dry_dock" },
  { label: "Whitehead torpedo", kind: "part", id: "whitehead_14in_1886" },
  { label: "torpedo boat", kind: "technology", id: "torp_torpedo_boat" },
  { label: "protected cruiser", kind: "technology", id: "sd_protected_cruiser" },
  { label: "all-steel hull", kind: "technology", id: "hc_all_steel_hull" },
  { label: "QF light guns", kind: "technology", id: "gun_qf_light" },
  { label: "QF medium guns", kind: "technology", id: "gun_qf_medium" },
];

export interface NamedUnlockAvailability {
  readonly unlock: NamedUnlock;
  readonly ledgerMonth: string;
  readonly designerMonth: string;
  readonly beforeMonth: string;
  readonly availableBefore: boolean;
  readonly availableAt: boolean;
}

export class NamedUnlockError extends Error {
  readonly _tag = "NamedUnlockError" as const;
  readonly unlockId: string;

  constructor(unlockId: string, message: string) {
    super(`${unlockId}: ${message}`);
    this.name = "NamedUnlockError";
    this.unlockId = unlockId;
  }
}

function technologiesWithYear(
  bundle: CompiledContentBundle,
): readonly { readonly id: string; readonly year: number }[] {
  return bundle.technologies.flatMap((technology) =>
    technology.year === undefined ? [] : [{ id: technology.id, year: technology.year }],
  );
}

function designerMonthOf(bundle: CompiledContentBundle, unlock: NamedUnlock): string | null {
  if (unlock.kind === "technology") {
    const technology = bundle.technologies.find((entry) => entry.id === unlock.id);
    return technology?.year === undefined ? null : `${String(technology.year)}-01`;
  }
  const part = bundle.shipBuilding?.partModel?.partIndex.byId[unlock.id];
  return part === undefined ? null : part.lifecycle.availableFrom;
}

function designerAvailable(
  bundle: CompiledContentBundle,
  unlock: NamedUnlock,
  month: string,
): boolean {
  if (unlock.kind === "technology") {
    return unlockedTechIds(technologiesWithYear(bundle), month).has(unlock.id);
  }
  const part = bundle.shipBuilding?.partModel?.partIndex.byId[unlock.id];
  return part !== undefined && lifecycleStatus(part.lifecycle, month) === "AVAILABLE";
}

/** Each named unlock's ledger date beside the designer's own availability month. */
export function inspectNamedUnlocks(
  bundle: CompiledContentBundle,
  ledger: ProgressionLedger,
): readonly NamedUnlockAvailability[] {
  return NAMED_UNLOCKS.map((unlock) => {
    const event = ledger.events.find(
      (candidate) => candidate.id === unlock.id && candidate.kind === unlock.kind,
    );
    if (event === undefined) {
      throw new NamedUnlockError(
        unlock.id,
        `no ${unlock.kind} availability event in the progression ledger`,
      );
    }
    const designerMonth = designerMonthOf(bundle, unlock);
    if (designerMonth === null) {
      throw new NamedUnlockError(unlock.id, `no ${unlock.kind} record in the compiled content`);
    }
    const beforeMonth = shiftMonth(event.month, -1);
    return {
      unlock,
      ledgerMonth: event.month,
      designerMonth,
      beforeMonth,
      availableBefore: designerAvailable(bundle, unlock, beforeMonth),
      availableAt: designerAvailable(bundle, unlock, event.month),
    };
  });
}

/**
 * Fail when the ledger and the designer disagree about an unlock's month, or
 * when the unlock is not unavailable-before/available-at its declared date.
 * The diagnostic names the id and both months.
 */
export function assertNamedUnlocks(bundle: CompiledContentBundle, ledger: ProgressionLedger): void {
  for (const state of inspectNamedUnlocks(bundle, ledger)) {
    const { unlock, ledgerMonth, designerMonth, beforeMonth, availableBefore, availableAt } = state;
    if (ledgerMonth !== designerMonth) {
      throw new NamedUnlockError(
        unlock.id,
        `ledger month ${ledgerMonth} disagrees with designer month ${designerMonth}`,
      );
    }
    if (availableBefore) {
      throw new NamedUnlockError(
        unlock.id,
        `${unlock.label} is already available at ${beforeMonth}, before its declared ${ledgerMonth}`,
      );
    }
    if (!availableAt) {
      throw new NamedUnlockError(
        unlock.id,
        `${unlock.label} is not available at its declared ${ledgerMonth}`,
      );
    }
  }
}
