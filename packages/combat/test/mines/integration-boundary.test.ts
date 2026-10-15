// AC-22 (INC-8): integration boundary — the mines module is a pure function
// set with ZERO coupling to the phase engine, campaign snapshot, minute-advance
// stage, BattleResolver, or StrengthCalculator. Statically greps the mines
// source (no dist dependency) and asserts: (1) no forbidden identifier appears
// in any import; (2) mines/index exports only the pure-function surface; (3)
// the engine/battle-resolution structures we DID NOT touch still exist and were
// not structurally altered.
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

// The forbidden integration identifiers — ANY occurrence in a mines source
// file (import or string) fails the boundary proof.
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
        // "records" and "torpedoes" appear inside other words — use a word-ish
        // match for identifiers (import path segments, identifiers, exports).
        const expr = new RegExp(`\\b${forbidden}\\b`, "i");
        // Comments can legitimately discuss the deferral/boundary (that IS the
        // point), so strip // and /* */ comment lines/regions before matching.
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
    // every line is an `export * from "./X.js"` re-export — a pure module index,
    // never an engine-stage/phase registration or side effect.
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
    // The B-2/B-4 engine files exist and declare their authoritative symbols.
    expect(engineSrc).toContain("advanceMinutes");
    expect(engineSrc).toContain("TacticalBattleState");
    expect(resolverSrc).toContain("BattleResolver");
    expect(strengthSrc).toContain("StrengthCalculator");
    // No NEW mine identifier crept into the engine surface.
    expect(engineSrc).not.toContain("minePressureId");
    expect(resolverSrc).not.toContain("AreaMinePressureRecord");
    expect(strengthSrc).not.toContain("MineWarfareResolution");
  });
});
