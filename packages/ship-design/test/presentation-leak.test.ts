import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/**
 * The domain presentation-leak ratchet (U-3 map D6, ADR-0218: "no authoritative
 * package owns presentation text"). The precedent is
 * `packages/campaign-engine/test/priorities.test.ts`, which asserts one module is
 * clean; here the sweep across ship-design/phase-engine is frozen rather than
 * exhausted, so the leak cannot grow while the remaining sites are migrated.
 *
 * Removal is a deliberate, owner-visible migration: the domain emits structured
 * explanation data and the renderer formats it. That touches authoritative
 * packages and their exact-string tests, so it is not attempted by a ratchet.
 */
const REPO = join(import.meta.dirname, "..", "..", "..");
const SCAN_DIRS = ["packages/ship-design/src", "packages/phase-engine/src"];
const PATTERNS: readonly { readonly kind: string; readonly re: RegExp }[] = [
  { kind: "toLocaleString", re: /\.toLocaleString\s*\(/u },
  { kind: "toFixed", re: /\.toFixed\s*\(/u },
  { kind: "Intl", re: /\bIntl\./u },
];

/** Frozen inventory of `file::kind` presentation-format sites (the debt). */
const BASELINE = new Set([
  "packages/ship-design/src/arrangement.ts::toLocaleString",
  "packages/ship-design/src/armour.ts::toLocaleString",
  "packages/ship-design/src/hull.ts::toLocaleString",
  "packages/ship-design/src/hull.ts::toFixed",
  "packages/ship-design/src/machinery.ts::toLocaleString",
  "packages/ship-design/src/machinery.ts::toFixed",
  "packages/ship-design/src/rebuild.ts::toFixed",
  "packages/ship-design/src/refit.ts::toLocaleString",
  "packages/ship-design/src/refit.ts::toFixed",
  "packages/ship-design/src/report.ts::toFixed",
  "packages/ship-design/src/suggest.ts::toLocaleString",
  "packages/ship-design/src/suggest.ts::toFixed",
  "packages/ship-design/src/systems.ts::toLocaleString",
  "packages/ship-design/src/workshop.ts::toLocaleString",
  "packages/ship-design/src/workshop.ts::toFixed",
  "packages/phase-engine/src/reviseProject.ts::toFixed",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/u.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function currentInventory(): Set<string> {
  const found = new Set<string>();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(REPO, dir))) {
      const rel = relative(REPO, file);
      const text = readFileSync(file, "utf8");
      for (const { kind, re } of PATTERNS) {
        if (re.test(text)) found.add(`${rel}::${kind}`);
      }
    }
  }
  return found;
}

describe("domain presentation-leak ratchet (U-3 ticket 06)", () => {
  it("introduces no new per-file formatting pattern", () => {
    const found = currentInventory();
    const introduced = [...found].filter((entry) => !BASELINE.has(entry)).sort();
    expect(introduced).toEqual([]);
  });

  it("sees the frozen debt (so a clean result means something)", () => {
    expect(currentInventory().size).toBeGreaterThan(0);
  });
});
