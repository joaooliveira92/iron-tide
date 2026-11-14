import { SafeInt } from "@bluewave/contracts";
import type { PeaceOffer, WarDeclaration, WorldState } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { buildDiplomacyScreenProjection } from "../src/diplomacy.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const month = { month: 1, year: 1880 };

const war: WarDeclaration = {
  id: "war_uk_fra",
  attackerSideId: "side_uk",
  defenderSideId: "side_fra",
  attackerSideMembers: ["uk"],
  defenderSideMembers: ["fra"],
  attackerWarScore: 0,
  defenderWarScore: 40,
  attackerId: "uk",
  defenderId: "fra",
  startDate: "1880-01",
  status: "ACTIVE",
};

const areas: WorldState["areas"] = [
  { id: "uk_home", name: "Britain", type: "coastal", controller: "uk" },
  { id: "med_malta", name: "Malta", type: "coastal", controller: "uk", cessionCost: SafeInt(9) },
];

const statusQuo: PeaceOffer = {
  warId: "war_uk_fra",
  proposerId: "fra",
  targetId: "uk",
  month: "1880-01",
  term: { _tag: "StatusQuo" },
  reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
};

function project(offers: PeaceOffer[] | undefined, warOverride: Partial<WarDeclaration> = {}) {
  const snapshot = fixtureSnapshot(
    [fixtureNation({ id: "uk" }), fixtureNation({ id: "fra", homeAreaId: "fra_home" })],
    [],
    {
      world: { areas, routes: [], ports: [], possessions: [] },
      wars: {
        wars: [{ ...war, ...warOverride }],
        battles: [],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
        ...(offers === undefined ? {} : { peaceOffers: offers }),
      },
    },
  );
  return buildDiplomacyScreenProjection(fixtureState(snapshot), "uk", month)!;
}

describe("incoming peace offer on the diplomacy projection", () => {
  it("is absent when the war carries no offer", () => {
    expect(project(undefined).wars[0]!.incomingPeaceOffer).toBeUndefined();
  });

  it("projects a pending status quo offer with its reason code", () => {
    expect(project([statusQuo]).wars[0]!.incomingPeaceOffer).toEqual({
      proposerId: "fra",
      term: { _tag: "StatusQuo" },
      reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
      month: "1880-01",
    });
  });

  it("projects a cession offer with the area name", () => {
    const offer = {
      ...statusQuo,
      term: { _tag: "CedeArea" as const, areaId: "med_malta" },
      reasonCode: "PROPOSER_LEADS_BY_MARGIN",
    };
    expect(project([offer]).wars[0]!.incomingPeaceOffer).toMatchObject({
      term: { _tag: "CedeArea", areaId: "med_malta" },
      areaName: "Malta",
    });
  });

  it("ignores offers aimed at another nation and offers on ended wars", () => {
    expect(
      project([{ ...statusQuo, targetId: "ger" }]).wars[0]!.incomingPeaceOffer,
    ).toBeUndefined();
    expect(
      project([statusQuo], { status: "ENDED", endDate: "1880-02" }).wars[0]!.incomingPeaceOffer,
    ).toBeUndefined();
  });
});
