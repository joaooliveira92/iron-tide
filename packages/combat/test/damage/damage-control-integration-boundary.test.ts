import { describe, it, expect } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BattleResolver, StrengthCalculator } from "@bluewave/combat/battleResolution";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("damage-control integration boundary", () => {
  it("does not modify BattleResolver", () => {
    const src = readFileSync(resolve(__dirname, "../../src/resolver.ts"), "utf-8");
    expect(src).not.toContain("resolveDamageControl");
    expect(src).not.toContain("damageControl");
  });

  it("does not modify StrengthCalculator", () => {
    const src = readFileSync(resolve(__dirname, "../../src/strength.ts"), "utf-8");
    expect(src).not.toContain("resolveDamageControl");
    expect(src).not.toContain("damageControl");
  });

  it("BattleResolver class exists and is constructable (unchanged)", () => {
    const resolver = new BattleResolver();
    expect(resolver).toBeInstanceOf(BattleResolver);
  });

  it("StrengthCalculator has expected static methods (unchanged)", () => {
    expect(typeof StrengthCalculator.totalFirepower).toBe("function");
    expect(typeof StrengthCalculator.averageArmor).toBe("function");
    expect(typeof StrengthCalculator.totalHitPoints).toBe("function");
  });

  it("only extends existing damage module (does not create new top-level packages)", () => {
    const damageDir = resolve(__dirname, "../../src/damage");
    const files = readdirSync(damageDir).filter((f) => f.endsWith(".ts"));
    expect(files).toContain("damageControlConstants.ts");
    expect(files).toContain("damageControl.ts");
    expect(files).toContain("damageControlEngineWiring.ts");
    expect(files).toContain("fireConstants.ts");
    expect(files).toContain("fireResolution.ts");
    expect(files).toContain("floodingConstants.ts");
    expect(files).toContain("floodingResolution.ts");
  });

  it("no phase-engine dependency in damage-control files", () => {
    const damageDir = resolve(__dirname, "../../src/damage");
    const files = readdirSync(damageDir).filter((f) => f.endsWith(".ts"));
    const dcFiles = files.filter(
      (f) => f.includes("damageControl") || f.includes("fire") || f.includes("flooding"),
    );
    for (const file of dcFiles) {
      const content = readFileSync(resolve(damageDir, file), "utf-8");
      expect(content).not.toContain("phase-engine");
      expect(content).not.toContain("phaseEngine");
    }
  });

  it("no snapshot schema changed by damage-control extension", () => {
    const damageDir = resolve(__dirname, "../../src/damage");
    const files = readdirSync(damageDir).filter((f) => f.endsWith(".ts"));
    const dcFiles = files.filter(
      (f) => f.includes("damageControl") || f.includes("fire") || f.includes("flooding"),
    );
    const forbiddenSchemaImports = [
      "@bluewave/persistence",
      "@bluewave/campaign-engine",
      "CampaignSnapshot",
    ];
    for (const file of dcFiles) {
      const content = readFileSync(resolve(damageDir, file), "utf-8");
      for (const forbidden of forbiddenSchemaImports) {
        if (content.includes(`from "${forbidden}"`) || content.includes(`from '${forbidden}'`)) {
          throw new Error(`${file} imports from schema module "${forbidden}"`);
        }
      }
    }
  });
});
