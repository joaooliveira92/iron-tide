import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vite-plus/test";
import { navalProfiles } from "./helpers/earlyContext.js";

/**
 * Production nation-coverage release gate (ADR-0096, ADR-0110). Every nation the 1880 pack defines —
 * playable or not — MUST have an authored national naval profile, because a nation without identity
 * still resolves a generic ship-building environment in the campaign and in battle. There is no
 * allowlist: the gate fails on any scenario nation without a profile, and on any profile for a nation
 * outside the pack.
 */
const root = join(__dirname, "..", "..", "..", "content", "production", "1880");

const countries = parse(readFileSync(join(root, "countries.yaml"), "utf8")) as {
  id: string;
  isPlayable?: boolean;
}[];
const nationIds = countries.map((c) => c.id);
const profiled = new Set(navalProfiles.map((p) => p.nationId));

describe("production nation coverage (release gate)", () => {
  /**
   * Anti-vacuity floor: the coverage checks below would pass trivially over an empty parse, so first pin the
   * size of the data they consume. The 1880 first release commits 14 nations (10 playable per ADR-0214), each with
   * an authored naval profile; a parse-to-zero or parse-to-few regression must fail loudly here rather than let
   * the coverage assertions pass over nothing. These are floors, not the exact identity list (which would be
   * brittle duplication of countries.yaml).
   */
  it("loads the release scenario with its committed nation and profile floors", () => {
    expect(
      countries.length,
      "countries.yaml must parse to at least the 14 committed 1880 release nations",
    ).toBeGreaterThanOrEqual(14);
    const playable = countries.filter((c) => c.isPlayable === true);
    expect(
      playable.length,
      "the 1880 first release commits at least 10 playable nations",
    ).toBeGreaterThanOrEqual(10);
    expect(
      navalProfiles.length,
      "every release nation must have an authored naval profile (at least 14)",
    ).toBeGreaterThanOrEqual(14);
  });

  it("every nation in the scenario has an authored naval profile", () => {
    const unauthored = nationIds.filter((id) => !profiled.has(id)).sort();
    expect(unauthored).toEqual([]);
  });

  it("no profiled nation is outside the scenario", () => {
    const known = new Set(nationIds);
    for (const profile of navalProfiles) {
      expect(
        known.has(profile.nationId),
        `${profile.nationId} is profiled but not in countries.yaml`,
      ).toBe(true);
    }
  });

  it("covers both the playable and the non-playable nations", () => {
    const playable = countries.filter((c) => c.isPlayable === true).map((c) => c.id);
    const nonPlayable = countries.filter((c) => c.isPlayable !== true).map((c) => c.id);
    expect(playable.every((id) => profiled.has(id))).toBe(true);
    expect(nonPlayable.every((id) => profiled.has(id))).toBe(true);
  });
});
