import { withConstructionCause } from "../../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { formatMonthKey } from "../../construction/month-key.js";

export const CONSTRUCTION_DELAYED_BODY_KEY = "messages.construction.delayed.body";
export const CONSTRUCTION_OVERRUN_BODY_KEY = "messages.construction.overrun.body";

type Interpolation = Readonly<Record<string, string | number | boolean>>;

function monthsText(value: string | number | boolean | undefined): string {
  const months = typeof value === "number" && value >= 1 ? value : 1;
  return `${months} month${months === 1 ? "" : "s"}`;
}

function monthText(format: PresentationFormat, value: string | number | boolean | undefined) {
  return typeof value === "string" ? formatMonthKey(format, value) : "an unknown month";
}

export function constructionMessageInterpolation(
  bodyKey: string,
  interpolation: Interpolation,
  format: PresentationFormat,
): Interpolation {
  if (bodyKey === CONSTRUCTION_DELAYED_BODY_KEY) {
    return {
      ...withConstructionCause(interpolation),
      months: monthsText(interpolation["months"]),
      delayMonth: monthText(format, interpolation["delayMonth"]),
    };
  }
  if (bodyKey === CONSTRUCTION_OVERRUN_BODY_KEY) {
    const amount = interpolation["amount"];
    return {
      ...withConstructionCause(interpolation),
      amount: typeof amount === "number" ? format.money(amount) : "an unknown amount",
      overrunMonth: monthText(format, interpolation["overrunMonth"]),
    };
  }
  return interpolation;
}
