import type { CampaignSnapshot, NationState, WarDeclaration } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  checkPeaceBudget,
  checkProposePeace,
  peaceTermCost,
  type ProposePeaceFailure,
} from "../src/index.js";

function war(overrides: Partial<WarDeclaration> = {}): WarDeclaration {
  return {
    id: "war-1",
    attackerSideId: "side-GBR",
    defenderSideId: "side-FRA",
    attackerSideMembers: ["GBR", "AUS"],
    defenderSideMembers: ["FRA"],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: "GBR",
    defenderId: "FRA",
    startDate: "1880-01",
    status: "ACTIVE",
    ...overrides,
  };
}

type PeaceSnapshot = Pick<CampaignSnapshot, "wars" | "world" | "nations">;

function snapshotWith(...wars: WarDeclaration[]): PeaceSnapshot {
  return {
    world: { areas: [], routes: [], ports: [], possessions: [] },
    nations: new Map(),
    wars: {
      wars,
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
  };
}

function propose(nationId: string, warId = "war-1", tag = "StatusQuo") {
  return { type: "ProposePeace" as const, nationId, warId, term: { _tag: tag } };
}

function cede(nationId: string, areaId: unknown, warId = "war-1") {
  return { type: "ProposePeace" as const, nationId, warId, term: { _tag: "CedeArea", areaId } };
}

function homeOf(areaId: string): NationState {
  return { homeAreaId: areaId } as NationState;
}

function cessionSnapshot(
  options: {
    readonly warScore?: number;
    readonly areas?: PeaceSnapshot["world"]["areas"];
    readonly possessions?: { id: string; nationId: string; areaId: string }[];
  } = {},
): PeaceSnapshot {
  const base = snapshotWith(war({ attackerWarScore: options.warScore ?? 10 }));
  return {
    ...base,
    world: {
      areas: options.areas ?? [
        {
          id: "med_malta",
          name: "Malta",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(6),
        },
        {
          id: "fra_home",
          name: "France",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(1),
        },
        {
          id: "gbr_home",
          name: "Britain",
          type: "coastal",
          controller: "GBR",
          cessionCost: SafeInt(1),
        },
      ],
      routes: [],
      ports: [],
      possessions: options.possessions ?? [
        { id: "poss_malta", nationId: "FRA", areaId: "med_malta" },
        { id: "poss_fra", nationId: "FRA", areaId: "fra_home" },
      ],
    },
    nations: new Map([
      ["FRA", homeOf("fra_home")],
      ["GBR", homeOf("gbr_home")],
    ]),
  };
}

function failureOf(
  snapshot: PeaceSnapshot,
  body: ReturnType<typeof propose> | ReturnType<typeof cede>,
): ProposePeaceFailure {
  const result = checkProposePeace(snapshot, body);
  if (!Result.isFailure(result)) throw new Error("expected a failure");
  return result.failure;
}

describe("ProposePeace validation", () => {
  it("accepts a status-quo proposal from the attacker principal", () => {
    expect(Result.isSuccess(checkProposePeace(snapshotWith(war()), propose("GBR")))).toBe(true);
  });

  it("accepts a status-quo proposal from the defender principal", () => {
    expect(Result.isSuccess(checkProposePeace(snapshotWith(war()), propose("FRA")))).toBe(true);
  });

  it("fails with PeaceWarNotFound for an unknown war", () => {
    const failure = failureOf(snapshotWith(war()), propose("GBR", "missing"));
    expect(failure._tag).toBe("PeaceWarNotFound");
  });

  it("fails with PeaceWarNotActive for an ended war", () => {
    const failure = failureOf(
      snapshotWith(war({ status: "ENDED", endDate: "1881-01" })),
      propose("GBR"),
    );
    expect(failure._tag).toBe("PeaceWarNotActive");
  });

  it("fails with PeaceWarNotActive for a declared but not active war", () => {
    const failure = failureOf(snapshotWith(war({ status: "DECLARED_NOT_ACTIVE" })), propose("GBR"));
    expect(failure._tag).toBe("PeaceWarNotActive");
  });

  it("fails with PeaceCallerNotPrincipal for an allied side member", () => {
    const failure = failureOf(snapshotWith(war()), propose("AUS"));
    expect(failure._tag).toBe("PeaceCallerNotPrincipal");
  });

  it("fails with PeaceCallerNotPrincipal for a nation outside the war", () => {
    const failure = failureOf(snapshotWith(war()), propose("GER"));
    expect(failure._tag).toBe("PeaceCallerNotPrincipal");
  });

  it("fails with PeaceTermUnsupported for an unknown term tag", () => {
    const failure = failureOf(snapshotWith(war()), propose("GBR", "war-1", "Annex"));
    expect(failure._tag).toBe("PeaceTermUnsupported");
  });

  it("checks the war before the caller and the caller before the term", () => {
    expect(failureOf(snapshotWith(), propose("GER", "war-1", "Annex"))._tag).toBe(
      "PeaceWarNotFound",
    );
    expect(failureOf(snapshotWith(war()), propose("GER", "war-1", "Annex"))._tag).toBe(
      "PeaceCallerNotPrincipal",
    );
  });
});

describe("peace term budget", () => {
  it("prices the status-quo term at zero", () => {
    expect(peaceTermCost({ _tag: "StatusQuo" }, cessionSnapshot().world)).toEqual(
      Result.succeed(0),
    );
  });

  it("accepts a cost equal to the war score", () => {
    expect(Result.isSuccess(checkPeaceBudget(5, 5))).toBe(true);
  });

  it("fails with PeaceTermOverBudget when the cost exceeds the war score", () => {
    const result = checkPeaceBudget(6, 5);
    if (!Result.isFailure(result)) throw new Error("expected a failure");
    expect(result.failure._tag).toBe("PeaceTermOverBudget");
    expect(result.failure.cost).toBe(6);
    expect(result.failure.budget).toBe(5);
  });

  it("charges the caller's own side war score for a status-quo proposal", () => {
    const scored = snapshotWith(war({ attackerWarScore: 0, defenderWarScore: 40 }));
    expect(Result.isSuccess(checkProposePeace(scored, propose("GBR")))).toBe(true);
    expect(Result.isSuccess(checkProposePeace(scored, propose("FRA")))).toBe(true);
  });
});

describe("CedeArea peace term", () => {
  it("accepts a priced area the other principal controls", () => {
    const result = checkProposePeace(cessionSnapshot(), cede("GBR", "med_malta"));
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("prices the term at the area's cession cost", () => {
    const result = peaceTermCost(
      { _tag: "CedeArea", areaId: "med_malta" },
      cessionSnapshot().world,
    );
    expect(result).toEqual(Result.succeed(6));
  });

  it("accepts a cost equal to the proposer's own side war score", () => {
    const exact = cessionSnapshot({ warScore: 6 });
    expect(Result.isSuccess(checkProposePeace(exact, cede("GBR", "med_malta")))).toBe(true);
  });

  it("fails with PeaceAreaNotOwned for an area the caller itself holds", () => {
    expect(failureOf(cessionSnapshot(), cede("GBR", "gbr_home"))._tag).toBe("PeaceAreaNotOwned");
  });

  it("fails with PeaceAreaNotOwned for an unknown area", () => {
    expect(failureOf(cessionSnapshot(), cede("GBR", "nowhere"))._tag).toBe("PeaceAreaNotOwned");
  });

  it("fails with PeaceAreaNotOwned when a third nation holds a possession in the area", () => {
    const mixed = cessionSnapshot({
      possessions: [
        { id: "poss_malta", nationId: "FRA", areaId: "med_malta" },
        { id: "poss_other", nationId: "GER", areaId: "med_malta" },
      ],
    });
    expect(failureOf(mixed, cede("GBR", "med_malta"))._tag).toBe("PeaceAreaNotOwned");
  });

  it("fails with PeaceAreaIsHome for the loser's home area", () => {
    expect(failureOf(cessionSnapshot(), cede("GBR", "fra_home"))._tag).toBe("PeaceAreaIsHome");
  });

  it("lets the defender demand the attacker's area symmetrically", () => {
    const flipped = cessionSnapshot();
    const swapped = {
      ...flipped,
      wars: {
        ...flipped.wars,
        wars: flipped.wars.wars.map((w) => ({ ...w, attackerWarScore: 0, defenderWarScore: 10 })),
      },
      world: {
        ...flipped.world,
        areas: flipped.world.areas.map((a) =>
          a.id === "med_malta" ? { ...a, controller: "GBR" } : a,
        ),
        possessions: [{ id: "poss_malta", nationId: "GBR", areaId: "med_malta" }],
      },
    };
    expect(Result.isSuccess(checkProposePeace(swapped, cede("FRA", "med_malta")))).toBe(true);
  });

  it("fails with PeaceAreaUnpriced when the area carries no cession cost", () => {
    const unpriced = cessionSnapshot({
      areas: [{ id: "med_malta", name: "Malta", type: "coastal", controller: "FRA" }],
    });
    expect(failureOf(unpriced, cede("GBR", "med_malta"))._tag).toBe("PeaceAreaUnpriced");
  });

  it("fails with PeaceTermOverBudget when the cost exceeds the war score", () => {
    const poor = cessionSnapshot({ warScore: 5 });
    const failure = failureOf(poor, cede("GBR", "med_malta"));
    expect(failure._tag).toBe("PeaceTermOverBudget");
    if (failure._tag === "PeaceTermOverBudget") {
      expect(failure.cost).toBe(6);
      expect(failure.budget).toBe(5);
    }
  });

  it("fails with PeaceTermMalformed when the area id is missing or not a string", () => {
    expect(failureOf(cessionSnapshot(), cede("GBR", undefined))._tag).toBe("PeaceTermMalformed");
    expect(failureOf(cessionSnapshot(), cede("GBR", 7))._tag).toBe("PeaceTermMalformed");
    expect(failureOf(cessionSnapshot(), cede("GBR", ""))._tag).toBe("PeaceTermMalformed");
  });
});
