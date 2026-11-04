import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { MANIFEST_FILE } from "./snap-manifest.ts";

export const FIXED_ARTIFACTS = [
  "screenshot.png",
  "aria.txt",
  "text.txt",
  "console.log",
  MANIFEST_FILE,
] as const;

const SHOT_FILE = /^[A-Za-z0-9_-]+\.png$/;

function previousArtifacts(raw: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || !("artifacts" in parsed)) return [];
  const { artifacts } = parsed;
  if (!Array.isArray(artifacts)) return [];
  return artifacts.filter(
    (name): name is string =>
      typeof name === "string" &&
      (SHOT_FILE.test(name) || (FIXED_ARTIFACTS as readonly string[]).includes(name)),
  );
}

export async function clearStaleArtifacts(
  outDir: string,
  shotNames: readonly string[],
): Promise<readonly string[]> {
  const previous = await readFile(join(outDir, MANIFEST_FILE), "utf8").then(
    previousArtifacts,
    () => [],
  );
  const owned = [
    ...new Set([...FIXED_ARTIFACTS, ...previous, ...shotNames.map((name) => `${name}.png`)]),
  ];
  await Promise.all(owned.map((name) => rm(join(outDir, name), { force: true })));
  return owned;
}
