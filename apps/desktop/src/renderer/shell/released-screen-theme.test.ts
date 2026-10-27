import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const RENDERER = join(import.meta.dirname, "..");

const EXCLUDED_SEGMENTS = [
  "/styles/",
  "/components/backgrounds/",
  "/components/card-deck/",
  "palette",
  "background-palettes",
  "/screens/debugging/",
  "/screens/simulation/",
  "/screens/tactical-sandbox/",
  ".test.",
];

const ALLOWLIST = new Set([
  "screens/new-game/components/bounce-cards/newGameBounceCardsPreset.ts",
  "screens/new-game/components/bounce-cards/BounceCards.tsx",
]);

const SCAN_ROOTS = ["screens", "shell"];
const HEX = /#[0-9a-fA-F]{6}\b/u;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/u.test(name)) out.push(full);
  }
  return out;
}

describe("released screens honour the theme tokens (U-4 ticket 07)", () => {
  it("introduces no new hard-coded colour outside the decorative allowlist", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(RENDERER, root))) {
        const relToRenderer = relative(RENDERER, file).replaceAll("\\", "/");
        if (EXCLUDED_SEGMENTS.some((segment) => `/${relToRenderer}`.includes(segment))) continue;
        if (ALLOWLIST.has(relToRenderer)) continue;
        if (HEX.test(readFileSync(file, "utf8"))) offenders.push(relToRenderer);
      }
    }
    expect(offenders).toEqual([]);
  });
});
