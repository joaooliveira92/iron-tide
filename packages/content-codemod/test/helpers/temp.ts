import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A fresh temp directory for one test; callers remove it in `afterEach`. */
export function makeTempRoot(label = "bw-codemod"): string {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

/** Every regular file under `dir`, content-relative, codepoint-sorted. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(absolute, rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, "");
  return out.sort();
}

/** A deterministic hash of a whole directory's files (path + bytes), for tamper checks. */
export function hashDir(dir: string): string {
  const hash = createHash("sha256");
  for (const file of listFiles(dir)) {
    hash.update(file);
    hash.update("\u0000");
    hash.update(readFileSync(join(dir, file)));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
