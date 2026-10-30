import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const START_YEAR = 1880;

const EXPECTED: ReadonlyArray<readonly [id: string, field: string, year: number]> = [
  ["mis_cruise_missile_data_link", "MISSILES", 1960],
  ["mis_light_sam", "MISSILES", 1961],
  ["mis_medium_ssm_quadruple", "MISSILES", 1966],
];

describe("E-1 1960-1970 technology", () => {
  const { bundle, state } = compileProductionCampaign();
  const catalogue = new Map(
    (state.snapshot.world.technologies ?? []).map((tech) => [tech.techId, tech]),
  );
  const authored = new Map((bundle.technologies ?? []).map((tech) => [tech.id, tech]));

  it.each(EXPECTED)("%s is catalogued in %s at %i", (id, field, year) => {
    const entry = catalogue.get(id);
    expect(entry?.researchFieldId).toBe(field);
    expect(entry?.availabilityMonth).toBe((year - START_YEAR) * 12);
    expect(authored.get(id)?.year).toBe(year);
  });

  it("labels every new technology a balance target with a citation", () => {
    for (const [id] of EXPECTED) {
      const provenance = authored.get(id)?.provenance;
      expect(provenance?.sourceStatus, id).toBe("BALANCE_TARGET");
      expect(provenance?.sources.length, id).toBeGreaterThan(0);
    }
  });

  it("resolves every prerequisite to an authored technology", () => {
    for (const [id] of EXPECTED) {
      for (const prerequisite of catalogue.get(id)?.prerequisites ?? []) {
        expect(catalogue.has(prerequisite), `${id} -> ${prerequisite}`).toBe(true);
      }
    }
  });

  it("adds nothing for DAMAGE_CONTROL (ADR-0283 D3i)", () => {
    const late = [...catalogue.values()].filter(
      (tech) =>
        tech.researchFieldId === "DAMAGE_CONTROL" &&
        tech.availabilityMonth > (1939 - 1880) * 12 + 11,
    );
    expect(late).toEqual([]);
  });

  it("keeps every new technology inside 1960-1970", () => {
    for (const [id, , year] of EXPECTED) {
      expect(year, id).toBeGreaterThanOrEqual(1960);
      expect(year, id).toBeLessThanOrEqual(1970);
    }
  });
});
