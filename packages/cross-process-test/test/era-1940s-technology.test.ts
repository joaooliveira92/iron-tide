import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const START_YEAR = 1880;

const EXPECTED: ReadonlyArray<readonly [id: string, field: string, year: number]> = [
  ["rad_search_radar", "RADAR_AND_ELECTRONICS", 1940],
  ["rad_gunnery_fire_control_radar", "RADAR_AND_ELECTRONICS", 1941],
  ["rad_blind_fire_director", "RADAR_AND_ELECTRONICS", 1943],
  ["fc_proximity_fuze", "FIRE_CONTROL", 1943],
  ["fc_radar_directed_maa", "FIRE_CONTROL", 1944],
  ["gun_dp_rapid_5in", "GUNNERY", 1945],
  ["gun_auto_loading_turret", "GUNNERY", 1948],
  ["torp_acoustic_homing", "TORPEDOES", 1943],
  ["m_asw_influence_mine", "MINES_AND_ASW", 1940],
  ["m_asw_ahead_throwing", "MINES_AND_ASW", 1942],
  ["sub_snorkel", "SUBMARINES", 1944],
  ["hc_all_welded_hull", "HULL_CONSTRUCTION", 1941],
  ["av_carrier_jet", "AVIATION", 1944],
  ["mis_heavy_ssm", "MISSILES", 1947],
];

describe("E-1 1940-1949 technology (ADR-0282, ADR-0283)", () => {
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
});
