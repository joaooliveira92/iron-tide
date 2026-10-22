import type { UiCatalogueDto } from "../../shared/content-contract.js";
import { EN_US_MESSAGES, type MessageKey } from "../lib/en-us-messages.js";

/**
 * The single UI-string resolver (ADR-0209/ADR-0218). Main decodes the keyed
 * catalogue from the verified artifact and ships it over the narrow
 * `inspectUiCatalogue` IPC; the app injects that DTO here. Messages carry stable
 * keys + interpolation; this resolver is the only place text is produced, and it
 * throws nothing back at the player: a missing key renders a safe generic
 * fallback and (in development) warns, never a raw key. The legacy `translate`
 * alias in `lib/strings.ts` delegates to this resolver, so both share one
 * catalogue lookup and one warning sink.
 *
 * UI language (this catalogue) and formatting locale are independent: nothing
 * here formats numbers or dates, so changing the formatting locale never changes
 * the resolved text (ADR-0218).
 */

export const CATALOGUE_FALLBACK_LOCALE = "en-US" as const;

/** The key the resolver falls back to when an emitted key has no authored text. */
export const GENERIC_FALLBACK_KEY = "messages.generic.body";

const GENERIC_FALLBACK_TEXT = "Something happened this month.";

let injected: UiCatalogueDto | null = null;

/** The one missing-key warning sink; warns in development only (ADR-0209), else no-op. */
function defaultMissingKeyWarner(key: string): void {
  if (import.meta.env?.DEV) {
    console.warn(`[messages] missing UI catalogue key: ${key}`);
  }
}

let missingKeyWarned: (key: string) => void = defaultMissingKeyWarner;

/** Inject the decoded catalogue (from IPC in the app, from the artifact in tests). */
export function setUiCatalogue(dto: UiCatalogueDto): void {
  injected = dto;
}

/** True once a catalogue has been injected. */
export function hasUiCatalogue(): boolean {
  return injected !== null;
}

/** The injected catalogue's locale, or the en-US fallback when none is injected. */
export function catalogueLocale(): string {
  return injected?.locale ?? CATALOGUE_FALLBACK_LOCALE;
}

/** Override the missing-key warning sink (used by tests to assert the warning); omit to restore the default. */
export function setMissingKeyWarner(warn?: (key: string) => void): void {
  missingKeyWarned = warn ?? defaultMissingKeyWarner;
}

/** Replace `{placeholder}` occurrences with interpolation values. */
export function interpolate(
  template: string,
  interpolation: Readonly<Record<string, string | number | boolean>>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const value = interpolation[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolve a message key to text. The catalogue is the en-US fallback; an unknown
 * key warns and renders the generic fallback body rather than the raw key.
 */
export function resolveMessage(
  key: string,
  interpolation: Readonly<Record<string, string | number | boolean>> = {},
): string {
  // The compiled catalogue wins; the renderer's own en-US catalogue answers only a key the pack does not author.
  const template = injected?.strings[key] ?? EN_US_MESSAGES[key as MessageKey];
  if (template === undefined) {
    missingKeyWarned(key);
    const fallback = injected?.strings[GENERIC_FALLBACK_KEY];
    return interpolate(fallback ?? GENERIC_FALLBACK_TEXT, interpolation);
  }
  return interpolate(template, interpolation);
}

/** True when the key resolves to authored text (no fallback required). */
export function hasMessageKey(key: string): boolean {
  return injected?.strings[key] !== undefined;
}

/**
 * True when the compiled pack or the in-repo en-US fallback authors the key. A
 * caller choosing its own fallback for an unknown key (e.g. "was rejected
 * ({code})") tests this rather than comparing `resolveMessage` to a sentinel:
 * a miss now renders the generic fallback, never an empty string.
 */
export function hasAuthoredMessage(key: string): boolean {
  return (
    injected?.strings[key] !== undefined ||
    (EN_US_MESSAGES as Record<string, string>)[key] !== undefined
  );
}
