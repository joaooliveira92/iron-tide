import type { UiCatalogueDto } from "../../shared/content-contract.js";
import { DIPLOMACY_PEACE_MESSAGES } from "../lib/diplomacy-peace-messages.js";
import { ECONOMY_MODIFIER_MESSAGES } from "../lib/economy-modifier-messages.js";
import { EN_US_MESSAGES } from "../lib/en-us-messages.js";

const AUTHORED_MESSAGES: Readonly<Record<string, string | undefined>> = {
  ...EN_US_MESSAGES,
  ...DIPLOMACY_PEACE_MESSAGES,
  ...ECONOMY_MODIFIER_MESSAGES,
};

export const CATALOGUE_FALLBACK_LOCALE = "en-US" as const;

export const GENERIC_FALLBACK_KEY = "messages.generic.body";

const GENERIC_FALLBACK_TEXT = "Something happened this month.";

let injected: UiCatalogueDto | null = null;

function defaultMissingKeyWarner(key: string): void {
  if (import.meta.env?.DEV) {
    console.warn(`[messages] missing UI catalogue key: ${key}`);
  }
}

let missingKeyWarned: (key: string) => void = defaultMissingKeyWarner;

export function setUiCatalogue(dto: UiCatalogueDto): void {
  injected = dto;
}

export function hasUiCatalogue(): boolean {
  return injected !== null;
}

export function catalogueLocale(): string {
  return injected?.locale ?? CATALOGUE_FALLBACK_LOCALE;
}

export function setMissingKeyWarner(warn?: (key: string) => void): void {
  missingKeyWarned = warn ?? defaultMissingKeyWarner;
}

export function interpolate(
  template: string,
  interpolation: Readonly<Record<string, string | number | boolean>>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const value = interpolation[name];
    return value === undefined ? match : String(value);
  });
}

export function resolveMessage(
  key: string,
  interpolation: Readonly<Record<string, string | number | boolean>> = {},
): string {
  const template = injected?.strings[key] ?? AUTHORED_MESSAGES[key];
  if (template === undefined) {
    missingKeyWarned(key);
    const fallback = injected?.strings[GENERIC_FALLBACK_KEY];
    return interpolate(fallback ?? GENERIC_FALLBACK_TEXT, interpolation);
  }
  return interpolate(template, interpolation);
}

export function constructionEventCause(reasonCode: string): string | undefined {
  const key = `construction.event.${reasonCode.toLowerCase()}`;
  return hasMessageKey(key) ? resolveMessage(key) : undefined;
}

export function withConstructionCause(
  interpolation: Readonly<Record<string, string | number | boolean>>,
): Readonly<Record<string, string | number | boolean>> {
  const reason = interpolation["reason"];
  if (typeof reason !== "string") return interpolation;
  const cause = constructionEventCause(reason);
  return cause === undefined ? interpolation : { ...interpolation, reason: cause };
}

export function hasMessageKey(key: string): boolean {
  return injected?.strings[key] !== undefined;
}

export function hasAuthoredMessage(key: string): boolean {
  return injected?.strings[key] !== undefined || AUTHORED_MESSAGES[key] !== undefined;
}
