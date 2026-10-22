import { join, resolve } from "node:path";

function packagedResourcesDir(): string | undefined {
  const proc = process as NodeJS.Process & { defaultApp?: boolean; resourcesPath?: string };
  if (proc.defaultApp === true) return undefined;
  return typeof proc.resourcesPath === "string" ? proc.resourcesPath : undefined;
}

function resolveContentDir(...segments: readonly string[]): string {
  const resources = packagedResourcesDir();
  if (resources !== undefined) return join(resources, "content", ...segments);
  return resolve(import.meta.dirname, "../../../..", "content", ...segments);
}

export function resolveGeneratedContentDir(): string {
  return resolveContentDir("generated", "1880");
}
