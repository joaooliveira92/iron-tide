import {
  aluminiumAvailable,
  type AluminiumBalance,
  type WorkshopView,
} from "@bluewave/ship-design";

export type AluminiumStatus = "unfitted" | "fitted" | "unavailable";

export interface AluminiumModel {
  readonly offered: boolean;
  readonly fitted: boolean;
  readonly status: AluminiumStatus;
  readonly text: string;
}

const FIRE_NOTE =
  "It makes the ship more susceptible to fire damage, which battle does not yet model.";

export function aluminiumModel(
  view: WorkshopView,
  balance: AluminiumBalance | undefined,
  month: string,
): AluminiumModel {
  const available = aluminiumAvailable(balance, month);
  const result = view.compiled.aluminium;
  if (result === undefined)
    return {
      offered: available,
      fitted: false,
      status: "unfitted",
      text: available
        ? `Saves ${Math.round((balance?.hullWeightSavingBp ?? 0) / 100)}% of the hull weight. ${FIRE_NOTE}`
        : "Not available at this date.",
    };
  if (!result.available)
    return {
      offered: true,
      fitted: true,
      status: "unavailable",
      text: "Requested, but not available at this date: the hull is built in steel.",
    };
  return {
    offered: true,
    fitted: true,
    status: "fitted",
    text: `Saves ${Math.round(result.savingBp / 100)}% of the hull weight. ${FIRE_NOTE}`,
  };
}
