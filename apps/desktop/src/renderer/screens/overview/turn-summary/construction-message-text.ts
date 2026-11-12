import { resolveMessage } from "../../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import {
  amountWords,
  causeWords,
  durationText,
  monthWords,
} from "../../construction/cause-text.js";

export const CONSTRUCTION_DELAYED_BODY_KEY = "messages.construction.delayed.body";
export const CONSTRUCTION_OVERRUN_BODY_KEY = "messages.construction.overrun.body";

type Interpolation = Readonly<Record<string, string | number | boolean>>;

export function constructionMessageBody(
  bodyKey: string,
  interpolation: Interpolation,
  format: PresentationFormat,
): string | undefined {
  if (bodyKey === CONSTRUCTION_DELAYED_BODY_KEY) {
    const months = interpolation["months"];
    const count = typeof months === "number" && months >= 1 ? months : 1;
    return resolveMessage(bodyKey, {
      duration: durationText(count),
      delayMonth: monthWords(format, interpolation["delayMonth"]),
      reason: causeWords(interpolation["reason"], "delay"),
    });
  }
  if (bodyKey === CONSTRUCTION_OVERRUN_BODY_KEY) {
    return resolveMessage(bodyKey, {
      amount: amountWords(format, interpolation["amount"]),
      overrunMonth: monthWords(format, interpolation["overrunMonth"]),
      reason: causeWords(interpolation["reason"], "overrun"),
    });
  }
  return undefined;
}
