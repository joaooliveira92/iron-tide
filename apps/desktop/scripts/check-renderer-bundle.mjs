#!/usr/bin/env node
/**
 * Fails a renderer build that still bundles a forbidden validation runtime.
 *
 * The renderer is presentational: it must not ship `yaml` or `effect` (ADR-0105
 * `MIG-EXCL-1`, ticket 04 / CRI-IPC-3). Source scans can miss a transitive
 * import, so this checks the actual built bundle. `YAMLParseError` is unique to
 * the `yaml` package; `effect` is detected by its `~effect/` namespace string
 * literals, which survive minification (`EffectTypeId` is a property name that
 * minifiers mangle, so it is kept only as a belt-and-braces unminified check).
 * Run after `electron-vite build` (wired into the desktop `build` scripts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rendererOut = resolve(import.meta.dirname, "../out/renderer");
// `EffectTypeId` is a property name and is mangled away by minification; the
// `~effect/` namespace strings are string literals and survive it.
const MARKERS = ["YAMLParseError", "EffectTypeId", "~effect/"];

let files;
try {
  files = readdirSync(rendererOut, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".js"));
} catch {
  process.stderr.write(
    `No built renderer bundle at ${rendererOut}. Run \`electron-vite build\` first.\n`,
  );
  process.exit(1);
}

const offenders = [];
for (const file of files) {
  const source = readFileSync(resolve(rendererOut, file), "utf8");
  for (const marker of MARKERS) {
    if (source.includes(marker)) offenders.push(`${file}: ${marker}`);
  }
}

if (offenders.length > 0) {
  process.stderr.write(
    `Renderer bundle still bundles a forbidden runtime (ADR-0105 MIG-EXCL-1):\n${offenders.join(
      "\n",
    )}\n`,
  );
  process.exit(1);
}
process.stdout.write(`renderer bundle clean: no yaml/effect across ${files.length} chunk(s)\n`);
