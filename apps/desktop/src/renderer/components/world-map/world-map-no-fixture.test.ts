import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const RENDERER = resolve(import.meta.dirname, "../..");
const ENTRIES = [
  "components/world-map/WorldMapChart.tsx",
  "screens/strategic-map/StrategicMapScreen.tsx",
  "shell/MapSheet.tsx",
];

const FIXTURE_MODULE = "fixture-world";
const FIXTURE_EXPORTS = ["PASSAGES", "POSSESSIONS", "FLEETS", "NATIONS", "deriveAreaControl"];

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/from\s+"(\.[^"]+)"/g)].flatMap((match) => {
    const specifier = match[1];
    if (specifier === undefined) return [];
    const base = resolve(dirname(file), specifier.replace(/\.js$/, ""));
    return [`${base}.ts`, `${base}.tsx`].filter((candidate) => existsSync(candidate));
  });
}

function reachable(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [resolve(RENDERER, entry)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    for (const dependency of importsOf(file)) queue.push(dependency);
  }
  return [...seen];
}

describe("the production map has no fixture world", () => {
  it("no longer carries the fixture module", () => {
    expect(existsSync(resolve(RENDERER, "components/world-map/fixture-world.ts"))).toBe(false);
  });

  it("reaches no fixture module from the chart, the map screen or the F1 sheet", () => {
    const offenders = ENTRIES.flatMap((entry) =>
      reachable(entry).filter((file) => file.includes(FIXTURE_MODULE)),
    );
    expect(offenders.map((file) => relative(RENDERER, file))).toEqual([]);
  });

  it("carries no fixture-owned scenario collection in the import graph", () => {
    const modules = [...new Set(ENTRIES.flatMap((entry) => reachable(entry)))];
    const offenders = modules.filter((file) => {
      const source = readFileSync(file, "utf8");
      return FIXTURE_EXPORTS.some((name) => source.includes(`export const ${name}`));
    });
    expect(offenders.map((file) => relative(RENDERER, file))).toEqual([]);
  });

  it("keeps the geometry module presentation-only", () => {
    const file = resolve(RENDERER, "components/world-map/map-geometry.ts");
    const source = readFileSync(file, "utf8");
    for (const banned of FIXTURE_EXPORTS) {
      expect(source.includes(banned)).toBe(false);
    }
  });
});
