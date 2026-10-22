import { describe, it, expect } from "vite-plus/test";
import { readFileSync, globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, "..", "..", "..");

const FORBIDDEN_MODULES = ["os", "process", "child_process", "timers", "perf_hooks"];

const DOMAIN_PACKAGES = [
  "contracts",
  "deterministic",
  "diagnostics",
  "armament",
  "content-schema",
  "content-compiler",
  "ship-design",
  "campaign",
  "commands",
  "random",
  "events",
  "ai",
  "combat",
  "phase-engine",
];

describe("Ambient input audit", () => {
  for (const pkg of DOMAIN_PACKAGES) {
    it(`${pkg} has no forbidden ambient imports in its source`, () => {
      const pkgDir = resolve(repoRoot, "packages", pkg, "src");
      const sourceFiles = globSync("**/*.ts", { cwd: pkgDir });

      const violations: string[] = [];
      for (const file of sourceFiles) {
        const content = readFileSync(resolve(pkgDir, file), "utf8");
        const importLines = content.match(/^import .* from\s+["'].*["']/gm) ?? [];

        for (const line of importLines) {
          for (const forbidden of FORBIDDEN_MODULES) {
            if (line.includes(`"${forbidden}"`) || line.includes(`'${forbidden}'`)) {
              if (pkg === "content-compiler" || pkg === "campaign") {
                continue;
              }
              violations.push(`${file}: ${line.trim()}`);
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }
});
