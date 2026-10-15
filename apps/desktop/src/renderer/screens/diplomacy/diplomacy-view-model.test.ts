import { tensionLabel } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { buildDiplomacyViewModel } from "./diplomacy-view-model.js";

function fixtureProjection(
  overrides: Partial<DiplomacyScreenProjection> = {},
): DiplomacyScreenProjection {
  return {
    playerNationId: "uk",
    knownNations: [
      { nationId: "france", name: "France" },
      { nationId: "germany", name: "Germany" },
    ],
    relations: [
      {
        nationAId: "uk",
        nationBId: "france",
        relation: "at_war",
        tension: 9,
        nap: false,
        since: "1880-01",
        partnerNationId: "france",
        partnerName: "France",
      },
      {
        nationAId: "uk",
        nationBId: "germany",
        relation: "neutral",
        tension: 5,
        nap: true,
        since: "1880-02",
        partnerNationId: "germany",
        partnerName: "Germany",
      },
    ],
    wars: [
      {
        warId: "war_uk_france_1880-01",
        attackerSideId: "side_uk",
        defenderSideId: "side_france",
        attackerSideMembers: ["uk"],
        defenderSideMembers: ["france"],
        attackerWarScore: 3,
        defenderWarScore: 1,
        attackerId: "uk",
        defenderId: "france",
        startDate: "1880-01",
        status: "ACTIVE",
        playerSide: "attacker",
      },
    ],
    blockades: [
      {
        blockaderId: "uk",
        blockadedNationId: "france",
        areaId: "med_gibraltar",
        establishedMonth: "1880-02",
      },
    ],
    areas: [{ areaId: "med_gibraltar", name: "Gibraltar" }],
    revision: 0,
    month: { month: 1, year: 1880 },
    ...overrides,
  };
}

describe("buildDiplomacyViewModel", () => {
  it("derives labelled, affordance-bearing relation rows", () => {
    const vm = buildDiplomacyViewModel(fixtureProjection(), null);

    const france = vm.relations[0]!;
    expect(france).toMatchObject({
      partnerName: "France",
      relationLabel: "At war",
      tensionBadge: "Hostile",
      isLikelyRival: true,
      highTension: true,
      actions: ["DeclareBlockade"],
    });
    expect(france.highTensionNote).toBe(humanizeId(tensionLabel(9)).toLowerCase());

    const germany = vm.relations[1]!;
    expect(germany).toMatchObject({
      relationLabel: "Neutral",
      tensionBadge: null,
      nap: true,
      actions: ["DeclareWar", "FormAlliance", "BreakNonAggressionPact"],
    });
  });

  it("names both war sides and the player's own side", () => {
    const vm = buildDiplomacyViewModel(fixtureProjection(), null);

    expect(vm.wars[0]).toMatchObject({
      attackerSideLabel: "your nation",
      defenderSideLabel: "France",
      yourName: "your nation",
      enemyName: "France",
    });
  });

  it("resolves blockade nation and area names", () => {
    const vm = buildDiplomacyViewModel(fixtureProjection(), null);

    expect(vm.blockades[0]).toMatchObject({
      blockaderName: "your nation",
      blockadedName: "France",
      areaLabel: "Gibraltar",
      establishedMonth: "1880-02",
    });
  });

  it("describes the current draft, or null when nothing is drafted", () => {
    expect(buildDiplomacyViewModel(fixtureProjection(), null).draftLabel).toBeNull();
    expect(
      buildDiplomacyViewModel(fixtureProjection(), {
        kind: "DeclareWar",
        partnerNationId: "france",
      }).draftLabel,
    ).toBe("Declare war with France");
  });
});
