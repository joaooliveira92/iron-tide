import { join, resolve } from "node:path";

/**
 * In a packaged Electron app the compiled content artifact ships as an
 * application resource and is resolved from `process.resourcesPath`
 * (electron-builder `extraResources`, see `electron-builder.yml`) — never by
 * walking up to the repository root, which cannot exist inside an installed /
 * asar build. `process.defaultApp` is set to `true` when Electron is launched
 * with an app path (`electron .`, `electron-vite dev`) and unset in a packaged
 * build; under plain node (tests, `build-content.mjs`) `process.resourcesPath`
 * is undefined. Both non-packaged cases resolve relative to the repo root.
 */
function packagedResourcesDir(): string | undefined {
  const proc = process as NodeJS.Process & { defaultApp?: boolean; resourcesPath?: string };
  if (proc.defaultApp === true) return undefined;
  return typeof proc.resourcesPath === "string" ? proc.resourcesPath : undefined;
}

/** Resolves the packaged resource directory for a repo-relative content path. */
function resolveContentDir(...segments: readonly string[]): string {
  const resources = packagedResourcesDir();
  if (resources !== undefined) return join(resources, "content", ...segments);
  return resolve(import.meta.dirname, "../../../..", "content", ...segments);
}

/**
 * Resolves the generated content artifact directory (`content/generated/1880`).
 * The artifact is produced by `content:build` (ADR-0122) and consumed read-only
 * by the main process (ticket 03). It is the only runtime content boundary: the
 * campaign compiler and the ship-building/reference-design loaders all read it,
 * so no raw production tree ships as a resource (tickets 05/07). In a packaged
 * build it is resolved from `process.resourcesPath`, not the repository root.
 */
export function resolveGeneratedContentDir(): string {
  return resolveContentDir("generated", "1880");
}
