import { describe, expect, it } from "vite-plus/test";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { collectProvenanceLocations, countConfidence } from "../src/confidence.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");

function buildProductionBundle(): ContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  expect(collector.hasErrors).toBe(false);
  expect(output).toBeDefined();
  return output!.bundle;
}

describe("confidence report (CAH-PROV-2)", () => {
  it("counts each confidence level per collection over a hand-built bundle", () => {
    const bundle: ContentBundle = {
      generatedBy: "test",
      manifest: {},
      rulesets: [],
      nations: [],
      areas: [
        {
          id: "a",
          name: "A",
          type: "land",
          provenance: { confidence: "HIGH", sourceStatus: "VERIFIED" },
        },
        {
          id: "b",
          name: "B",
          type: "land",
          provenance: { confidence: "LOW", sourceStatus: "ESTIMATE" },
        },
      ],
      routes: [],
      possessions: [],
      ports: [],
      technologies: [],
      shipBuilding: {
        components: [
          {
            id: "c",
            provenance: { confidence: "MEDIUM", sourceStatus: "DERIVED" },
            nested: { provenance: { confidence: "MEDIUM", sourceStatus: "DERIVED" } },
          },
        ],
        plants: [],
        hullForms: [],
        balance: null,
        navalProfiles: [],
        armament: { gunFamilies: [], gunModels: [], gunMounts: [], ammunition: [] },
        referenceDesigns: [],
      },
    };

    const report = countConfidence(bundle);
    const areas = report.collections.find((c) => c.collection === "areas");
    expect(areas?.counts).toEqual({ HIGH: 1, MEDIUM: 0, LOW: 1, total: 2 });
    const components = report.collections.find((c) => c.collection === "shipBuilding.components");
    expect(components?.counts).toEqual({ HIGH: 0, MEDIUM: 2, LOW: 0, total: 2 });
    expect(report.total).toEqual({ HIGH: 1, MEDIUM: 2, LOW: 1, total: 4 });
  });

  it("reports every provenance record found in the production pack", () => {
    const bundle = buildProductionBundle();
    const report = countConfidence(bundle);
    expect(report.total.total).toBeGreaterThan(0);

    const gunFamilies = report.collections.find(
      (c) => c.collection === "shipBuilding.armament.gunFamilies",
    );
    expect(gunFamilies?.counts.MEDIUM).toBeGreaterThan(0);
    const navalProfiles = report.collections.find(
      (c) => c.collection === "shipBuilding.navalProfiles",
    );
    expect(navalProfiles?.counts.total).toBeGreaterThan(0);

    const shipTypes = report.collections.find(
      (c) => c.collection === "shipBuilding.partModel.shipTypes",
    );
    expect(shipTypes?.counts.total).toBe(14);

    const locations = collectProvenanceLocations(bundle);
    expect(locations.length).toBe(report.total.total);
    expect(locations.every((l) => typeof l.collection === "string")).toBe(true);
  });
});
