import { constructionEventCause } from "../../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { formatMonthKey } from "../../construction/month-key.js";

export const CONSTRUCTION_DELAYED_BODY_KEY = "messages.construction.delayed.body";
export const CONSTRUCTION_OVERRUN_BODY_KEY = "messages.construction.overrun.body";

type Interpolation = Readonly<Record<string, string | number | boolean>>;

function causeText(reason: unknown, fallback: string): string {
  if (typeof reason !== "string") return fallback;
  if (reason === "PAYMENT_DEFAULT_DELAYED") return "a payment default";
  return constructionEventCause(reason) ?? fallback;
}

function monthText(format: PresentationFormat, value: unknown): string {
  return typeof value === "string" ? formatMonthKey(format, value) : "an unknown month";
}

export function constructionMessageBody(
  bodyKey: string,
  interpolation: Interpolation,
  format: PresentationFormat,
): string | undefined {
  if (bodyKey === CONSTRUCTION_DELAYED_BODY_KEY) {
    const months = interpolation["months"];
    const count = typeof months === "number" && months >= 1 ? months : 1;
    return `A build was delayed by ${count} month${count === 1 ? "" : "s"} from ${monthText(format, interpolation["delayMonth"])}: ${causeText(interpolation["reason"], "a delay")}.`;
  }
  if (bodyKey === CONSTRUCTION_OVERRUN_BODY_KEY) {
    const amount = interpolation["amount"];
    const cost = typeof amount === "number" ? format.money(amount) : "an unknown amount";
    return `A build's cost rose by ${cost} from ${monthText(format, interpolation["overrunMonth"])}: ${causeText(interpolation["reason"], "a cost overrun")}.`;
  }
  return undefined;
}
