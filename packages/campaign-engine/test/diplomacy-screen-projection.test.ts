import { describe, expect, it } from "vite-plus/test";
import type { BlockadeState, DiplomaticRelation, WarDeclaration } from "@bluewave/campaign";
import { buildDiplomacyScreenProjection } from "../src/diplomacy.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const month = { month: 1, year: 1880 };

function relation(
  nationA: string,
  nationB: string,
  overrides: Partial<DiplomaticRelation> = {},
): DiplomaticRelation {
  return {
    nationA,
    nationB,
    relation: "neutral",
    tension: 5,
    nap: false,
    since: "1880-01",
    ...overrides,
  };
}

function war(overrides: Partial<WarDeclaration>): WarDeclaration {
  return {
    id: "war_uk_fra_1880-01",
    attackerSideId: "side_uk",
    defenderSideId: "side_fra",
    attackerSideMembers: ["uk"],
    defenderSideMembers: ["fra"],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: "uk",
    defenderId: "fra",
    startDate: "1880-01",
    status: "DECLARED_NOT_ACTIVE",
    ...overrides,
  };
}

function blockade(overrides: Partial<BlockadeState> = {}): BlockadeState {
  return {
    blockaderId: "uk",
    blockadedNationId: "fra",
    areaId: "med_gibraltar",
    establishedMonth: "1880-02",
    ...overrides,
  };
}

describe("buildDiplomacyScreenProjection", () => {
  it("projects every OTHER nation sorted by id with names from the compiled snapshot", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({ id: "uk", name: "United Kingdom" }),
        fixtureNation({ id: "fra" }),
        fixtureNation({ id: "deu" }),
      ],
      [],
      { world: { areas: [], routes: [], ports: [] } },
    );
    const projection = buildDiplomacyScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection).toBeDefined();
    if (!projection) return;
    expect(projection.knownNations).toEqual([
      { nationId: "deu", name: "deu" },
      { nationId: "fra", name: "fra" },
    ]);
    // The player's own nation (with the real authored name) is NOT listed.
    expect(projection.knownNations.some((n) => n.nationId === "uk")).toBe(false);
    expect(projection.knownNations[1]!.name).toBe("fra");
  });

  it("derives relations involving the player with partner id+name, sorted by partner", () => {
    const snapshot = buildSnapshot(
      [
        fixtureNation({ id: "uk", name: "United Kingdom" }),
        fixtureNation({ id: "fra" }),
        fixtureNation({ id: "deu" }),
      ],
      {
        world: { areas: [], routes: [], ports: [] },
        politics: {
          relations: [
            relation("uk", "fra", { relation: "at_war", tension: 9, since: "1880-03" }),
            relation("uk", "deu", { relation: "allied", tension: 1, nap: true }),
            // A pair that does NOT involve the player must be excluded.
            relation("fra", "deu", { relation: "at_war", tension: 8 }),
          ],
          shells: {},
        },
      },
    );
    const projection = buildDiplomacyScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection).toBeDefined();
    if (!projection) return;

    expect(projection.relations).toHaveLength(2);
    // Sorted by partnerNationId (deu before fra).
    expect(projection.relations[0]).toEqual({
      nationAId: "uk",
      nationBId: "deu",
      relation: "allied",
      tension: 1,
      nap: true,
      since: "1880-01",
      partnerNationId: "deu",
      partnerName: "deu",
    });
    expect(projection.relations[1]!.partnerNationId).toBe("fra");
    expect(projection.relations[1]!.partnerName).toBe("fra");
  });

  it("projects wars where the player is a member, with playerSide on either side", () => {
    const snapshot = buildSnapshot(
      [
        fixtureNation({ id: "uk", name: "UK" }),
        fixtureNation({ id: "fra" }),
        fixtureNation({ id: "deu" }),
      ],
      {
        world: { areas: [], routes: [], ports: [] },
        wars: {
          wars: [
            war({
              id: "war_uk_fra",
              attackerSideMembers: ["uk"],
              defenderSideMembers: ["fra"],
              status: "ACTIVE",
              endDate: undefined,
            }),
            // Player on the DEFENDING side of a multi-member war.
            war({
              id: "war_deu_uk",
              attackerSideMembers: ["deu"],
              defenderSideMembers: ["uk", "fra"],
              attackerId: "deu",
              defenderId: "uk",
              status: "DECLARED_NOT_ACTIVE",
            }),
            // A war the player is NOT part of must be excluded.
            war({
              id: "war_fra_deu",
              attackerSideMembers: ["fra"],
              defenderSideMembers: ["deu"],
              attackerId: "fra",
              defenderId: "deu",
            }),
          ],
          battles: [],
          participantMemberships: [],
          blockadeState: [],
          battleManifests: [],
        },
      },
    );
    const projection = buildProjection(snapshot);
    expect(projection).toBeDefined();
    if (!projection) return;

    expect(projection.wars).toHaveLength(2);
    const ukWar = projection.wars.find((w) => w.warId === "war_uk_fra")!;
    expect(ukWar.playerSide).toBe("attacker");
    expect(ukWar.attackerId).toBe("uk");
    expect(ukWar.defenderId).toBe("fra");
    expect(ukWar.status).toBe("ACTIVE");
    expect(ukWar.attackerWarScore).toBe(0);

    const defended = projection.wars.find((w) => w.warId === "war_deu_uk")!;
    expect(defended.playerSide).toBe("defender");
    expect(defended.defenderSideMembers).toEqual(["uk", "fra"]);
    expect(defended.endDate).toBeUndefined();
  });

  it("projects blockades where the player blocks OR is blocked", () => {
    const snapshot = buildSnapshot(
      [fixtureNation({ id: "uk", name: "UK" }), fixtureNation({ id: "fra" })],
      {
        world: { areas: [], routes: [], ports: [] },
        wars: {
          wars: [],
          battles: [],
          participantMemberships: [],
          blockadeState: [
            blockade({ blockaderId: "uk", blockadedNationId: "fra", areaId: "med_gibraltar" }),
            blockade({ blockaderId: "deu", blockadedNationId: "uk", areaId: "north_sea" }),
            // Not player-involved.
            blockade({ blockaderId: "fra", blockadedNationId: "deu", areaId: "med_malta" }),
          ],
          battleManifests: [],
        },
      },
    );
    const projection = buildProjection(snapshot);
    expect(projection).toBeDefined();
    if (!projection) return;

    expect(projection.blockades).toHaveLength(2);
    expect(projection.blockades[0]).toEqual({
      blockaderId: "deu",
      blockadedNationId: "uk",
      areaId: "north_sea",
      establishedMonth: "1880-02",
    });
    expect(projection.blockades[1]!.areaId).toBe("med_gibraltar");
  });

  it("projects the world's strategic areas sorted by id for the blockade picker", () => {
    const snapshot = buildSnapshot([fixtureNation({ id: "uk" }), fixtureNation({ id: "fra" })], {
      world: {
        areas: [
          { id: "sea_z", name: "Z Sea", type: "sea" },
          { id: "sea_a", name: "A Sea", type: "sea" },
        ],
        routes: [],
        ports: [],
      },
    });
    const projection = buildProjection(snapshot);
    expect(projection).toBeDefined();
    if (!projection) return;
    expect(projection.areas).toEqual([
      { areaId: "sea_a", name: "A Sea" },
      { areaId: "sea_z", name: "Z Sea" },
    ]);
  });

  it("returns undefined for an unknown player slot", () => {
    const snapshot = buildSnapshot([fixtureNation({ id: "uk" })]);
    expect(
      buildDiplomacyScreenProjection(fixtureState(snapshot), "germany", month),
    ).toBeUndefined();
  });
});

function buildSnapshot(
  nations: import("@bluewave/campaign").NationState[],
  overrides: Partial<import("@bluewave/campaign").CampaignSnapshot> = {},
): import("@bluewave/campaign").CampaignSnapshot {
  return fixtureSnapshot(nations, [], overrides);
}

function buildProjection(snapshot: import("@bluewave/campaign").CampaignSnapshot) {
  return buildDiplomacyScreenProjection(fixtureState(snapshot), "uk", month);
}
