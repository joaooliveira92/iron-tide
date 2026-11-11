import { SafeInt } from "@bluewave/contracts";
import type { WarDeclaration, WorldState } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { buildDiplomacyScreenProjection } from "../src/diplomacy.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const month = { month: 1, year: 1880 };

function war(overrides: Partial<WarDeclaration> = {}): WarDeclaration {
  return {
    id: "war_uk_fra",
    attackerSideId: "side_uk",
    defenderSideId: "side_fra",
    attackerSideMembers: ["uk"],
    defenderSideMembers: ["fra"],
    attackerWarScore: 5,
    defenderWarScore: 1,
    attackerId: "uk",
    defenderId: "fra",
    startDate: "1880-01",
    status: "ACTIVE",
    ...overrides,
  };
}

const areas: WorldState["areas"] = [
  { id: "fra_home", name: "France", type: "coastal", controller: "fra", cessionCost: SafeInt(2) },
  {
    id: "med_corsica",
    name: "Corsica",
    type: "coastal",
    controller: "fra",
    cessionCost: SafeInt(4),
  },
  { id: "med_malta", name: "Malta", type: "coastal", controller: "fra", cessionCost: SafeInt(9) },
  { id: "med_open", name: "Open sea", type: "sea", controller: "fra" },
];

function project(wars: WarDeclaration[], playerId = "uk") {
  const snapshot = fixtureSnapshot(
    [fixtureNation({ id: "uk" }), fixtureNation({ id: "fra", homeAreaId: "fra_home" })],
    [],
    {
      world: { areas, routes: [], ports: [], possessions: [] },
      wars: {
        wars,
        battles: [],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
    },
  );
  return buildDiplomacyScreenProjection(fixtureState(snapshot), playerId, month)!;
}

describe("peace offer on the diplomacy projection", () => {
  it("offers the status quo plus each priced area, with the budget traced to the war score", () => {
    const offer = project([war()]).wars[0]!.peaceOffer!;
    expect(offer.budgetExplanation.formulaId).toBe("peace_budget");
    expect(Number(offer.budgetExplanation.result)).toBe(5);
    expect(offer.terms.map((t) => [t.term, t.label])).toEqual([
      [{ _tag: "StatusQuo" }, "Status quo"],
      [{ _tag: "CedeArea", areaId: "med_corsica" }, "Corsica"],
      [{ _tag: "CedeArea", areaId: "med_malta" }, "Malta"],
    ]);
  });

  it("explains each cost and the budget left, and flags what is unaffordable", () => {
    const terms = project([war()]).wars[0]!.peaceOffer!.terms;
    expect(
      terms.map((t) => [Number(t.costExplanation.result), Number(t.remainingExplanation.result)]),
    ).toEqual([
      [0, 5],
      [4, 1],
      [9, -4],
    ]);
    expect(terms.map((t) => t.affordable)).toEqual([true, true, false]);
  });

  it("marks the cession price as provisional, sourced to the area content", () => {
    const terms = project([war()]).wars[0]!.peaceOffer!.terms;
    const price = terms[1]!.costExplanation.children![0]!;
    expect(terms[1]!.provisional).toBe(true);
    expect(terms[0]!.provisional).toBe(false);
    expect(price.formulaId).toBe("peace_cost.area_price");
    expect(price.inputs["sourceStatus"]).toBe("PROVISIONAL");
    expect(price.source).toEqual({ kind: "content", ref: "areas/med_corsica.cessionCost" });
  });

  it("uses the defender's score and the attacker's areas when the player defends", () => {
    const flipped = project([war({ defenderWarScore: 7 })], "fra");
    const offer = flipped.wars[0]!.peaceOffer!;
    expect(Number(offer.budgetExplanation.result)).toBe(7);
    expect(offer.terms.map((t) => t.label)).toEqual(["Status quo"]);
  });

  it("gives no offer for a war that is not active", () => {
    expect(project([war({ status: "DECLARED_NOT_ACTIVE" })]).wars[0]!.peaceOffer).toBeUndefined();
    expect(
      project([war({ status: "ENDED", endDate: "1880-03" })]).wars[0]!.peaceOffer,
    ).toBeUndefined();
  });

  it("gives no offer to a co-belligerent that is not the principal", () => {
    const joined = war({ attackerSideMembers: ["uk", "deu"] });
    const snapshotWar = project([joined], "uk").wars[0]!;
    expect(snapshotWar.peaceOffer).toBeDefined();
    const ally = project([war({ attackerId: "deu", attackerSideMembers: ["deu", "uk"] })], "uk");
    expect(ally.wars[0]!.peaceOffer).toBeUndefined();
  });
});
