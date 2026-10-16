import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/**
 * The domain presentation-leak guard (U-3 map D6, ADR-0218: "no authoritative
 * package owns presentation text"). The precedent is
 * `packages/campaign-engine/test/priorities.test.ts`.
 *
 * Two levels:
 *  - **locale-formatting is banned outright.** `toLocaleString`/`Intl` is
 *    locale-dependent, so a domain string built with it can differ across
 *    OSes/locales; the domain now renders deterministic integer text through
 *    `ship-design/src/numberText.ts`.
 *  - **the deterministic residue is ratcheted.** `toFixed` and the surrounding
 *    string templates are the owner-reviewed structured-explanation migration;
 *    the exact inventory is frozen so it cannot grow.
 */
const REPO = join(import.meta.dirname, "..", "..", "..");
const SCAN_DIRS = ["packages/ship-design/src", "packages/phase-engine/src"];

/** Frozen inventory of `file::kind` deterministic-formatting sites (the debt). */
const BASELINE = new Set([
  "packages/ship-design/src/hull.ts::toFixed",
  "packages/ship-design/src/machinery.ts::toFixed",
  "packages/ship-design/src/rebuild.ts::toFixed",
  "packages/ship-design/src/refit.ts::toFixed",
  "packages/ship-design/src/report.ts::toFixed",
  "packages/ship-design/src/suggest.ts::toFixed",
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

function scan(re: RegExp): Set<string> {
  const found = new Set<string>();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(REPO, dir))) {
      if (re.test(readFileSync(file, "utf8"))) found.add(relative(REPO, file));
    }
  }
  return found;
}

describe("domain presentation-leak guard (U-3 ticket 06)", () => {
  it("uses no locale-dependent formatting in an authoritative package", () => {
    expect([...scan(/\.toLocaleString\s*\(|\bIntl\./u)].sort()).toEqual([]);
  });

  it("introduces no new deterministic `toFixed` site", () => {
    const files = [...scan(/\.toFixed\s*\(/u)].map((file) => `${file}::toFixed`);
    expect(files.filter((entry) => !BASELINE.has(entry)).sort()).toEqual([]);
  });

  it("deterministic integer grouping matches the former locale output", async () => {
    const { groupedInteger } = await import("../src/numberText.js");
    expect(groupedInteger(1_234_567)).toBe("1,234,567");
    expect(groupedInteger(-1_200)).toBe("-1,200");
  });
});
