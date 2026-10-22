import { resolveMessage } from "../../content/uiCatalogue.js";

export function offerText(
  key: string,
  params: Readonly<Record<string, string | number | boolean>> = {},
): string {
  return resolveMessage(key, params);
}
