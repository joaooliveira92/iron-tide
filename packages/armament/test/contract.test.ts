import { describe, it, expect } from "vite-plus/test";
import { readFileSync, globSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(thisDir, "..", "src");
const sourceFiles = globSync("**/*.ts", { cwd: srcDir });

const NATION_LITERALS = [
  "uk",
  "germany",
  "usa",
  "japan",
  "france",
  "italy",
  "russia",
  "austria_hungary",
  "qing",
];

describe("@bluewave/armament contract", () => {
  it("has no nation-id conditional in shared resolver logic", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(resolve(srcDir, file), "utf8");
      const lines = content.split("\n");
      for (const [i, line] of lines.entries()) {
        if (/nationId\s*(===|!==|==|!=)/.test(line))
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        for (const nation of NATION_LITERALS) {
          const re = new RegExp(`[=!]==?\\s*["']${nation}["']`);
          if (re.test(line)) violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("imports no React, Electron, filesystem or Node ambient module", () => {
    const forbidden = ["react", "electron", "node:fs", "node:path", "node:os", "node:process"];
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(resolve(srcDir, file), "utf8");
      for (const line of content.match(/^import .* from\s+["'].*["']/gm) ?? []) {
        for (const mod of forbidden) {
          if (line.includes(`"${mod}"`) || line.includes(`'${mod}'`)) {
            violations.push(`${file}: ${line.trim()}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
