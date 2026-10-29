import { DiagnosticCollector } from "@bluewave/diagnostics";

import { decodeStrictResult } from "./decode.js";
import { UiCatalogueSchema, type UiCatalogue } from "./ui-catalogue.js";
import { parseYamlSafe } from "./yaml-parser.js";

export type UiCatalogueParse =
  | { readonly ok: true; readonly catalogue: UiCatalogue }
  | { readonly ok: false; readonly diagnostics: string };

export const isInternationalizationPath = (path: string): boolean =>
  /^content\/production\/[^/]+\/ui\/[a-z]{2}(?:-[A-Z]{2})?\.ya?ml$/u.test(
    path.replaceAll("\\", "/").replace(/^.*?(content\/production\/)/u, "$1"),
  );

export const parseUiCatalogue = (text: string, sourcePath: string): UiCatalogueParse => {
  const collector = new DiagnosticCollector();
  const parsed = parseYamlSafe(text, sourcePath, collector);
  if (!parsed.success || parsed.data === undefined) {
    return { ok: false, diagnostics: collector.toHuman() };
  }
  const decoded = decodeStrictResult(UiCatalogueSchema, parsed.data);
  if (decoded._tag === "Failure") {
    return { ok: false, diagnostics: String(decoded.failure) };
  }
  return { ok: true, catalogue: decoded.success };
};
