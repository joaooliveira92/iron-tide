#!/usr/bin/env node
// Version coherence gate (ADR-0134): the released desktop version and the save
// compatibility constant must be the same number. A release that bumps one and
// not the other silently breaks the reject-on-mismatch save policy (ADR-0113) or
// ships a tag that disagrees with the app's own version.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

export function readDesktopVersion(packageJson) {
  const parsed = JSON.parse(packageJson);
  if (typeof parsed.version !== "string") throw new Error("desktop package.json has no version");
  return parsed.version;
}

export function readCompatibilityVersion(source) {
  const match = /CURRENT_COMPATIBILITY_VERSION\s*=\s*"([^"]+)"/u.exec(source);
  if (!match) throw new Error("CURRENT_COMPATIBILITY_VERSION not found");
  return match[1];
}

/**
 * @param {{ desktopVersion: string, compatibilityVersion: string }} versions
 * @returns {string[]} problems (empty when coherent)
 */
export function checkCoherence({ desktopVersion, compatibilityVersion }) {
  if (desktopVersion === compatibilityVersion) return [];
  return [
    `apps/desktop version "${desktopVersion}" != CURRENT_COMPATIBILITY_VERSION ` +
      `"${compatibilityVersion}" (ADR-0134): bump them together`,
  ];
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const desktopVersion = readDesktopVersion(
      readFileSync(resolve(ROOT, "apps/desktop/package.json"), "utf8"),
    );
    const compatibilityVersion = readCompatibilityVersion(
      readFileSync(resolve(ROOT, "packages/persistence/src/compatibility.ts"), "utf8"),
    );
    const problems = checkCoherence({ desktopVersion, compatibilityVersion });
    if (problems.length > 0) {
      for (const problem of problems) console.error(`version-coherence: ${problem}`);
      process.exit(1);
    }
    console.log(`version-coherence: ok (${desktopVersion})`);
  } catch (error) {
    console.error(`version-coherence: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
