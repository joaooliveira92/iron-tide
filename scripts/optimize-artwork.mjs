#!/usr/bin/env node
/**
 * Regenerate the downscaled AVIF card artwork used by the new-game pickers
 * (the Starting-fleet method deck and the preset picker), from the full-size
 * JPGs in `apps/desktop/src/renderer/assets/player-preferences/`.
 *
 * The cards render at 188 px, so the derivatives are sized to twice that on
 * their short side (the CSS `object-fit: cover` crops the centre for the square
 * card). The originals are never modified; the committed derivatives are what
 * ships, and this tool is a convenience for refreshing them when the sources
 * change.
 *
 * macOS-only: it shells out to `sips`, the only AVIF writer available without
 * adding an image dependency to the repo. Run `node scripts/optimize-artwork.mjs`.
 */
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dir = resolve(root, "apps/desktop/src/renderer/assets/player-preferences");

// The card box is 188 px (see NEW_GAME_BOUNCE_CARDS_PROPS.cardSize).
const DISPLAY_PX = 188;
const CARDS = ["dockyard", "blueprint", "cannons"];

if (process.platform !== "darwin") {
  console.error(
    "optimize-artwork: requires macOS `sips` (the only AVIF writer available). " +
      "Committed derivatives are unchanged; nothing to do.",
  );
  process.exit(1);
}

/** Read an image's pixel dimensions via `sips -g`. @returns {{w:number,h:number}} */
function dimensions(file) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
    encoding: "utf8",
  });
  const w = Number(/pixelWidth:\s*(\d+)/u.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/u.exec(out)?.[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`optimize-artwork: could not read dimensions of ${file}`);
  }
  return { w, h };
}

for (const name of CARDS) {
  const src = resolve(dir, `${name}.jpg`);
  const out = resolve(dir, `${name}-card.avif`);
  const { w, h } = dimensions(src);
  // Resize so the short side lands at 2× the display box; `-Z` bounds the long side.
  const targetLong = Math.round((2 * DISPLAY_PX * Math.max(w, h)) / Math.min(w, h));
  execFileSync("sips", ["-s", "format", "avif", "-Z", String(targetLong), src, "--out", out], {
    stdio: "inherit",
  });
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`optimize-artwork: wrote ${name}-card.avif (long side ${targetLong}px, ${kb} KB)`);
}
