import { describe, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("AC-10: integration-boundary proof", () => {
  const coastalDir = resolve(__dirname, "../../src/coastal-defense");
  const files = readdirSync(coastalDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");

  const forbiddenImports = [
    "phase-engine",
    "CampaignSnapshot",
    "phaseEngine",
    "campaign",
    "persistence",
    "campaign-engine",
    "BattleResolver",
    "StrengthCalculator",
  ];

  for (const file of files) {
    it(`${file} does not import from forbidden modules`, () => {
      const content = readFileSync(resolve(coastalDir, file), "utf-8");
      for (const forbidden of forbiddenImports) {
        if (
          content.includes(`from "@bluewave/${forbidden}"`) ||
          content.includes(`from '${forbidden}'`)
        ) {
          throw new Error(`${file} imports from forbidden module "${forbidden}"`);
        }
      }
    });
  }

  it("coastal-defense module is pure (no I/O, clock, random)", () => {
    for (const file of files) {
      const content = readFileSync(resolve(coastalDir, file), "utf-8");
      const ambientSources = ["Date.now(", "Math.random(", "process.env", "performance.now("];
      for (const src of ambientSources) {
        if (content.includes(src)) {
          throw new Error(`${file} uses ambient source "${src}"`);
        }
      }
    }
  });
});
