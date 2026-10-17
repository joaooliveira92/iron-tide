import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/**
 * The domain presentation-leak guard (U-3 map D6, ADR-0218/ADR-0221: "no
 * authoritative package owns presentation text"). The precedent is
 * `packages/campaign-engine/test/priorities.test.ts`.
 *
 * Two levels:
 *  - **locale-formatting is banned outright.** `toLocaleString`/`Intl` is
 *    locale-dependent, so a domain string built with it can differ across
 *    OSes/locales.
 *  - **deterministic formatting is banned too.** The domain emits structured
 *    explanation data (`ExplanationText`) and the presentation boundary renders
 *    it, so `toFixed` no longer appears in an authoritative package; the count
 *    may only fall.
 */
const REPO = join(import.meta.dirname, "..", "..", "..");
const SCAN_DIRS = ["packages/ship-design/src", "packages/phase-engine/src"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
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

  it("uses no deterministic `toFixed` formatting in an authoritative package", () => {
    expect([...scan(/\.toFixed\s*\(/u)].sort()).toEqual([]);
  });

  it("deterministic integer grouping matches the former locale output", async () => {
    const { groupedInteger } = await import("../src/numberText.js");
    expect(groupedInteger(1_234_567)).toBe("1,234,567");
    expect(groupedInteger(-1_200)).toBe("-1,200");
  });
});
