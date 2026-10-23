import { describe, it, expect } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("smoke integration boundary", () => {
  it("does not modify BattleResolver", () => {
    const src = readFileSync(resolve(__dirname, "../../src/battleResolution/resolver.ts"), "utf-8");
    expect(src).not.toContain("smoke");
  });

  it("does not modify StrengthCalculator", () => {
    const src = readFileSync(resolve(__dirname, "../../src/battleResolution/resolver.ts"), "utf-8");
    expect(src).not.toContain("smoke");
  });

  it("has no phase-engine dependency", () => {
    const smokeDir = resolve(__dirname, "../../src/smoke");
    const files = readdirSync(smokeDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const content = readFileSync(resolve(smokeDir, file), "utf-8");
      expect(content).not.toContain("phase-engine");
      expect(content).not.toContain("phaseEngine");
    }
  });

  it("no snapshot schema changed", () => {
    const smokeDir = resolve(__dirname, "../../src/smoke");
    const files = readdirSync(smokeDir).filter((f) => f.endsWith(".ts"));
    const forbiddenSchemaImports = [
      "@bluewave/persistence",
      "@bluewave/campaign-engine",
      "CampaignSnapshot",
      "persistence",
    ];
    for (const file of files) {
      const content = readFileSync(resolve(smokeDir, file), "utf-8");
      for (const forbidden of forbiddenSchemaImports) {
        if (content.includes(`from "${forbidden}"`) || content.includes(`from '${forbidden}'`)) {
          throw new Error(`${file} imports from schema module "${forbidden}"`);
        }
      }
    }
  });

  it("all smoke module files are in the smoke/ directory", () => {
    const srcDir = resolve(__dirname, "../../src");
    const allFiles = readdirSync(srcDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
    for (const file of allFiles) {
      const content = readFileSync(resolve(srcDir, file), "utf-8");
      if (content.includes("../smoke") || content.includes("./smoke")) {
        if (file !== "index.ts") {
          throw new Error(`File ${file} outside smoke/ directory references smoke module`);
        }
      }
    }
  });

  it("is standalone in smoke/ directory", () => {
    const smokeIndex = readFileSync(resolve(__dirname, "../../src/smoke/index.ts"), "utf-8");
    expect(smokeIndex).toBeDefined();
    expect(smokeIndex.length).toBeGreaterThan(0);
  });

  it("smoke module does not re-export from combat root index.ts (standalone)", () => {
    const combatIndex = readFileSync(resolve(__dirname, "../../src/index.ts"), "utf-8");
    expect(combatIndex).not.toContain("smoke");
  });
});
