import { describe, expect, it } from "vite-plus/test";

import {
  REFERENCE_PROVENANCE_FIELDS,
  REFERENCE_VALUE_STATUSES,
  ReferenceDesignSchema,
  ReferenceValueProvenanceSchema,
} from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

const VALUE = {
  value: "9,387 t normal (Thunderer 9,390)",
  status: "DERIVED" as const,
  sources: [{ title: "navypedia.org (uk/brit_bb1_devastation.html)" }],
};

const PROVENANCE = {
  completionDate: VALUE,
  displacementBasis: VALUE,
  armourScheme: VALUE,
  armamentConfiguration: VALUE,
  machineryOutput: VALUE,
  speed: VALUE,
};

const DESIGN = {
  id: "devastator_1873",
  name: "Devastation (1873, turret ironclad)",
  month: "1880-01",
  historical: true,
  draft: {
    nationId: "uk",
    requirement: {
      category: "B",
      requiredSpeedMilliKnots: 13_800,
      cruiseSpeedMilliKnots: 8_000,
      requiredRangeNm: 4_700,
      designThreatId: "rml_10in",
      modernizationExpectation: "MINOR",
      crewQualityBp: 10_000,
      accommodationStandard: "STANDARD",
      protectionGoal: "STANDARD",
    },
    hull: {
      hullFormId: "coast_defence_form",
      lengthWl: 86_900,
      beam: 19_000,
      draught: 8_400,
      depthToMainDeck: 10_800,
      blockCoeffBp: 6_200,
      materialId: "iron",
      structuralSchemeId: "mixed",
      subdivisionGrade: 2,
      targetDisplacementKg: 9_387_000,
      limitDisplacementKg: null,
      designMarginBp: 300,
      growthReserveBp: 300,
    },
    machinery: {
      plantId: "compound_cylindrical",
      installedKw: 5_700,
      zoneId: "CENTRAL_MACHINERY",
      stationPermille: 400,
      fuelCapacityKg: 1_600_000,
      fuelZoneId: "CENTRAL_MACHINERY",
      fuelStationPermille: 450,
      foulingBp: 0,
    },
    armour: { regions: [], citadelLengthMm: 0, torpedoWarheadKg: 30, bunkerProtectionBp: 0 },
    placements: [],
  },
  provenance: PROVENANCE,
};

describe("reference-design provenance shape", () => {
  it("models exactly the six required facts in report order", () => {
    expect(REFERENCE_PROVENANCE_FIELDS).toEqual([
      "completionDate",
      "displacementBasis",
      "armourScheme",
      "armamentConfiguration",
      "machineryOutput",
      "speed",
    ]);
  });

  it("accepts a historical design with full provenance", () => {
    expect(decodeOk(ReferenceDesignSchema, DESIGN)).toBe(true);
  });

  it("accepts a non-historical design with no provenance", () => {
    const { provenance: _drop, ...nonHistorical } = DESIGN;
    expect(decodeOk(ReferenceDesignSchema, { ...nonHistorical, historical: false })).toBe(true);
    expect(decodeOk(ReferenceDesignSchema, nonHistorical)).toBe(true);
  });

  it("rejects an unknown provenance status", () => {
    expect(
      decodeOk(ReferenceDesignSchema, {
        ...DESIGN,
        provenance: { ...PROVENANCE, speed: { ...VALUE, status: "SINGLE-SOURCE" } },
      }),
    ).toBe(false);
  });

  it("rejects a provenance record missing one of the six facts", () => {
    const { speed: _drop, ...incomplete } = PROVENANCE;
    expect(decodeOk(ReferenceDesignSchema, { ...DESIGN, provenance: incomplete })).toBe(false);
  });

  it("rejects a value with no source", () => {
    expect(
      decodeOk(ReferenceDesignSchema, {
        ...DESIGN,
        provenance: { ...PROVENANCE, speed: { ...VALUE, sources: [] } },
      }),
    ).toBe(false);
  });

  it("rejects an excess key on a value (strict boundary)", () => {
    expect(
      decodeOk(ReferenceDesignSchema, {
        ...DESIGN,
        provenance: { ...PROVENANCE, speed: { ...VALUE, confidence: "HIGH" } },
      }),
    ).toBe(false);
  });

  it("exposes the three-value status vocabulary a historical value may use", () => {
    expect(REFERENCE_VALUE_STATUSES).toEqual(["VERIFIED", "DERIVED", "ESTIMATE"]);
    for (const status of REFERENCE_VALUE_STATUSES)
      expect(decodeOk(ReferenceValueProvenanceSchema, { ...VALUE, status })).toBe(true);
  });
});
