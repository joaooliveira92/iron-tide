import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const rendererDir = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN: readonly { readonly pattern: RegExp; readonly label: string }[] = [
  { pattern: /from\s+"yaml"/u, label: 'imports the raw YAML parser ("yaml")' },
  { pattern: /from\s+"effect"/u, label: 'imports "effect"' },
  { pattern: /from\s+"@effect\//u, label: 'imports "@effect/*"' },
  {
    pattern: /from\s+"@bluewave\/content-schema"/u,
    label: 'imports "@bluewave/content-schema"',
  },
  { pattern: /from\s+"node:fs"/u, label: 'imports "node:fs"' },
  { pattern: /\?raw"/u, label: "imports a raw document" },
];

const GEOMETRY_EMITTERS: readonly string[] = [
  "components/design-workspace/panels/hull-plan/arcs.ts",
  "components/design-workspace/panels/hull-plan/path.ts",
  "components/world-map/MapMinimap.tsx",
  "components/world-map/bake-coastline.ts",
  "components/world-map/projection.ts",
  "screens/new-game/components/bounce-cards/BounceCards.tsx",
];

const RAW_FORMATTING = /\.toFixed\(|\bIntl\.|\.toLocale(?:String|DateString|TimeString)\(/u;

function rendererSources(): readonly string[] {
  return readdirSync(rendererDir, { recursive: true })
    .map(String)
    .map((file) => file.replaceAll("\\", "/"))
    .filter(
      (file) =>
        /\.(?:ts|tsx)$/u.test(file) &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".test.tsx") &&
        !/(?:^|\/)bake-[^/]+\.ts$/u.test(file),
    );
}

describe("renderer content boundary (CRI-IPC-3/5)", () => {
  it("routes number and date formatting through presentation-format", () => {
    const offenders = rendererSources()
      .filter(
        (file) => !file.startsWith("lib/presentation-format/") && !GEOMETRY_EMITTERS.includes(file),
      )
      .filter((file) => RAW_FORMATTING.test(readFileSync(join(rendererDir, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no renderer module parses YAML, reads the filesystem, or bundles the schema runtime", () => {
    const files = rendererSources();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(rendererDir, file), "utf8");
      for (const { pattern, label } of FORBIDDEN) {
        expect(source, `${file} ${label}`).not.toMatch(pattern);
      }
    }
  });
});
