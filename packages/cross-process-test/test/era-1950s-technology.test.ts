import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const START_YEAR = 1880;

const EXPECTED: ReadonlyArray<readonly [id: string, field: string, year: number]> = [
  ["m_asw_improved_sonar", "MINES_AND_ASW", 1955],
  ["sub_streamlined_hull", "SUBMARINES", 1953],
  ["mac_marine_gas_turbine", "MACHINERY", 1953],
  ["torp_wire_guided_homing", "TORPEDOES", 1956],
  ["sd_helicopter_hangar", "SHIP_DESIGN", 1955],
  ["cop_angled_deck", "CARRIER_OPERATIONS", 1950],
  ["cop_steam_catapult", "CARRIER_OPERATIONS", 1952],
  ["mis_medium_heavy_sam", "MISSILES", 1956],
  ["mis_quadruple_heavy_ssm", "MISSILES", 1959],
];

describe("E-1 1950-1959 technology (ADR-0282, ADR-0283)", () => {
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

  it("keeps every new technology inside 1950-1959", () => {
    for (const [id, , year] of EXPECTED) {
      expect(year, id).toBeGreaterThanOrEqual(1950);
      expect(year, id).toBeLessThanOrEqual(1959);
    }
  });
});
