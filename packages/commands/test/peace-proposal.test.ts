import type { CampaignSnapshot, WarDeclaration } from "@bluewave/campaign";
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

function snapshotWith(...wars: WarDeclaration[]): Pick<CampaignSnapshot, "wars"> {
  return {
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

function failureOf(
  snapshot: Pick<CampaignSnapshot, "wars">,
  body: ReturnType<typeof propose>,
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
    expect(peaceTermCost({ _tag: "StatusQuo" })).toBe(0);
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
