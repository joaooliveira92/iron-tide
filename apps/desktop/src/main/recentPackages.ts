import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";
import type { RecentCampaignEntry } from "../shared/continuity-contract.js";
import { atomicWrite } from "./runtime/atomicWrite.js";

export const RECENT_PACKAGES_FILENAME = "recent-packages.json";
export const MAX_RECENT_PACKAGES = 10;

const StoredEntrySchema = Schema.Struct({
  path: Schema.String,
  campaignIdentity: Schema.String,
  activeRevision: Schema.Number,
  lastOpened: Schema.Number,
});
const RecentPackagesSchema = Schema.Struct({
  version: Schema.Literal(1),
  entries: Schema.Array(StoredEntrySchema),
});

type StoredEntry = typeof StoredEntrySchema.Type;

export function canonicalPackagePath(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

export function isPackageDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readStored(userDataDir: string): readonly StoredEntry[] {
  const file = join(userDataDir, RECENT_PACKAGES_FILENAME);
  if (!existsSync(file)) return [];
  try {
    const decoded = Schema.decodeUnknownResult(RecentPackagesSchema, { onExcessProperty: "error" })(
      JSON.parse(readFileSync(file, "utf8")),
    );
    return Result.isFailure(decoded) ? [] : decoded.success.entries;
  } catch {
    return [];
  }
}

function writeStored(userDataDir: string, entries: readonly StoredEntry[]): void {
  atomicWrite(
    join(userDataDir, RECENT_PACKAGES_FILENAME),
    JSON.stringify({ version: 1, entries: entries.slice(0, MAX_RECENT_PACKAGES) }),
  );
}

export function listRecentPackages(userDataDir: string): readonly RecentCampaignEntry[] {
  return [...readStored(userDataDir)]
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .map((entry) => ({
      packagePath: entry.path,
      campaignIdentity: entry.campaignIdentity,
      activeRevision: entry.activeRevision,
      lastOpened: entry.lastOpened,
      available: isPackageDirectory(entry.path),
    }));
}

export function isApprovedPackage(userDataDir: string, packagePath: string): string | null {
  const canonical = canonicalPackagePath(packagePath);
  if (canonical === null) return null;
  return readStored(userDataDir).some((entry) => entry.path === canonical) ? canonical : null;
}

export function recordRecentPackage(
  userDataDir: string,
  entry: Omit<StoredEntry, "path"> & { readonly path: string },
): void {
  const canonical = canonicalPackagePath(entry.path) ?? entry.path;
  const rest = readStored(userDataDir).filter((existing) => existing.path !== canonical);
  writeStored(userDataDir, [{ ...entry, path: canonical }, ...rest]);
}

export function removeRecentPackage(userDataDir: string, packagePath: string): void {
  const canonical = canonicalPackagePath(packagePath) ?? packagePath;
  writeStored(
    userDataDir,
    readStored(userDataDir).filter(
      (entry) => entry.path !== canonical && entry.path !== packagePath,
    ),
  );
}
