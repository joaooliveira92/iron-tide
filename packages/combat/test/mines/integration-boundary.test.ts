import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const thisDir = dirname(fileURLToPath(import.meta.url));
const minesSrcDir = resolve(thisDir, "..", "..", "src", "mines");

const MINES_SOURCE_FILES = [
  "constants.ts",
  "reasonCodes.ts",
  "model.ts",
  "sources.ts",
  "pressure-record.ts",
  "laying.ts",
  "pressure-increase.ts",
  "sweeping-eligibility.ts",
  "sweeping-base-values.ts",
  "dual-equipment.ts",
  "effective-sweeping.ts",
  "sweeping-aggregation.ts",
  "defensive-standoff.ts",
  "route-risk.ts",
  "mine-report.ts",
  "misidentification.ts",
  "decay.ts",
  "post-war-persistence.ts",
  "ownership-transitions.ts",
  "knowledge.ts",
  "clearance.ts",
  "ordering.ts",
  "records.ts",
  "contracts.ts",
  "index.ts",
];

const FORBIDDEN_IDENTIFIERS = [
  "phase-engine",
  "phaseEngine",
  "CampaignSnapshot",
  "advanceMinutes",
  "advanceMinute",
  "BattleResolver",
  "StrengthCalculator",
  "battleLedger",
  "torpedoes",
];

describe("AC-22: mines integration boundary (no engine/phase/snapshot/torpedo coupling)", () => {
  it("no mines source file imports or references the forbidden engine/phase identifiers", () => {
    for (const file of MINES_SOURCE_FILES) {
      const content = readFileSync(resolve(minesSrcDir, file), "utf8");
      for (const forbidden of FORBIDDEN_IDENTIFIERS) {
        const expr = new RegExp(`\\b${forbidden}\\b`, "i");
        const withoutComments = content
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split("\n")
          .filter((line) => !line.trim().startsWith("//"))
          .join("\n");
        expect(expr.test(withoutComments), `${file} must not reference ${forbidden}`).toBe(false);
      }
    }
  });

  it("mines/index.ts exports are pure functions + versioned constants only (no engine/phase exports)", () => {
    const indexContent = readFileSync(resolve(minesSrcDir, "index.ts"), "utf8");
    const lines = indexContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"));
    for (const line of lines) {
      expect(line).toMatch(/^export \* from "\.\/[a-zA-Z-]+\.js";$/);
    }
    const exportedModules = lines.filter((l) => l.includes("./"));
    expect(exportedModules.length).toBeGreaterThanOrEqual(24);
  });

  it("the pre-existing engine surface we did NOT touch still exists unchanged", () => {
    const engineSrc = readFileSync(resolve(minesSrcDir, "..", "simulation", "engine.ts"), "utf8");
    const resolverSrc = readFileSync(resolve(minesSrcDir, "..", "resolver.ts"), "utf8");
    const strengthSrc = readFileSync(resolve(minesSrcDir, "..", "strength.ts"), "utf8");
    expect(engineSrc).toContain("advanceMinutes");
    expect(engineSrc).toContain("TacticalBattleState");
    expect(resolverSrc).toContain("BattleResolver");
    expect(strengthSrc).toContain("StrengthCalculator");
    expect(engineSrc).not.toContain("minePressureId");
    expect(resolverSrc).not.toContain("AreaMinePressureRecord");
    expect(strengthSrc).not.toContain("MineWarfareResolution");
  });
});
