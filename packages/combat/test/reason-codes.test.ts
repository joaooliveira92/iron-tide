import { describe, it, expect } from "vite-plus/test";
import { readFileSync, globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TACTICAL_REASON_CODES } from "../src/tactical/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";

// DESIGN-38 §36 subset relevant to B-2 (movement/spotting/contact). These four
// codes pre-exist in the combat catalog; B-2 ships exactly this subset and
// introduces no new codes (a new code would require a versioned-ruleset ADR).
const B2_SUBSET = [
  "TACTICAL_STATE_INVARIANT_FAILED",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "INVALID_TACTICAL_CLOCK",
  "INVALID_TACTICAL_TIME_CONTRACT",
] as const;

// DESIGN-38 §36 authoritative reason codes.
const DESIGN38_S36 = [
  "INVALID_TACTICAL_TIME_CONTRACT",
  "INVALID_TACTICAL_CLOCK",
  "TACTICAL_COMMAND_AFTER_CUTOFF",
  "INVALID_TACTICAL_COMMAND_TRANSITION",
  "TACTICAL_COMMAND_AUTHORITY_DENIED",
  "TACTICAL_COMMAND_OUT_OF_REACH",
  "TACTICAL_COMMAND_TRANSMISSION_FAILED",
  "TACTICAL_REALISM_COMMAND_PROHIBITED",
  "TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "BATTLE_TURN_AWAY_TECHNOLOGY_UNAVAILABLE",
  "BATTLE_TURN_AWAY_INELIGIBLE",
  "BATTLE_TURN_AWAY_CONFUSION",
  "BATTLE_TURN_AWAY_ABORTED",
  "BATTLE_WITHDRAWAL_INCOMPLETE",
  "BATTLE_EXIT_ZONE_INELIGIBLE",
  "AUTO_RESOLUTION_UNAVAILABLE",
  "AUTO_RESOLUTION_VALIDATION_FAILED",
  "TACTICAL_STATE_INVARIANT_FAILED",
] as const;

// DESIGN-26 §28 division reason codes (B-1): the tactical-division catalog is
// disjoint from DESIGN-38 §36; locked here so any additive change forces review.
const DESIGN26_S28 = [
  "DIVISION_SIZE_LIMIT_EXCEEDED",
  "DIVISION_SHIP_TYPE_INCOMPATIBLE",
  "CA_BC_DIVISION_MIX_INELIGIBLE",
  "DIVISION_LOCATION_CONFLICT",
  "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
  "DIVISION_FLAGSHIP_INVALID",
  "DIVISION_COMMANDER_INVALID",
  "DIVISION_ROLE_INELIGIBLE",
  "DIVISION_FORMATION_INELIGIBLE",
  "DD_SCOUT_DISPLACEMENT_INELIGIBLE",
  "DIVISION_TRAINING_INELIGIBLE",
  "TRAINING_DIVISION_BATTLE_INELIGIBLE",
  "TACTICAL_PROJECTION_ADJUSTED",
  "TACTICAL_PROJECTION_IRREPARABLE",
  "DIVISION_STATE_INVARIANT_FAILED",
] as const;

describe("AC-14 reason-code surface (exact DESIGN-38 §36 subset + existing catalog)", () => {
  it("ships every B-2 subset code in the existing combat catalog", () => {
    const top = Object.values(REASON_CODES);
    for (const code of B2_SUBSET) {
      expect(top).toContain(code);
    }
  });

  it("the top-level combat catalog is a subset of DESIGN-38 §36 (no code invented by B-2)", () => {
    for (const code of Object.values(REASON_CODES)) {
      expect(DESIGN38_S36).toContain(code);
    }
  });

  it("the tactical-division catalog is the exact locked DESIGN-26 §28 set (B-1, unchanged)", () => {
    expect(Object.values(TACTICAL_REASON_CODES).sort()).toEqual([...DESIGN26_S28].sort());
  });

  it("B-2's subset is present and DID NOT grow the catalog", () => {
    const all = new Set([...Object.values(TACTICAL_REASON_CODES), ...Object.values(REASON_CODES)]);
    for (const code of B2_SUBSET) {
      expect(all.has(code)).toBe(true);
    }
    // every code, across both catalogs, is a known DESIGN-38 §36 or DESIGN-26 §28 code.
    const known: string[] = [...DESIGN38_S36, ...DESIGN26_S28];
    for (const code of all) {
      expect(known).toContain(code);
    }
  });

  it("B-2 modules throw no reason code outside the §36 subset (inline-literal scan)", () => {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const srcDir = resolve(thisDir, "..", "src");
    const files = ["contact", "movement", "spotting", "simulation"].flatMap((d) =>
      globSync(`${d}/**/*.ts`, { cwd: srcDir }),
    );
    const literals: string[] = [];
    for (const rel of files) {
      const content = readFileSync(resolve(srcDir, rel), "utf8");
      for (const g of content.matchAll(/BluewaveError\(["']([A-Z][A-Z0-9_]+)["']/g)) {
        literals.push(g[1] as string);
      }
    }
    const known: string[] = [...DESIGN38_S36, ...DESIGN26_S28];
    for (const literal of new Set(literals)) {
      expect(known).toContain(literal);
    }
  });
});
