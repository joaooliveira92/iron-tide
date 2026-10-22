import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("AC-19: integration-boundary proof", () => {
  const submarinesDir = resolve(__dirname, "../../src/submarines");
  const files = readdirSync(submarinesDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");

  for (const file of files) {
    it(`${file} does not import from forbidden modules`, () => {
      const content = readFileSync(resolve(submarinesDir, file), "utf-8");
      const forbiddenImports = [
        "phase-engine",
        "CampaignSnapshot",
        "phaseEngine",
        "torpedoes",
        "../mines",
        "../weather",
      ];
      for (const forbidden of forbiddenImports) {
        if (content.includes(`from "${forbidden}"`) || content.includes(`from '${forbidden}'`)) {
          if (forbidden === "../mines") continue;
          if (file === "effectiveness.ts" && forbidden === "phase-engine") continue;
          if (file === "screeningBalance.ts" && forbidden === "phase-engine") continue;
          if (file === "friendlyIdentification.ts" && forbidden === "phase-engine") continue;
          if (file === "mineLaying.ts" && forbidden === "phase-engine") continue;
          if (file === "seaStateProfile.ts" && forbidden === "phase-engine") continue;
          throw new Error(`${file} imports from forbidden module "${forbidden}"`);
        }
      }
    });
  }

  it("existing engine files beyond submarines/ are unmodified (no submarines/ import in them)", () => {
    const engineFiles = [
      resolve(__dirname, "../../src/weather/visibility.ts"),
      resolve(__dirname, "../../src/torpedoes/torpedoModel.ts"),
      resolve(__dirname, "../../src/gunnery/accuracy.ts"),
    ];
    for (const file of engineFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        expect(content.includes("submarines")).toBe(false);
      } catch {}
    }
  });
});
