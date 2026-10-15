// AC-5, AC-6, AC-7 (INC-3): Development request command, proposal slot,
// project lifecycle.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  assertValidDevelopmentRole,
  assertNoActiveProposal,
  createDevelopmentProject,
  advanceAircraftDevelopment,
  computeDevelopmentProjectHash,
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
    completedPaidMonths: SafeInt(0),
    monthlyCost: SafeInt(2000),
    technologyInputHash: "a".repeat(64),
    nationalTraitInputHash: "b".repeat(64),
    designStreamKey: "aircraft/development/nation/nation_france/FIGHTER/proposal",
    status: "REQUESTED",
    finalProposalId: null,
    rulesetVersion: "aircraft_ruleset_v1",
    formulaVersion: "aircraft_formula_v1",
    projectHash: "",
    ...overrides,
  };
}

describe("AC-5: assertValidDevelopmentRole", () => {
  it("accepts a valid aircraft type", () => {
    expect(() => assertValidDevelopmentRole("FIGHTER")).not.toThrow();
    expect(() => assertValidDevelopmentRole("TORPEDO_BOMBER")).not.toThrow();
  });

  it("rejects an invalid role with AIRCRAFT_DEVELOPMENT_ROLE_INVALID", () => {
    expect(() => assertValidDevelopmentRole("INVALID")).toThrow(
      "AIRCRAFT_DEVELOPMENT_ROLE_INVALID",
    );
  });
});

describe("AC-6: assertNoActiveProposal", () => {
  it("passes when no active proposals exist", () => {
    expect(() =>
      assertNoActiveProposal([
        { ...baseProject(), status: "ACCEPTED" },
        { ...baseProject(), status: "REJECTED" },
      ]),
    ).not.toThrow();
  });

  it("throws AIRCRAFT_PROPOSAL_ALREADY_ACTIVE when an active proposal exists", () => {
    expect(() => assertNoActiveProposal([{ ...baseProject(), status: "REQUESTED" }])).toThrow(
      "AIRCRAFT_PROPOSAL_ALREADY_ACTIVE",
    );
  });

  it("throws for DEVELOPING status", () => {
    expect(() => assertNoActiveProposal([{ ...baseProject(), status: "DEVELOPING" }])).toThrow(
      "AIRCRAFT_PROPOSAL_ALREADY_ACTIVE",
    );
  });

  it("throws for READY_FOR_REVIEW status", () => {
    expect(() =>
      assertNoActiveProposal([{ ...baseProject(), status: "READY_FOR_REVIEW" }]),
    ).toThrow("AIRCRAFT_PROPOSAL_ALREADY_ACTIVE");
  });
});

describe("AC-7: createDevelopmentProject", () => {
  it("creates a project with REQUESTED status and hash", () => {
    const { project, monthlyCost } = createDevelopmentProject(
      "nation_france",
      "FIGHTER",
      ["SPEED", "MANEUVERABILITY"],
      "LAND_BASED",
      "1917-05",
      "a".repeat(64),
      "b".repeat(64),
      2,
      2,
      2,
      SafeInt(5000),
    );
    expect(project.status).toBe("REQUESTED");
    expect(project.developmentProjectId).toBe("nation_france_FIGHTER_1917-05");
    expect(project.projectHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(monthlyCost)).toBeGreaterThan(0);
  });

  it("throws AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT for insufficient treasury", () => {
    expect(() =>
      createDevelopmentProject(
        "nation_france",
        "FIGHTER",
        ["SPEED", "MANEUVERABILITY"],
        "LAND_BASED",
        "1917-05",
        "a".repeat(64),
        "b".repeat(64),
        2,
        2,
        2,
        SafeInt(100),
      ),
    ).toThrow("AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT");
  });

  it("throws AIRCRAFT_DEVELOPMENT_ROLE_INVALID for invalid role", () => {
    expect(() =>
      createDevelopmentProject(
        "nation_france",
        "INVALID" as "FIGHTER",
        ["SPEED", "MANEUVERABILITY"],
        "LAND_BASED",
        "1917-05",
        "a".repeat(64),
        "b".repeat(64),
        2,
        2,
        2,
        SafeInt(5000),
      ),
    ).toThrow("AIRCRAFT_DEVELOPMENT_ROLE_INVALID");
  });
});

describe("development project hash", () => {
  it("produces identical hashes for identical projects", () => {
    const p1 = baseProject();
    const p2 = baseProject();
    expect(computeDevelopmentProjectHash(p1)).toBe(computeDevelopmentProjectHash(p2));
  });

  it("produces different hashes for different projects", () => {
    const p1 = baseProject();
    const p2 = baseProject({ requestedRole: "TORPEDO_BOMBER" });
    expect(computeDevelopmentProjectHash(p1)).not.toBe(computeDevelopmentProjectHash(p2));
  });
});

describe("advanceAircraftDevelopment", () => {
  it("advances REQUESTED → DEVELOPING when paid", () => {
    const result = advanceAircraftDevelopment(baseProject(), true);
    expect(result.status).toBe("DEVELOPING");
    expect(Number(result.completedPaidMonths)).toBe(1);
  });

  it("completes when requiredDevelopmentMonths reached", () => {
    const p = baseProject({ completedPaidMonths: SafeInt(3), status: "DEVELOPING" });
    const result = advanceAircraftDevelopment(p, true);
    expect(result.status).toBe("READY_FOR_REVIEW");
    expect(Number(result.completedPaidMonths)).toBe(4);
  });

  it("stays REQUESTED when not paid and status is REQUESTED", () => {
    const result = advanceAircraftDevelopment(baseProject(), false);
    expect(result.status).toBe("REQUESTED");
    expect(Number(result.completedPaidMonths)).toBe(0);
  });

  it("transitions DEVELOPING → DELAYED when not paid", () => {
    const p = baseProject({ completedPaidMonths: SafeInt(1), status: "DEVELOPING" });
    const result = advanceAircraftDevelopment(p, false);
    expect(result.status).toBe("DELAYED");
  });

  it("is no-op for terminal states", () => {
    const cancelled = baseProject({ status: "CANCELLED" });
    expect(advanceAircraftDevelopment(cancelled, true).status).toBe("CANCELLED");

    const accepted = baseProject({ status: "ACCEPTED" });
    expect(advanceAircraftDevelopment(accepted, true).status).toBe("ACCEPTED");

    const rejected = baseProject({ status: "REJECTED" });
    expect(advanceAircraftDevelopment(rejected, true).status).toBe("REJECTED");
  });
});
