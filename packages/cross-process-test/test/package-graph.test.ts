import { describe, it, expect } from "vite-plus/test";
import { readFileSync, globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, "..", "..", "..");

// ADR-0001 dependency direction. A package may only depend on packages in a
// strictly lower layer, so the graph is acyclic by construction. Add a new
// package here (and to ADR-0001) when one is introduced.
const LAYER: Record<string, number> = {
  "@bluewave/contracts": 0,
  "@bluewave/diagnostics": 1,
  "@bluewave/deterministic": 1,
  "@bluewave/armament": 1,
  "@bluewave/content-schema": 2,
  "@bluewave/random": 2,
  "@bluewave/content-compiler": 3,
  "@bluewave/ship-design": 3,
  "@bluewave/ship-visual": 3,
  "@bluewave/content-codemod": 4,
  "@bluewave/campaign": 4,
  "@bluewave/test-support": 4,
  "@bluewave/commands": 5,
  "@bluewave/campaign-engine": 5,
  "@bluewave/events": 5,
  "@bluewave/persistence": 5,
  "@bluewave/ai": 6,
  "@bluewave/combat": 6,
  "@bluewave/messages": 6,
  "@bluewave/phase-engine": 7,
  "@bluewave/cross-process-test": 8,
  "@bluewave/compiler-cli": 9,
  "@bluewave/desktop": 9,
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
