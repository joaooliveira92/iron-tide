import { resolveMessage } from "../../content/uiCatalogue.js";

/**
 * Resolve a battle-offer string through the compiled UI catalogue (ADR-0209, ADR-0218) with `{placeholder}`
 * interpolation. A key the catalogue does not carry renders the generic fallback and a development warning, never a raw key.
 */
export function offerText(
  key: string,
  params: Readonly<Record<string, string | number | boolean>> = {},
): string {
  return resolveMessage(key, params);
}
