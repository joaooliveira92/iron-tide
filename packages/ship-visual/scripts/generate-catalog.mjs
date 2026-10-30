#!/usr/bin/env node
// Generate `src/catalog.generated.ts` from `content/ship-visual/parts.ts` (ADR-0148, ADR-0334).
//
// The module is decoded through `ShipVisualCatalogSchema` (strict, provenance required) when it is
// imported, so build `@bluewave/content-authoring` first:
//
//   pnpm --filter @bluewave/content-authoring build && pnpm --filter @bluewave/ship-visual catalog:generate
//
// The output is a typed constant, so the renderer never parses content or bundles Effect (ADR-0105/0125).
// `test/catalog-sync.test.ts` fails when the committed module and the source differ.

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PKG = resolve(import.meta.dirname, "..");
const SOURCE = resolve(PKG, "../../content/ship-visual/parts.ts");
const TARGET = resolve(PKG, "src/catalog.generated.ts");

const catalog = createRequire(import.meta.url)(SOURCE).default;

const header = `import type { PartCatalog } from "./catalog.js";

`;
writeFileSync(
  TARGET,
  `${header}export const PART_CATALOG: PartCatalog = ${JSON.stringify(catalog, null, 2)};\n`,
);
execFileSync("pnpm", ["exec", "vp", "fmt", "--write", TARGET], { cwd: PKG, stdio: "inherit" });
console.log(
  `catalog:generate: ${catalog.mounts.length} mount(s), ${catalog.masts.length} mast(s) -> src/catalog.generated.ts`,
);
