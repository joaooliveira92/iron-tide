import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * The renderer is a presentational consumer of decoded content: it never parses
 * YAML, reads the filesystem, or bundles the content-schema/Effect validation
 * runtime (ADR-0105 `MIG-EXCL-1`, ticket 04 / CRI-IPC-3/5). This source scan is
 * the fast guard; the built-bundle tripwire lives in
 * `scripts/check-renderer-bundle.mjs` and runs after every renderer build.
 */
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

describe("renderer content boundary (CRI-IPC-3/5)", () => {
  it("no renderer module parses YAML, reads the filesystem, or bundles the schema runtime", () => {
    const files = readdirSync(rendererDir, { recursive: true })
      .map(String)
      .filter(
        (file) =>
          /\.(?:ts|tsx)$/u.test(file) &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".test.tsx") &&
          // Build-time data generators run under node, not in the app bundle.
          // Match either separator: `readdirSync(..., { recursive: true })`
          // returns backslash-joined paths on Windows.
          !/(?:^|[\\/])bake-[^\\/]+\.ts$/u.test(file),
      );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(rendererDir, file), "utf8");
      for (const { pattern, label } of FORBIDDEN) {
        expect(source, `${file} ${label}`).not.toMatch(pattern);
      }
    }
  });
});
