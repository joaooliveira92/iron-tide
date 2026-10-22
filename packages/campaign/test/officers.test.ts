import { describe, expect, it } from "vite-plus/test";
import { buildOfficerRoster, OFFICER_RANKS } from "../src/officers.js";

describe("buildOfficerRoster (N-1 ticket 07)", () => {
  it("is deterministic and non-empty for every nation", () => {
    for (const nationId of ["uk", "france", "germany", "russia", "japan", "qing", "portugal"]) {
      const a = buildOfficerRoster(nationId);
      const b = buildOfficerRoster(nationId);
      expect(a.length).toBeGreaterThan(0);
      expect(a).toEqual(b);
      for (const officer of a) {
        expect(officer.id.startsWith(`off_${nationId}_`)).toBe(true);
        expect(OFFICER_RANKS).toContain(officer.rank);
        expect(officer.skill as number).toBeGreaterThanOrEqual(30);
        expect(officer.skill as number).toBeLessThanOrEqual(90);
      }
    }
  });

  it("is nation-appropriate: the roster shapes are not a single uniform template", () => {
    const shape = (nationId: string) => {
      const roster = buildOfficerRoster(nationId);
      const counts: Record<string, number> = {};
      for (const officer of roster) counts[officer.rank] = (counts[officer.rank] ?? 0) + 1;
      return `${roster.length}:${counts["CAPTAIN"] ?? 0}/${counts["COMMODORE"] ?? 0}/${counts["REAR_ADMIRAL"] ?? 0}`;
    };
    expect(buildOfficerRoster("uk").length).toBeGreaterThan(buildOfficerRoster("portugal").length);
    expect(buildOfficerRoster("uk").length).toBeGreaterThan(buildOfficerRoster("qing").length);
    expect(buildOfficerRoster("france").length).toBeGreaterThan(
      buildOfficerRoster("netherlands").length,
    );
    const shapes = new Set(
      ["uk", "france", "germany", "russia", "japan", "qing", "netherlands"].map(shape),
    );
    expect(shapes.size).toBeGreaterThan(1);
    expect(shape("uk")).not.toBe("6:3/2/1");
  });
});
