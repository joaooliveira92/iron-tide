import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseUiCatalogue } from "@bluewave/content-schema";
import type { UiCatalogueDto } from "./content-contract.js";

const CATALOGUE_PATH = resolve(
  process.cwd(),
  "../..",
  "content",
  "production",
  "1880",
  "ui",
  "en-US.yaml",
);

export function authoredCatalogue(
  overrides: Readonly<Record<string, string>> = {},
): UiCatalogueDto {
  const parsed = parseUiCatalogue(readFileSync(CATALOGUE_PATH, "utf8"), CATALOGUE_PATH);
  const authored = parsed.ok ? (parsed.catalogue as { strings: Record<string, string> }) : null;
  return { locale: "en-US", strings: { ...authored?.strings, ...overrides } };
}
