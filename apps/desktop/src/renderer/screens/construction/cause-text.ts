import { constructionEventCause, resolveMessage } from "../../content/uiCatalogue.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { formatMonthKey } from "./month-key.js";

export type CauseKind = "delay" | "overrun";

export function durationText(months: number): string {
  const key = months === 1 ? "construction.duration.one" : "construction.duration.other";
  return resolveMessage(key, { count: months });
}

export function causeWords(reasonCode: unknown, kind: CauseKind): string {
  const authored = typeof reasonCode === "string" ? constructionEventCause(reasonCode) : undefined;
  return authored ?? resolveMessage(`construction.cause.fallback.${kind}`);
}

export function monthWords(format: PresentationFormat, value: unknown): string {
  return typeof value === "string"
    ? formatMonthKey(format, value)
    : resolveMessage("construction.unknown.month");
}

export function amountWords(format: PresentationFormat, value: unknown): string {
  return typeof value === "number"
    ? format.money(value)
    : resolveMessage("construction.unknown.amount");
}
