import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { PresentationContentSchema, validateAgainstSchema } from "../src/index.js";

const VALID_PRESENTATION = {
  nations: [
    {
      countryId: "gb",
      nationId: "uk",
      code: "GBR",
      markerColour: "#c8102e",
      coordinates: { lat: 51.5, lng: -0.1, label: "London" },
      flavor: { name: "United Kingdom", economy: "E", military: "M", diplomacy: "D" },
      dossier: {
        appointmentTitle: "First Sea Lord",
        doctrine: "Global sea control",
        strategicRegions: "North Sea",
        budgetCategory: "Very Large",
        shipbuildingCapacity: "World-leading",
        researchStrengths: "Gunnery",
        researchWeaknesses: "Overstretched",
        nationalCharacteristics: "Worldwide deployment",
        likelyRivals: ["Germany", "France"],
        difficulty: 5,
      },
    },
  ],
  regions: {
    regions: [{ id: "northern_europe", label: "Northern Europe" }],
    areaRegion: { eng_home_coast: "northern_europe" },
  },
  mapJoin: {
    campaignAreaToFixture: { eng_home_coast: "area_north_sea" },
    nationHue: { uk: 15 },
    nationLabel: { uk: "Britain" },
    nationHomeArea: { uk: "eng_home_coast" },
  },
};

function validate(data: unknown): DiagnosticCollector {
  const collector = new DiagnosticCollector();
  validateAgainstSchema(
    data,
    PresentationContentSchema,
    "PresentationContent",
    "presentation.json",
    collector,
  );
  return collector;
}

describe("presentation content schema (CAH-PRES-1/CAH-PRES-2)", () => {
  it("accepts the authored presentation corpus (positive control)", () => {
    const collector = validate(VALID_PRESENTATION);
    expect(collector.hasErrors).toBe(false);
  });

  it("accepts an optional provenance record on a presentation value", () => {
    const collector = validate({
      ...VALID_PRESENTATION,
      provenance: {
        sourceStatus: "VERIFIED",
        confidence: "HIGH",
        kind: "historical_fact",
        sources: [{ title: "Jane's Fighting Ships 1880" }],
      },
    });
    expect(collector.hasErrors).toBe(false);
  });

  it("rejects a missing required field naming the file and field path", () => {
    const { markerColour: _dropped, ...nation } = VALID_PRESENTATION.nations[0]!;
    const collector = validate({
      ...VALID_PRESENTATION,
      nations: [nation],
    });
    expect(collector.hasErrors).toBe(true);
    const error = collector.errors[0]!;
    expect(error.code).toBe("SCHEMA");
    expect(error.message).toContain("PresentationContent.nations.0.markerColour");
    expect(error.sourceLocation?.path).toBe("presentation.json");
  });

  it("rejects a wrong-typed field naming the file and field path", () => {
    const collector = validate({
      ...VALID_PRESENTATION,
      nations: [
        {
          ...VALID_PRESENTATION.nations[0]!,
          coordinates: { lat: "north", lng: -0.1, label: "London" },
        },
      ],
    });
    expect(collector.hasErrors).toBe(true);
    expect(collector.errors[0]!.message).toContain("PresentationContent.nations.0.coordinates.lat");
  });

  it("rejects an excess key (strict policy, ADR-0105)", () => {
    const collector = validate({
      ...VALID_PRESENTATION,
      nations: [{ ...VALID_PRESENTATION.nations[0]!, motto: "Rule Britannia" }],
    });
    expect(collector.hasErrors).toBe(true);
    expect(collector.errors[0]!.message).toContain("motto");
  });

  it("rejects an out-of-range difficulty value", () => {
    const collector = validate({
      ...VALID_PRESENTATION,
      nations: [
        {
          ...VALID_PRESENTATION.nations[0]!,
          dossier: { ...VALID_PRESENTATION.nations[0]!.dossier, difficulty: 9 },
        },
      ],
    });
    expect(collector.hasErrors).toBe(true);
    expect(collector.errors[0]!.message).toContain(
      "PresentationContent.nations.0.dossier.difficulty",
    );
  });
});
