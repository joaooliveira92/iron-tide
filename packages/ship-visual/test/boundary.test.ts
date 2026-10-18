import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/**
 * The presentation boundary (ADR-0148, SV-R12): ship visuals are drawn from the compiled design and never feed back.
 * Only the desktop app depends on this package, the desktop main process never imports it, and no content pack
 * declares the catalog, so it cannot reach an artifact, a campaign snapshot or a golden hash.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SELF = "@bluewave/ship-visual";

function files(dir: string, match: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, match);
    return match(path) ? [path] : [];
  });
}

const manifest = (path: string): Record<string, Record<string, string> | undefined> =>
  JSON.parse(readFileSync(path, "utf8"));

describe("ship-visual presentation boundary", () => {
  it("only the desktop app depends on the package", () => {
    const dependents = [
      ...readdirSync(join(ROOT, "packages")).map((d) => join(ROOT, "packages", d, "package.json")),
      ...readdirSync(join(ROOT, "apps")).map((d) => join(ROOT, "apps", d, "package.json")),
    ]
      .filter((path) => {
        try {
          return statSync(path).isFile();
        } catch {
          return false;
        }
      })
      .filter((path) => {
        const pkg = manifest(path);
        return ["dependencies", "devDependencies", "peerDependencies"].some(
          (field) => pkg[field]?.[SELF] !== undefined,
        );
      })
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"));
    expect(dependents).toEqual(["apps/desktop/package.json"]);
  });

  it("the desktop main process never imports it", () => {
    const offenders = files(join(ROOT, "apps/desktop/src/main"), (p) => /\.tsx?$/.test(p))
      .filter((path) => readFileSync(path, "utf8").includes(SELF))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"));
    expect(offenders).toEqual([]);
  });

  it("no content pack declares the catalog", () => {
    const offenders = files(join(ROOT, "content"), (p) => p.endsWith("pack.json"))
      .filter((path) => readFileSync(path, "utf8").includes("ship-visual"))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"));
    expect(offenders).toEqual([]);
  });
});
