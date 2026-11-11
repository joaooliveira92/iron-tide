import {
  availabilityFindings,
  evaluateShipTypeAvailability,
  newConstructionDockEligibility,
  type DockRecord,
  type Finding,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { buildStates, BUILD_STATE_LABEL, type BuildStateKind } from "./buildStates.js";

const mass = (kg: number) => `${kg / 1000} t`;

const dock: DockRecord = {
  maximumNewConstructionMassKg: 8_000_000,
  maximumMajorRepairMassKg: 8_000_000,
  maximumRebuildMassKg: 8_000_000,
  maximumConversionMassKg: 8_000_000,
  dimensions: null,
  emergencyRepairPolicyId: "none",
  dockPolicyVersion: 1,
};

const demand = (displacementKg: number) => ({
  lengthMm: 1,
  beamMm: 1,
  displacementKg,
  heaviestKg: 1,
});

const classification = (id: string, ruleId: string): Finding => ({
  id,
  severity: "BLOCKING",
  what: "The design does not qualify as BB.",
  why: "Displacement too low.",
  consequence: "It cannot be built.",
  remedies: [],
  evidence: { formulaId: "DESIGN-22", inputs: {}, threshold: 0, value: 0 },
  ruleId,
  messageKey: "design.classification.intended_illegal",
  params: { intended: "BB" },
});

const kinds = (states: ReturnType<typeof buildStates>): BuildStateKind[] =>
  states.map((s) => s.kind);

describe("buildStates", () => {
  it("reports nothing for a design the domain accepts", () => {
    expect(buildStates([], null, mass)).toEqual([]);
    expect(buildStates([], newConstructionDockEligibility(dock, demand(8_000_000)), mass)).toEqual(
      [],
    );
  });

  it("separates a locked class from a missing technology using the domain reasons", () => {
    const locked = availabilityFindings(
      evaluateShipTypeAvailability("BB", { month: "1880-01", unlockedTechs: new Set() }),
    );
    const states = buildStates(locked, null, mass);
    expect(kinds(states)).toContain("class-locked");
    const tech = availabilityFindings({
      type: "BB",
      available: false,
      reasons: [
        {
          code: "SHIP_TYPE_TECHNOLOGY_REQUIRED",
          message: "Your navy lacks the ship-design knowledge to build this ship.",
          ruleId: "AVAILABILITY.SHIP_TYPE_TECHNOLOGY_REQUIRED",
          messageKey: "design.availability.technology_required",
          params: { shipType: "BB", techId: "tech_barbette_ironclad" },
        },
      ],
    });
    const techStates = buildStates(tech, null, mass);
    expect(kinds(techStates)).toEqual(["technology-unavailable"]);
    expect(techStates[0]?.text).toContain("tech barbette ironclad");
    expect(techStates[0]?.ruleId).toBe("AVAILABILITY.SHIP_TYPE_TECHNOLOGY_REQUIRED");
  });

  it("maps classification findings to a design-does-not-match-class state", () => {
    const states = buildStates(
      [
        classification("INTENDED_CLASSIFICATION_ILLEGAL", "DESIGN-22.BB.classification"),
        classification("NATURAL_CLASSIFICATION_MISMATCH", "DESIGN-22.BB.precedence"),
        classification("NO_NATURAL_CLASSIFICATION_MATCH", "DESIGN-22.classification.no_match"),
      ],
      null,
      mass,
    );
    expect(kinds(states)).toEqual(["class-mismatch", "class-mismatch", "class-mismatch"]);
    expect(states[0]?.messageKey).toBe("design.classification.intended_illegal");
  });

  it("ignores findings outside the four states", () => {
    expect(
      buildStates([classification("LOW_RESERVE_BUOYANCY", "STABILITY.1")], null, mass),
    ).toEqual([]);
  });

  it("reports a yard that is too small from the dock's required and capacity masses", () => {
    const eligibility = newConstructionDockEligibility(dock, demand(8_000_001));
    const states = buildStates([], eligibility, mass);
    expect(kinds(states)).toEqual(["yard-too-small"]);
    expect(states[0]?.text).toContain("8000.001 t");
    expect(states[0]?.text).toContain("8000 t");
  });

  it("reports a dimension misfit without masses", () => {
    const eligibility = newConstructionDockEligibility(
      {
        ...dock,
        dimensions: { maxLengthMm: 10, maxBeamMm: 10, maxHeaviestComponentKg: 10 },
      },
      { lengthMm: 11, beamMm: 1, displacementKg: 1, heaviestKg: 1 },
    );
    const states = buildStates([], eligibility, mass);
    expect(kinds(states)).toEqual(["yard-too-small"]);
    expect(states[0]?.text.length).toBeGreaterThan(0);
  });

  it("labels each of the four states distinctly", () => {
    expect(new Set(Object.values(BUILD_STATE_LABEL)).size).toBe(4);
  });
});
