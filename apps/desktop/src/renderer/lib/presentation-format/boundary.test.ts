import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const DIR = import.meta.dirname;

function sourceFiles(): readonly string[] {
  return readdirSync(DIR).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
}

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
