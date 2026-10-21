import { interpolate } from "../../content/uiCatalogue.js";
import { translate } from "../../lib/strings.js";

/**
 * Resolve a battle-offer string through the renderer's en-US catalogue (ADR-0209) with `{placeholder}` interpolation. A key
 * absent from every catalogue yields an empty string and a development warning, never a raw key.
 */
export function offerText(
  key: string,
  params: Readonly<Record<string, string | number | boolean>> = {},
): string {
  return interpolate(translate(key), params);
}
