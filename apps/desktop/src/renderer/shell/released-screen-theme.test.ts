import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/** The renderer root (`.../src/renderer`); this test lives in its `shell/`. */
const RENDERER = join(import.meta.dirname, "..");

/**
 * Released-screen theme guard (U-4 ticket 07). Released screens and shell chrome
 * must consume the semantic theme tokens (so the high-contrast and dark themes
 * apply everywhere); a hard-coded colour literal that bypasses the tokens is a
 * regression. Decorative background/card palettes are intentionally theme-owned
 * art and are excluded, as are the debug/dev screens.
 */
const EXCLUDED_SEGMENTS = [
  "/styles/",
  "/components/backgrounds/",
  "/components/card-deck/",
  "palette",
  "background-palettes",
  "/screens/debugging/",
  "/screens/simulation/",
  "/screens/tactical-sandbox/",
  "/screens/map-prototype/",
  ".test.",
];

/** Decorative card-art literals that are deliberately theme-independent. */
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
