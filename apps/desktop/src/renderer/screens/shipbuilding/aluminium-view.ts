import {
  aluminiumAvailable,
  type AluminiumBalance,
  type WorkshopView,
} from "@bluewave/ship-design";

/**
 * The Hull tab's aluminium-superstructure readout (manual p.45, ADR-0252). Pure: it reads what the compile decided.
 * The option is offered only once the ruleset makes it available for the design date, or while a design already asks for
 * it, so an 1880 design is never shown a feature its era lacks. The saving is stated as the share the ruleset configures,
 * and the fire risk is stated as what it is: noted, not yet modelled in battle.
 */
export type AluminiumStatus = "unfitted" | "fitted" | "unavailable";

export interface AluminiumModel {
  /** Whether the control is shown at all. */
  readonly offered: boolean;
  readonly fitted: boolean;
  readonly status: AluminiumStatus;
  /** One sentence the readout shows; states the status in words, not by colour. */
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
