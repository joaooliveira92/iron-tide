import type { UiCatalogueDto } from "../../shared/content-contract.js";
import { EN_US_MESSAGES, type MessageKey } from "../lib/en-us-messages.js";

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
  const template = injected?.strings[key] ?? EN_US_MESSAGES[key as MessageKey];
  if (template === undefined) {
    missingKeyWarned(key);
    const fallback = injected?.strings[GENERIC_FALLBACK_KEY];
    return interpolate(fallback ?? GENERIC_FALLBACK_TEXT, interpolation);
  }
  return interpolate(template, interpolation);
}

export function hasMessageKey(key: string): boolean {
  return injected?.strings[key] !== undefined;
}

export function hasAuthoredMessage(key: string): boolean {
  return (
    injected?.strings[key] !== undefined ||
    (EN_US_MESSAGES as Record<string, string>)[key] !== undefined
  );
}
