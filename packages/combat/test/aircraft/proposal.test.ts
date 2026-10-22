import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  generateAircraftProposal,
  computeProposalHash,
  acceptAircraftProposal,
  rejectAircraftProposal,
  expireAircraftProposal,
} from "../../src/aircraft/index.js";
import type { AircraftDevelopmentProject } from "../../src/aircraft/index.js";

function baseProject(
  overrides: Partial<AircraftDevelopmentProject> = {},
): AircraftDevelopmentProject {
  return {
    developmentProjectId: "nation_france_FIGHTER_1917-05",
    requestedRole: "FIGHTER",
    emphasizedTraits: ["SPEED", "MANEUVERABILITY"] as [string, string],
    basingClass: "LAND_BASED",
    startMonth: "1917-05",
    requiredDevelopmentMonths: SafeInt(4),
    completedPaidMonths: SafeInt(4),
    monthlyCost: SafeInt(2000),
    technologyInputHash: "a".repeat(64),
    nationalTraitInputHash: "b".repeat(64),
    designStreamKey: "aircraft/development/nation/nation_france/FIGHTER/proposal",
    status: "READY_FOR_REVIEW",
    finalProposalId: null,
    rulesetVersion: "aircraft_ruleset_v1",
    formulaVersion: "aircraft_formula_v1",
    projectHash: "c".repeat(64),
    ...overrides,
  };
}

describe("generateAircraftProposal", () => {
  it("produces a PENDING proposal with all fields and a hash", () => {
    const project = baseProject();
    const rng = new RandomEngine("test-seed-123").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");

    expect(proposal.status).toBe("PENDING");
    expect(proposal.proposalId).toMatch(/^proposal_/);
    expect(proposal.requestedRole).toBe("FIGHTER");
    expect(proposal.emphasizedTraits).toEqual(["SPEED", "MANEUVERABILITY"]);
    expect(proposal.proposalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(proposal.developmentCost)).toBeGreaterThan(0);
    expect(Number(proposal.productionWork)).toBeGreaterThan(0);
    expect(Number(proposal.productionCost)).toBeGreaterThan(0);
    expect(proposal.expiryMonth).toBe("1918-05");
  });

  it("has deterministic attributes from the same seed", () => {
    const project = baseProject();
    const rng1 = new RandomEngine("test-seed-456").stream("aircraft/test");
    const rng2 = new RandomEngine("test-seed-456").stream("aircraft/test");
    const a = generateAircraftProposal(project, rng1, "1917-05");
    const b = generateAircraftProposal(project, rng2, "1917-05");

    expect(Number(a.productionWork)).toBe(Number(b.productionWork));
    expect(Number(a.productionCost)).toBe(Number(b.productionCost));
    expect(a.proposalHash).toBe(b.proposalHash);
  });

  it("produces different outputs for different seeds", () => {
    const project = baseProject();
    const rng1 = new RandomEngine("seed-alpha").stream("aircraft/test");
    const rng2 = new RandomEngine("seed-beta").stream("aircraft/test");
    const a = generateAircraftProposal(project, rng1, "1917-05");
    const b = generateAircraftProposal(project, rng2, "1917-05");

    expect(a.proposalHash).not.toBe(b.proposalHash);
  });
});

describe("computeProposalHash", () => {
  it("produces identical hash for identical proposals", () => {
    const project = baseProject();
    const rng = new RandomEngine("hash-test-seed").stream("aircraft/test");
    const a = generateAircraftProposal(project, rng, "1917-05");
    const rng2 = new RandomEngine("hash-test-seed").stream("aircraft/test");
    const b = generateAircraftProposal(project, rng2, "1917-05");

    expect(computeProposalHash(a)).toBe(computeProposalHash(b));
  });
});

describe("acceptAircraftProposal", () => {
  it("accepts a PENDING proposal and creates a model", () => {
    const project = baseProject();
    const rng = new RandomEngine("accept-test").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");

    const { updatedProposal, model } = acceptAircraftProposal(
      proposal,
      "france_fighter_mk1",
      "nation_france",
      "1918-01",
      "LAND_BASED",
    );

    expect(updatedProposal.status).toBe("ACCEPTED");
    expect(model.aircraftModelId).toBe("france_fighter_mk1");
    expect(model.ownerOrLicenseHolder).toBe("nation_france");
    expect(model.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws for non-PENDING proposal", () => {
    const project = baseProject();
    const rng = new RandomEngine("reject-test").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");
    const rejected = rejectAircraftProposal(proposal);

    expect(() =>
      acceptAircraftProposal(rejected, "model-id", "nation_france", "1918-01", "LAND_BASED"),
    ).toThrow();
  });
});

describe("rejectAircraftProposal", () => {
  it("rejects a PENDING proposal", () => {
    const project = baseProject();
    const rng = new RandomEngine("reject-test-2").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");

    const result = rejectAircraftProposal(proposal);
    expect(result.status).toBe("REJECTED");
  });

  it("throws for non-PENDING proposal", () => {
    const project = baseProject();
    const rng = new RandomEngine("reject-test-3").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");
    const accepted = acceptAircraftProposal(
      proposal,
      "mid",
      "nation_france",
      "1918-01",
      "LAND_BASED",
    );

    expect(() => rejectAircraftProposal(accepted.updatedProposal)).toThrow();
  });
});

describe("expireAircraftProposal", () => {
  it("expires a PENDING proposal", () => {
    const project = baseProject();
    const rng = new RandomEngine("expire-test").stream("aircraft/test");
    const proposal = generateAircraftProposal(project, rng, "1917-05");

    const result = expireAircraftProposal(proposal);
    expect(result.status).toBe("EXPIRED");
  });
});
