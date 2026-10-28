import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { readAsar, readAsarFile } from "./asar.ts";
import { PackageGuardInputError } from "./errors.ts";
import type { FileLocation } from "./policy.ts";

export interface PackageFile {
  readonly location: FileLocation;
  readonly path: string;
  readonly size: number;
  readonly read: () => Buffer;
}

export interface PackageSnapshot {
  readonly files: readonly PackageFile[];
  readonly archiveBytes: number;
  readonly outsideResourceBytes: number;
}

const LOCATION_ORDER: Record<FileLocation, number> = { archive: 0, unpacked: 1, outside: 2 };

export function compareFiles(
  a: { readonly location: FileLocation; readonly path: string },
  b: { readonly location: FileLocation; readonly path: string },
): number {
  const byLocation = LOCATION_ORDER[a.location] - LOCATION_ORDER[b.location];
  if (byLocation !== 0) return byLocation;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isRuntimeResource(path: string): boolean {
  const segments = path.split("/");
  if (segments.some((segment) => segment === "Frameworks" || segment.endsWith(".framework"))) {
    return false;
  }
  return segments.includes("Resources") || segments.includes("resources");
}

function findAsar(packageDir: string): string {
  const candidates: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 5) return;
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      if (name === "app.asar") candidates.push(full);
      else if (name !== "node_modules" && lstatSync(full).isDirectory()) walk(full, depth + 1);
    }
  };
  walk(packageDir, 0);
  if (candidates.length === 0) {
    throw new PackageGuardInputError("no app.asar found in the package: nothing to inspect");
  }
  if (candidates.length > 1) {
    throw new PackageGuardInputError(
      `more than one app.asar found: ${candidates.map((c) => relative(packageDir, c)).join(", ")}`,
    );
  }
  return candidates[0] as string;
}

function walkOutside(root: string, asarFile: string): PackageFile[] {
  const files: PackageFile[] = [];
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (full === asarFile) continue;
      const info = lstatSync(full);
      if (info.isDirectory()) visit(full);
      else {
        const path = relative(root, full).split(sep).join("/");
        const unpacked = path.includes("app.asar.unpacked/");
        files.push({
          location: unpacked ? "unpacked" : "outside",
          path: unpacked ? path.slice(path.indexOf("app.asar.unpacked/") + 18) : path,
          size: info.isSymbolicLink() ? 0 : info.size,
          read: () => readFileSync(full),
        });
      }
    }
  };
  visit(root);
  return files;
}

export function snapshotPackage(packageDir: string): PackageSnapshot {
  if (!existsSync(packageDir)) {
    throw new PackageGuardInputError("package directory does not exist");
  }
  if (!lstatSync(packageDir).isDirectory()) {
    throw new PackageGuardInputError("package path is not a directory");
  }
  const asarFile = findAsar(packageDir);
  const archive = readAsar(asarFile);
  const archiveFiles: PackageFile[] = archive.entries
    .filter((entry) => !entry.unpacked)
    .map((entry) => ({
      location: "archive" as const,
      path: entry.path,
      size: entry.size,
      read: () => readAsarFile(archive, entry),
    }));
  const outside = walkOutside(packageDir, asarFile);
  const files = [...archiveFiles, ...outside].sort(compareFiles);
  return {
    files,
    archiveBytes: lstatSync(asarFile).size,
    outsideResourceBytes: outside
      .filter((file) => file.location === "outside" && isRuntimeResource(file.path))
      .reduce((sum, file) => sum + file.size, 0),
  };
}
