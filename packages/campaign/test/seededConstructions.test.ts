import { SafeInt } from "@bluewave/contracts";
import type { ShipBuildingCatalogue } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  materialiseSeededConstructions,
  SEEDED_PROJECT_WITHOUT_CAPACITY,
} from "../src/seededConstructions.js";
import type { CompiledDesignVersion, NationState } from "../src/state.js";

const BALANCE = {
  launchHullShareBp: 1_000,
  fitOutHullShareBp: 1_000,
  trialsShareBp: 500,
  acceptanceShareBp: 500,
  buildMonthsByDisplacementT: {
    points: [
      [0, 12],
      [20_000, 12],
    ],
  },
  buildTimeEraBp: {
    points: [
      [1880, 10_000],
      [1900, 10_000],
    ],
  },
  accelerationTimeBp: 5_000,
};

const PROFILE = {
  nationId: "uk",
  activeFrom: "1880-01",
  activeUntil: null,
  industrialProfile: {
    buildTimeMultiplierBp: 10_000,
    costMultiplierBp: 10_000,
    machineryReliabilityBp: 10_000,
    constructionQualityVarianceBp: 10_000,
    maxPracticalDisplacementKg: [],
    heavyGunProduction: "UNAVAILABLE",
    armourPlateProduction: "DOMESTIC",
    provenance: {},
  },
};

function nation(): NationState {
  return {
    id: "uk",
    name: "United Kingdom",
    tag: "UK",
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: "uk",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [
      {
        id: "c1",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "t1",
        designVersionId: "d1",
        totalWork: SafeInt(10),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: "ACTIVE",
        startedAt: "1880-01",
      },
    ],
    isPlayable: true,
    isAI: false,
  };
}

function design(): CompiledDesignVersion {
  return {
    designVersionId: "d1",
    designFamilyId: "f1",
    className: "C",
    nationId: "uk",
    hullType: "BB",
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(1),
    normalizedArmorUm: SafeInt(1),
    hitPoints: SafeInt(10),
    mainGunsCaliber: SafeInt(1),
    mainGunsCount: SafeInt(1),
    machineryType: "coal",
    crewComplement: SafeInt(1),
    contentVersion: "0",
    compiledHash: "h",
  };
}

function catalogue(): ShipBuildingCatalogue {
  return {
    components: [],
    plants: [],
    hullForms: [],
    balance: { construction: BALANCE },
    navalProfiles: [PROFILE],
    armament: { gunFamilies: [], gunModels: [], gunMounts: [], ammunition: [] },
    referenceDesigns: [],
  };
}

function materialise(shipBuilding: ShipBuildingCatalogue) {
  const collector = new DiagnosticCollector();
  materialiseSeededConstructions(
    new Map([["uk", nation()]]),
    new Map([["d1", design()]]),
    shipBuilding,
    "1880-01",
    collector,
  );
  return collector;
}

describe("materialiseSeededConstructions failures", () => {
  it("reports the invariant cause and code instead of a fabricated capacity message", () => {
    const collector = materialise(catalogue());
    const error = collector.errors.find((d) => d.code === SEEDED_PROJECT_WITHOUT_CAPACITY);
    expect(error?.message).toContain("cannot obtain its main armament");
    expect(error?.message).toContain("SHIP_DESIGN_INVARIANT_FAILED");
  });

  it("rethrows an untagged plan failure instead of turning it into a diagnostic", () => {
    const broken: ShipBuildingCatalogue = {
      ...catalogue(),
      balance: {
        construction: { ...BALANCE, buildMonthsByDisplacementT: { points: [] } },
      },
    };
    expect(() => materialise(broken)).toThrow(Error);
  });
});
