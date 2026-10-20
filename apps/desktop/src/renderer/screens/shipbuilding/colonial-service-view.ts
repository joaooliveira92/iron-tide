import type { WorkshopView } from "@bluewave/ship-design";
import {
  formatFittingShare,
  formatFittingTonnes,
} from "../../lib/presentation-format/colonial-service.js";

/**
 * The designer's colonial-service readout (S-5 04, spec #73 R4/R12). Pure: it reads what the compile already decided,
 * so the number shown is exactly the displacement the fitting uses. While the ruleset does not configure the
 * proportion the fitting is shown as 'not configured' and no figure is offered, never a default.
 */
export type ColonialServiceStatus = "unfitted" | "not-configured" | "configured";

export interface ColonialServiceModel {
  readonly fitted: boolean;
  readonly status: ColonialServiceStatus;
  /** One sentence the readout shows; states the status in words, not by colour. */
  readonly text: string;
}

export function colonialServiceModel(view: WorkshopView): ColonialServiceModel {
  const fitting = view.compiled.colonialService;
  if (fitting === undefined)
    return { fitted: false, status: "unfitted", text: "Not fitted for colonial service." };
  if (!fitting.configured || fitting.proportionBp === null)
    return {
      fitted: true,
      status: "not-configured",
      text: "Fitted for colonial service. Its displacement cost is not configured, so it takes no displacement.",
    };
  return {
    fitted: true,
    status: "configured",
    text: `Fitted for colonial service. It takes ${formatFittingTonnes(fitting.displacementKg)} t of displacement (${formatFittingShare(fitting.proportionBp)}% of the target).`,
  };
}
