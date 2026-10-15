import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { AreaSchema, validateAgainstSchema } from "../src/index.js";

describe("validateAgainstSchema (Effect Schema)", () => {
  it("returns the decoded value on success", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { id: "lon", name: "London", type: "land" },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(out).toEqual({ id: "lon", name: "London", type: "land" });
    expect(collector.hasErrors).toBe(false);
  });

  it("emits a SCHEMA diagnostic for a strict-excess failure", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { id: "lon", name: "London", type: "land", extra: 1 },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(out).toBeUndefined();
    expect(collector.errors).toHaveLength(1);
    const diagnostic = collector.errors[0]!;
    expect(diagnostic.code).toBe("SCHEMA");
    expect(diagnostic.stage).toBe("validate");
    expect(diagnostic.sourceLocation).toEqual({ path: "areas.yaml", line: 1 });
    expect(diagnostic.message).toContain("Validation failed for Area.extra");
    expect(diagnostic.message).toContain("Expected no excess property");
  });

  it("emits a SCHEMA diagnostic with a remediation hint for a missing key", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(
      { name: "London", type: "land" },
      AreaSchema,
      "Area",
      "areas.yaml",
      collector,
    );
    expect(out).toBeUndefined();
    expect(collector.errors).toHaveLength(1);
    const diagnostic = collector.errors[0]!;
    expect(diagnostic.code).toBe("SCHEMA");
    expect(diagnostic.message).toContain("Validation failed for Area.id");
    expect(diagnostic.message).toContain("Missing key");
    expect(diagnostic.remediation).toBe("Add missing field 'id'");
  });

  it("uses (root) when the failure is not attached to a property path", () => {
    const collector = new DiagnosticCollector();
    const out = validateAgainstSchema(42, AreaSchema, "Area", "areas.yaml", collector);
    expect(out).toBeUndefined();
    expect(collector.errors).toHaveLength(1);
    expect(collector.errors[0]!.message).toContain("Validation failed for Area.(root)");
  });
});
