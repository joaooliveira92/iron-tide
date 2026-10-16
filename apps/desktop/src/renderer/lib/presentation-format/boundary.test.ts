import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const DIR = import.meta.dirname;

function sourceFiles(): readonly string[] {
  return readdirSync(DIR).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
}

/**
 * The presentation boundary proof (U-3 map D2/D6, ADR-0218): the single conversion
 * module imports no `effect` and no authoritative engine package — only the
 * runtime-free canonical contracts and the effect-free preferences contract. This
 * is what keeps formatting from altering authoritative state.
 */
describe("presentation boundary (U-3 ticket 07)", () => {
  it("imports only the canonical contracts, never effect or an engine package", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(join(DIR, file), "utf8");
      for (const match of text.matchAll(/from\s+"([^"]+)"/gu)) {
        const specifier = match[1] ?? "";
        const isEffect =
          specifier === "effect" ||
          specifier.startsWith("effect/") ||
          specifier.startsWith("@effect/");
        const isEngine = specifier.startsWith("@bluewave/") && specifier !== "@bluewave/contracts";
        if (isEffect || isEngine) offenders.push(`${file}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("covers every module in the directory", () => {
    expect(sourceFiles().length).toBeGreaterThanOrEqual(8);
  });
});
