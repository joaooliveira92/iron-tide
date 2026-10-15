import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { checkPlaceholderGate, collectPlaceholders } from "../src/releaseGate.js";

function emptyBundle(): ContentBundle {
  return {
    generatedBy: "test",
    manifest: {},
    rulesets: [],
    nations: [],
    areas: [],
    routes: [],
    possessions: [],
    ports: [],
    technologies: [],
  };
}

const placeholder = { sourceStatus: "PLACEHOLDER", confidence: "LOW" };

describe("placeholder release gate (CAH-PROV-3)", () => {
  it("fails a shipping pack that contains an unresolved placeholder, naming collection/record/field", () => {
    const bundle = emptyBundle();
    bundle.areas = [{ id: "a1", name: "A", type: "land", provenance: placeholder }];

    const result = checkPlaceholderGate(bundle, []);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { collection: "areas", recordId: "a1", field: "provenance" },
    ]);
  });

  it("names a nested placeholder field path and its owning collection", () => {
    const bundle = emptyBundle();
    bundle.shipBuilding = {
      components: [{ id: "c1", sub: { provenance: placeholder } }],
      plants: [],
      hullForms: [],
      balance: null,
      navalProfiles: [],
      armament: { gunFamilies: [], gunModels: [], gunMounts: [], ammunition: [] },
      referenceDesigns: [],
    };

    expect(collectPlaceholders(bundle)).toEqual([
      { collection: "shipBuilding.components", recordId: "c1", field: "sub.provenance" },
    ]);
  });

  it("does not fail a placeholder on the justified allowlist", () => {
    const bundle = emptyBundle();
    bundle.areas = [{ id: "a1", name: "A", type: "land", provenance: placeholder }];

    const result = checkPlaceholderGate(bundle, [
      {
        collection: "areas",
        recordId: "a1",
        field: "provenance",
        justification: "specific gravity pending a yard manual",
      },
    ]);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.allowed).toHaveLength(1);
  });

  it("treats an allowlist entry without a justification as an error", () => {
    const bundle = emptyBundle();
    bundle.areas = [{ id: "a1", name: "A", type: "land", provenance: placeholder }];

    const result = checkPlaceholderGate(bundle, [
      { collection: "areas", recordId: "a1", field: "provenance", justification: "   " },
    ]);
    expect(result.ok).toBe(false);
    expect(result.invalidAllowlist).toHaveLength(1);
    expect(result.violations).toHaveLength(1);
  });

  it("passes a pack with no placeholders", () => {
    const bundle = emptyBundle();
    bundle.areas = [
      { id: "a1", name: "A", type: "land", provenance: { sourceStatus: "ESTIMATE" } },
    ];
    expect(checkPlaceholderGate(bundle, []).ok).toBe(true);
  });
});
