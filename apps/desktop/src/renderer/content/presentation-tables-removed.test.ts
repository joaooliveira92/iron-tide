import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const rendererDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REMOVED: readonly { readonly pattern: RegExp; readonly label: string }[] = [
  {
    pattern: /from\s+"[^"]*nationCoordinates\.js"/u,
    label: "imports the removed nationCoordinates table",
  },
  {
    pattern: /from\s+"[^"]*nationFlavorText\.js"/u,
    label: "imports the removed nationFlavorText table",
  },
  {
    pattern: /from\s+"[^"]*nationDossierFields\.js"/u,
    label: "imports the removed nationDossierFields table",
  },
  { pattern: /from\s+"[^"]*area-regions\.js"/u, label: "imports the removed area-regions table" },
  { pattern: /\bNATION_COORDINATES\b/u, label: "reads the removed NATION_COORDINATES table" },
  { pattern: /\bNATION_FLAVOR_TEXT\b/u, label: "reads the removed NATION_FLAVOR_TEXT table" },
  { pattern: /\bNATION_DOSSIER_FIELDS\b/u, label: "reads the removed NATION_DOSSIER_FIELDS table" },
  {
    pattern: /\bNATION_PRESENTATION_CATALOG\b/u,
    label: "reads the removed NATION_PRESENTATION_CATALOG table",
  },
  { pattern: /\bNATION_MARKER_COLOURS\b/u, label: "reads the removed NATION_MARKER_COLOURS table" },
  {
    pattern: /\bNATION_ID_TO_COUNTRY_ID\b/u,
    label: "reads the removed NATION_ID_TO_COUNTRY_ID table",
  },
  { pattern: /\bAREA_REGION\b/u, label: "reads the removed AREA_REGION table" },
  {
    pattern: /\bCAMPAIGN_AREA_TO_FIXTURE\b/u,
    label: "reads the removed CAMPAIGN_AREA_TO_FIXTURE table",
  },
  { pattern: /\bNATION_HUE\b/u, label: "reads the removed NATION_HUE table" },
  { pattern: /\bNATION_HOME_AREA\b/u, label: "reads the removed NATION_HOME_AREA table" },
];

describe("presentation tables are sourced from the artifact (CAH-PRES-5)", () => {
  it("no renderer module imports a removed presentation table", () => {
    const files = readdirSync(rendererDir, { recursive: true })
      .map(String)
      .filter(
        (file) =>
          /\.(?:ts|tsx)$/u.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
      );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(rendererDir, file), "utf8");
      for (const { pattern, label } of REMOVED) {
        expect(source, `${file} ${label}`).not.toMatch(pattern);
      }
    }
  });
});
