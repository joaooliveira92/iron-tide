import { describe, it, expect } from "vite-plus/test";
import { readFileSync, globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, "..", "..", "..");

const LAYER: Record<string, number> = {
  "@bluewave/contracts": 0,
  "@bluewave/diagnostics": 1,
  "@bluewave/deterministic": 1,
  "@bluewave/armament": 1,
  "@bluewave/content-schema": 2,
  "@bluewave/content-authoring": 3,
  "@bluewave/random": 2,
  "@bluewave/content-compiler": 4,
  "@bluewave/ship-design": 4,
  "@bluewave/ship-visual": 4,
  "@bluewave/content-codemod": 5,
  "@bluewave/campaign": 5,
  "@bluewave/events": 5,
  "@bluewave/test-support": 5,
  "@bluewave/commands": 6,
  "@bluewave/campaign-engine": 6,
  "@bluewave/persistence": 6,
  "@bluewave/ai": 7,
  "@bluewave/combat": 7,
  "@bluewave/messages": 7,
  "@bluewave/phase-engine": 8,
  "@bluewave/cross-process-test": 9,
  "@bluewave/compiler-cli": 10,
  "@bluewave/desktop": 10,
};

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
}

interface WorkspacePackage {
  name: string;
  path: string;
  workspaceDeps: string[];
}

const packageFiles = globSync("{packages,apps}/*/package.json", { cwd: repoRoot });

const packages: WorkspacePackage[] = packageFiles.map((rel) => {
  const json = JSON.parse(readFileSync(resolve(repoRoot, rel), "utf8")) as PackageJson;
  const deps = json.dependencies ?? {};
  return {
    name: json.name ?? rel,
    path: rel,
    workspaceDeps: Object.keys(deps).filter((name) => name.startsWith("@bluewave/")),
  };
});

const names = new Set(packages.map((pkg) => pkg.name));
const appNames = new Set(
  packages.filter((pkg) => pkg.path.startsWith("apps/")).map((pkg) => pkg.name),
);

describe("Package graph", () => {
  it("every workspace package declares a layer", () => {
    const unclassified = packages
      .filter((pkg) => LAYER[pkg.name] === undefined)
      .map((pkg) => pkg.name);
    expect(unclassified).toEqual([]);
  });

  it("contracts is the graph root (no workspace dependencies)", () => {
    const contracts = packages.find((pkg) => pkg.name === "@bluewave/contracts");
    expect(contracts?.workspaceDeps).toEqual([]);
  });

  it("dependencies only point to strictly lower layers", () => {
    const violations: string[] = [];
    for (const pkg of packages) {
      const from = LAYER[pkg.name];
      for (const dep of pkg.workspaceDeps) {
        if (!names.has(dep)) continue;
        const to = LAYER[dep];
        if (to === undefined) continue;
        if (to >= from) {
          violations.push(`${pkg.name} (layer ${from}) -> ${dep} (layer ${to})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no library package depends on an app", () => {
    const violations: string[] = [];
    for (const pkg of packages) {
      if (appNames.has(pkg.name)) continue;
      for (const dep of pkg.workspaceDeps) {
        if (appNames.has(dep)) violations.push(`${pkg.name} -> ${dep}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
