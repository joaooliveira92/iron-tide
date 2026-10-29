import {} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { navalProfiles } from "./helpers/earlyContext.js";
import { readAuthoredFile } from "@bluewave/test-support";

const root = join(__dirname, "..", "..", "..", "content", "production", "1880");

const countries = readAuthoredFile(join(root, "countries.ts")) as {
  id: string;
  isPlayable?: boolean;
}[];
const nationIds = countries.map((c) => c.id);
const profiled = new Set(navalProfiles.map((p) => p.nationId));

describe("production nation coverage (release gate)", () => {
  it("loads the release scenario with its committed nation and profile floors", () => {
    expect(
      countries.length,
      "countries.json must parse to at least the 14 committed 1880 release nations",
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
        `${profile.nationId} is profiled but not in countries.ts`,
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
