import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const RENDERER_ROOT = resolve(process.cwd(), "src/renderer");
const EXEMPT = [
  "screens/debugging/",
  "screens/simulation/",
  "screens/tactical-sandbox/",
  "screens/map-prototype/",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("type floor", () => {
  it("has no arbitrary text sizes under 12px in player-facing screens", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(RENDERER_ROOT)) {
      const rel = relative(RENDERER_ROOT, file).replaceAll("\\", "/");
      if (EXEMPT.some((prefix) => rel.startsWith(prefix))) continue;
      const hits = readFileSync(file, "utf8").match(/text-\[(?:[0-9]|1[01])(?:\.\d+)?(?:px|pt)\]/g);
      if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("actually scans files (guards against a silently empty scan)", () => {
    expect(sourceFiles(RENDERER_ROOT).length).toBeGreaterThan(50);
  });
});
