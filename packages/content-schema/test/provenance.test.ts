import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { AreaSchema, validateAgainstSchema } from "../src/index.js";

const AREA = { id: "lon", name: "London", type: "land" as const };

const VALID_PROVENANCE = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "Jane's Fighting Ships 1880" }],
};

describe("provenance/confidence as a schema field (CAH-PROV-1)", () => {
  it("accepts an authored provenance record on a core collection value", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { ...AREA, provenance: VALID_PROVENANCE },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    expect(out).toBeDefined();
  });

  it("rejects an invalid confidence label naming the file and field path", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { ...AREA, provenance: { ...VALID_PROVENANCE, confidence: "SURE" } },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(out).toBeUndefined();
    const diagnostic = collector.errors[0]!;
    expect(diagnostic.code).toBe("SCHEMA");
    expect(diagnostic.message).toContain("Area.provenance.confidence");
  });

  it("rejects an invalid source status naming the file and field path", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { ...AREA, provenance: { ...VALID_PROVENANCE, sourceStatus: "MAYBE" } },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(out).toBeUndefined();
    expect(collector.errors[0]!.message).toContain("Area.provenance.sourceStatus");
  });
});
