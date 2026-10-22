import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  checkPrivateVentureEligibility,
  resolvePrivateVenture,
  purchasePrivateProposal,
  expirePrivateProposals,
  generatePrivateVentureProposal,
  PRIVATE_VENTURE_STREAM_KEY,
} from "@bluewave/combat/aircraft";
import type { PrivateVentureEligibilityInput } from "@bluewave/combat/aircraft";
import { PRIVATE_VENTURE_MAX_UNEXPIRED } from "@bluewave/combat/aircraft";
import type { AircraftProposal } from "@bluewave/combat/aircraft";

function eligibleInput(
  overrides: Partial<PrivateVentureEligibilityInput> = {},
): PrivateVentureEligibilityInput {
  return {
    hasPrivateAviationIndustry: true,
    permittedRoles: ["FIGHTER", "DIVE_BOMBER"] as const,
    hasNationalProhibition: false,
    lastVentureMonth: null,
    currentMonth: "1917-05",
    unexpiredPrivateProposalCount: 0,
    ...overrides,
  };
}

function pendingProposal(overrides: Partial<AircraftProposal> = {}): AircraftProposal {
  return {
    proposalId: "private_nation_france_FIGHTER_1917-05",
    sourceProjectId: "private_venture",
    proposedModel: {
      aircraftModelId: "",
      aircraftType: "FIGHTER",
      ownerOrLicenseHolder: "nation_france",
      introductionMonth: "",
      speed: SafeInt(40),
      firepower: SafeInt(25),
      maneuverability: SafeInt(50),
      toughness: SafeInt(30),
      payloadCapacity: SafeInt(100),
      rangeClass: "MEDIUM",
      rangeDistance: SafeInt(300),
      eligibleRoleIds: ["FIGHTER"],
      basingRequirementId: "LAND_BASED",
      carrierSuitable: false,
      technologyPrerequisiteIds: [],
      productionWork: SafeInt(400),
      unitCost: SafeInt(1200),
      maintenanceRequirement: SafeInt(50),
      crewRequirement: SafeInt(1),
      contentVersion: "aircraft_model_definition_v1",
      contentHash: "",
    },
    requestedRole: "FIGHTER",
    emphasizedTraits: ["SPEED", "FIREPOWER"] as [string, string],
    developmentDurationMonths: SafeInt(0),
    developmentCost: SafeInt(0),
    productionCost: SafeInt(1200),
    productionWork: SafeInt(400),
    estimatedPerformance: {
      speed: SafeInt(40),
      firepower: SafeInt(25),
      maneuverability: SafeInt(50),
      toughness: SafeInt(30),
    },
    expiryMonth: "1918-05",
    status: "PENDING",
    rulesetVersion: "aircraft_ruleset_v1",
    formulaVersion: "aircraft_formula_v1",
    proposalHash: "",
    ...overrides,
  };
}

describe("checkPrivateVentureEligibility", () => {
  it("returns eligible when all conditions are met", () => {
    const result = checkPrivateVentureEligibility(eligibleInput());
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.eligibleRoles).toContain("FIGHTER");
      expect(result.eligibleRoles).toContain("DIVE_BOMBER");
    }
  });

  it("returns eligible roles in sorted order", () => {
    const input = eligibleInput({ permittedRoles: ["DIVE_BOMBER", "FIGHTER", "AIRSHIP"] });
    const result = checkPrivateVentureEligibility(input);
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.eligibleRoles[0]).toBe("AIRSHIP");
      expect(result.eligibleRoles[1]).toBe("DIVE_BOMBER");
      expect(result.eligibleRoles[2]).toBe("FIGHTER");
    }
  });

  it("returns ineligible when no private aviation industry", () => {
    const result = checkPrivateVentureEligibility(
      eligibleInput({ hasPrivateAviationIndustry: false }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("NO_PRIVATE_AVIATION_INDUSTRY");
    }
  });

  it("returns ineligible when national prohibition is active", () => {
    const result = checkPrivateVentureEligibility(eligibleInput({ hasNationalProhibition: true }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("NATIONAL_PROHIBITION_ACTIVE");
    }
  });

  it("returns ineligible when no permitted roles", () => {
    const result = checkPrivateVentureEligibility(eligibleInput({ permittedRoles: [] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("NO_PERMITTED_ROLES");
    }
  });

  it("returns ineligible when cooldown is not complete", () => {
    const lastVentureMonth = "1917-04";
    const result = checkPrivateVentureEligibility(
      eligibleInput({ lastVentureMonth, currentMonth: "1917-05" }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("COOLDOWN_NOT_COMPLETE");
    }
  });

  it("returns eligible exactly at cooldown boundary (12 months later)", () => {
    const lastVentureMonth = "1916-05";
    const result = checkPrivateVentureEligibility(
      eligibleInput({ lastVentureMonth, currentMonth: "1917-05" }),
    );
    expect(result.eligible).toBe(true);
  });

  it("returns ineligible when at max unexpired limit", () => {
    const result = checkPrivateVentureEligibility(
      eligibleInput({ unexpiredPrivateProposalCount: PRIVATE_VENTURE_MAX_UNEXPIRED }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("MAX_UNEXPIRED_LIMIT_REACHED");
    }
  });
});

describe("generatePrivateVentureProposal", () => {
  it("generates a PENDING proposal with all required fields", () => {
    const rng = new RandomEngine("test-seed").stream(PRIVATE_VENTURE_STREAM_KEY);
    const proposal = generatePrivateVentureProposal({
      nationId: "nation_france",
      role: "FIGHTER",
      currentMonth: "1917-05",
      rngStream: rng,
    });

    expect(proposal.status).toBe("PENDING");
    expect(proposal.proposalId).toMatch(/^private_/);
    expect(proposal.requestedRole).toBe("FIGHTER");
    expect(proposal.proposalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(proposal.productionCost)).toBeGreaterThan(0);
    expect(Number(proposal.productionWork)).toBeGreaterThan(0);
    expect(proposal.expiryMonth).toBe("1918-05");
  });

  it("produces deterministic output for same seed", () => {
    const rng1 = new RandomEngine("deterministic-seed").stream(PRIVATE_VENTURE_STREAM_KEY);
    const rng2 = new RandomEngine("deterministic-seed").stream(PRIVATE_VENTURE_STREAM_KEY);
    const a = generatePrivateVentureProposal({
      nationId: "nation_france",
      role: "FIGHTER",
      currentMonth: "1917-05",
      rngStream: rng1,
    });
    const b = generatePrivateVentureProposal({
      nationId: "nation_france",
      role: "FIGHTER",
      currentMonth: "1917-05",
      rngStream: rng2,
    });

    expect(a.proposalHash).toBe(b.proposalHash);
    expect(Number(a.productionCost)).toBe(Number(b.productionCost));
    expect(Number(a.productionWork)).toBe(Number(b.productionWork));
  });

  it("produces different output for different seeds", () => {
    const rng1 = new RandomEngine("seed-alpha").stream(PRIVATE_VENTURE_STREAM_KEY);
    const rng2 = new RandomEngine("seed-beta").stream(PRIVATE_VENTURE_STREAM_KEY);
    const a = generatePrivateVentureProposal({
      nationId: "nation_france",
      role: "FIGHTER",
      currentMonth: "1917-05",
      rngStream: rng1,
    });
    const b = generatePrivateVentureProposal({
      nationId: "nation_france",
      role: "FIGHTER",
      currentMonth: "1917-05",
      rngStream: rng2,
    });

    expect(a.proposalHash).not.toBe(b.proposalHash);
  });
});

describe("resolvePrivateVenture", () => {
  it("returns VENTURE_GRANTED with a new proposal when eligible", () => {
    const rng = new RandomEngine("grant-seed").stream(PRIVATE_VENTURE_STREAM_KEY);
    const result = resolvePrivateVenture({
      nationId: "nation_france",
      currentMonth: "1917-05",
      hasPrivateAviationIndustry: true,
      permittedRoles: ["FIGHTER", "DIVE_BOMBER"],
      hasNationalProhibition: false,
      lastVentureMonth: null,
      privateProposals: [],
      rngStream: rng,
    });

    expect(result.event.result).toBe("VENTURE_GRANTED");
    expect(result.newProposal).not.toBeNull();
    expect(result.updatedPrivateProposals.length).toBe(1);
  });

  it("returns VENTURE_INELIGIBLE when conditions not met", () => {
    const rng = new RandomEngine("ineligible").stream(PRIVATE_VENTURE_STREAM_KEY);
    const result = resolvePrivateVenture({
      nationId: "nation_france",
      currentMonth: "1917-05",
      hasPrivateAviationIndustry: false,
      permittedRoles: ["FIGHTER"],
      hasNationalProhibition: false,
      lastVentureMonth: null,
      privateProposals: [],
      rngStream: rng,
    });

    expect(result.event.result).toBe("VENTURE_INELIGIBLE");
    expect(result.newProposal).toBeNull();
  });

  it("returns VENTURE_COOLDOWN when cooldown not complete", () => {
    const rng = new RandomEngine("cooldown").stream(PRIVATE_VENTURE_STREAM_KEY);
    const result = resolvePrivateVenture({
      nationId: "nation_france",
      currentMonth: "1917-05",
      hasPrivateAviationIndustry: true,
      permittedRoles: ["FIGHTER"],
      hasNationalProhibition: false,
      lastVentureMonth: "1917-01",
      privateProposals: [],
      rngStream: rng,
    });

    expect(result.event.result).toBe("VENTURE_INELIGIBLE");
    expect(result.event.reasonCode).toBe("COOLDOWN_NOT_COMPLETE");
  });

  it("returns VENTURE_LIMIT_REACHED when at max unexpired", () => {
    const rng = new RandomEngine("limit").stream(PRIVATE_VENTURE_STREAM_KEY);
    const proposals = Array.from({ length: PRIVATE_VENTURE_MAX_UNEXPIRED }, (_, i) =>
      pendingProposal({ proposalId: `existing_${i}` }),
    );
    const result = resolvePrivateVenture({
      nationId: "nation_france",
      currentMonth: "1917-05",
      hasPrivateAviationIndustry: true,
      permittedRoles: ["FIGHTER"],
      hasNationalProhibition: false,
      lastVentureMonth: null,
      privateProposals: proposals,
      rngStream: rng,
    });

    expect(result.event.result).toBe("VENTURE_INELIGIBLE");
    expect(result.event.reasonCode).toBe("MAX_UNEXPIRED_LIMIT_REACHED");
  });

  it("produces deterministic output for same inputs", () => {
    const baseInput = {
      nationId: "nation_france",
      currentMonth: "1917-05",
      hasPrivateAviationIndustry: true,
      permittedRoles: ["FIGHTER", "DIVE_BOMBER", "PATROL_AIRCRAFT"] as const,
      hasNationalProhibition: false,
      lastVentureMonth: null,
      privateProposals: [],
    };

    const rng1 = new RandomEngine("deterministic-grant").stream(PRIVATE_VENTURE_STREAM_KEY);
    const rng2 = new RandomEngine("deterministic-grant").stream(PRIVATE_VENTURE_STREAM_KEY);
    const a = resolvePrivateVenture({ ...baseInput, rngStream: rng1 });
    const b = resolvePrivateVenture({ ...baseInput, rngStream: rng2 });

    expect(a.event.eventHash).toBe(b.event.eventHash);
    expect(a.newProposal?.proposalHash).toBe(b.newProposal?.proposalHash);
  });
});

describe("purchasePrivateProposal", () => {
  it("accepts a PENDING proposal with sufficient treasury", () => {
    const proposal = pendingProposal({ productionCost: SafeInt(1500) });
    const result = purchasePrivateProposal(
      proposal,
      SafeInt(5000),
      "france_fighter_mk2",
      "1917-06",
    );

    expect(result.updatedProposal.status).toBe("ACCEPTED");
    expect(result.model.aircraftModelId).toBe("france_fighter_mk2");
    expect(result.model.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(result.cost)).toBe(1500);
  });

  it("throws AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED for non-PENDING proposal", () => {
    const expired = pendingProposal({ status: "EXPIRED" });
    expect(() => purchasePrivateProposal(expired, SafeInt(5000), "mid", "1917-06")).toThrow(
      "AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED",
    );
  });

  it("throws AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT for insufficient treasury", () => {
    const proposal = pendingProposal({ productionCost: SafeInt(2000) });
    expect(() => purchasePrivateProposal(proposal, SafeInt(500), "mid", "1917-06")).toThrow(
      "AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT",
    );
  });
});

describe("expirePrivateProposals", () => {
  it("expires proposals past their expiry month", () => {
    const proposal = pendingProposal({ expiryMonth: "1917-05" });
    const result = expirePrivateProposals([proposal], "1917-06");
    expect(result[0]!.status).toBe("EXPIRED");
  });

  it("leaves proposals within expiry window unchanged", () => {
    const proposal = pendingProposal({ expiryMonth: "1917-06" });
    const result = expirePrivateProposals([proposal], "1917-05");
    expect(result[0]!.status).toBe("PENDING");
  });

  it("expires proposals in the same month as expiry", () => {
    const proposal = pendingProposal({ expiryMonth: "1917-05" });
    const result = expirePrivateProposals([proposal], "1917-05");
    expect(result[0]!.status).toBe("EXPIRED");
  });

  it("leaves non-PENDING proposals unchanged", () => {
    const accepted = pendingProposal({ status: "ACCEPTED", expiryMonth: "1917-05" });
    const result = expirePrivateProposals([accepted], "1917-06");
    expect(result[0]!.status).toBe("ACCEPTED");
  });
});
