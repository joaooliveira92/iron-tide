import { describe, expect, it } from "vite-plus/test";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { buildNationRail } from "./nation-rail-state.js";

const rel = (
  partner: string,
  relation: DiplomacyScreenProjection["relations"][number]["relation"],
  nap = false,
): DiplomacyScreenProjection["relations"][number] => ({
  nationAId: "uk",
  nationBId: partner,
  relation,
  tension: 4,
  nap,
  since: "1880-01",
  partnerNationId: partner,
  partnerName: partner,
});

const projection = (over: Partial<DiplomacyScreenProjection> = {}): DiplomacyScreenProjection => ({
  revision: 1,
  month: { month: 1, year: 1880 },
  playerNationId: "uk",
  knownNations: [
    { nationId: "france", name: "France" },
    { nationId: "germany", name: "Germany" },
    { nationId: "italy", name: "Italy" },
    { nationId: "russia", name: "Russia" },
    { nationId: "spain", name: "Spain" },
  ],
  relations: [
    rel("france", "at_war"),
    rel("germany", "allied"),
    rel("italy", "neutral", true),
    rel("russia", "neutral"),
  ],
  wars: [
    {
      warId: "w1",
      attackerSideId: "a",
      defenderSideId: "d",
      attackerSideMembers: ["france"],
      defenderSideMembers: ["uk"],
      attackerWarScore: 7,
      defenderWarScore: 3,
      attackerId: "france",
      defenderId: "uk",
      startDate: "1880-01",
      status: "ACTIVE",
      playerSide: "defender",
    },
  ],
  blockades: [],
  areas: [],
  ...over,
});

describe("buildNationRail", () => {
  it("lists the player first, then the other powers by name", () => {
    const rows = buildNationRail(projection(), "Britain");
    expect(rows.map((r) => r.nationId)).toEqual([
      "uk",
      "france",
      "germany",
      "italy",
      "russia",
      "spain",
    ]);
    expect(rows[0]).toMatchObject({ isPlayer: true, name: "Britain", relationLabel: "You" });
  });

  it("labels each relation in words and shows war score only at war", () => {
    const rows = buildNationRail(projection(), "Britain");
    const by = Object.fromEntries(rows.map((r) => [r.nationId, r]));
    expect(by.france).toMatchObject({ relation: "war", relationLabel: "War" });
    expect(by.france!.warScore).toEqual({ yours: 3, enemy: 7 });
    expect(by.germany).toMatchObject({ relation: "alliance", relationLabel: "Alliance" });
    expect(by.italy).toMatchObject({ relation: "pact", relationLabel: "Non-aggression pact" });
    expect(by.russia).toMatchObject({ relation: "peace", relationLabel: "Peace" });
    expect(by.spain).toMatchObject({ relation: "peace", warScore: null });
    expect(by.germany!.warScore).toBeNull();
  });

  it("flags a blockade between the player and a nation", () => {
    const rows = buildNationRail(
      projection({
        blockades: [
          {
            blockaderId: "uk",
            blockadedNationId: "france",
            areaId: "x",
            establishedMonth: "1880-02",
          },
        ],
      }),
      "Britain",
    );
    expect(rows.find((r) => r.nationId === "france")).toMatchObject({
      relation: "war",
      relationLabel: "War, blockade",
      blockade: true,
    });
  });

  it("ignores ended wars for the war score", () => {
    const p = projection();
    const ended = { ...p.wars[0]!, status: "ENDED" as const };
    const rows = buildNationRail(projection({ wars: [ended] }), "Britain");
    expect(rows.find((r) => r.nationId === "france")!.warScore).toBeNull();
  });

  it("carries resolved flag art, and null for a power without art", () => {
    const rows = buildNationRail(
      projection({
        knownNations: [
          { nationId: "france", name: "France" },
          { nationId: "atlantis", name: "Atlantis" },
        ],
      }),
      "Britain",
    );
    const by = Object.fromEntries(rows.map((r) => [r.nationId, r]));
    expect(by.uk!.flagUrl).not.toBeNull();
    expect(by.france!.flagUrl).not.toBeNull();
    expect(by.atlantis!.flagUrl).toBeNull();
  });

  it("keeps an alliance above a non-aggression pact", () => {
    const rows = buildNationRail(
      projection({ relations: [rel("germany", "allied", true)] }),
      "Britain",
    );
    expect(rows.find((r) => r.nationId === "germany")).toMatchObject({ relation: "alliance" });
  });

  it("lets a non-aggression pact override a trade agreement", () => {
    const rows = buildNationRail(
      projection({ relations: [rel("russia", "trade_agreement", true)] }),
      "Britain",
    );
    expect(rows.find((r) => r.nationId === "russia")).toMatchObject({ relation: "pact" });
  });
});
