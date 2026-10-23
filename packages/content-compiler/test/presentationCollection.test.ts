import { describe, it, expect } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { CompilerInput } from "../src/index.js";
import { Compiler, buildFullSurfaceInput } from "../src/index.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-presentation-"));
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFixture(base: string, rel: string, content: string): void {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

const EMPTY_INPUT: Omit<CompilerInput, "manifestPath" | "contentDir"> = {
  rulesetFiles: [],
  countryFiles: [],
  areaFiles: [],
  routeFiles: [],
  possessionFiles: [],
  portFiles: [],
  technologyFiles: [],
};

function compile(contentDir: string, groups: Partial<CompilerInput>): DiagnosticCollector {
  const collector = new DiagnosticCollector();
  new Compiler().compile(
    { manifestPath: "pack.json", contentDir, ...EMPTY_INPUT, ...groups },
    new AbortController().signal,
    collector,
  );
  return collector;
}

const PRESENTATION = `
nations:
  - countryId: "gb"
    nationId: "uk"
    code: "GBR"
    markerColour: "#c8102e"
    coordinates: { lat: 51.5, lng: -0.1, label: "London" }
    flavor: { name: "United Kingdom", economy: "E", military: "M", diplomacy: "D" }
    dossier:
      appointmentTitle: "First Sea Lord"
      doctrine: "Global sea control"
      strategicRegions: "North Sea"
      budgetCategory: "Very Large"
      shipbuildingCapacity: "World-leading"
      researchStrengths: "Gunnery"
      researchWeaknesses: "Overstretched"
      nationalCharacteristics: "Worldwide deployment"
      likelyRivals: ["Germany"]
      difficulty: 5
  - countryId: "de"
    nationId: "germany"
    code: "DEU"
    markerColour: "#111111"
    coordinates: { lat: 52.5, lng: 13.4, label: "Berlin" }
    flavor: { name: "German Empire", economy: "E", military: "M", diplomacy: "D" }
    dossier:
      appointmentTitle: "State Secretary"
      doctrine: "Risk fleet"
      strategicRegions: "North Sea"
      budgetCategory: "Large"
      shipbuildingCapacity: "Advanced"
      researchStrengths: "Metallurgy"
      researchWeaknesses: "Basing"
      nationalCharacteristics: "Rapid expansion"
      likelyRivals: ["United Kingdom"]
      difficulty: 4
regions:
  regions:
    - { id: "northern_europe", label: "Northern Europe" }
    - { id: "mediterranean", label: "The Mediterranean" }
  areaRegion:
    eng_home_coast: northern_europe
    med_malta: mediterranean
mapJoin:
  campaignAreaToFixture:
    eng_home_coast: area_north_sea
    med_malta: area_mediterranean
  nationHue:
    uk: 15
    germany: 60
  nationLabel:
    uk: Britain
    germany: Germany
  nationHomeArea:
    uk: eng_home_coast
    germany: ger_baltic_coast
`;

describe("presentation collections through the compiler (CAH-PRES-1/CAH-PRES-2)", () => {
  it("carries a declared presentation file into the bundle, preserving authored order", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(fixture.path, "presentation.yaml", PRESENTATION);
      const collector = compile(fixture.path, {
        presentationFiles: [resolve(fixture.path, "presentation.yaml")],
      });
      expect(collector.hasErrors).toBe(false);
      const bundle = new Compiler().compile(
        {
          manifestPath: "pack.json",
          contentDir: fixture.path,
          ...EMPTY_INPUT,
          presentationFiles: [resolve(fixture.path, "presentation.yaml")],
        },
        new AbortController().signal,
        new DiagnosticCollector(),
      )?.bundle;
      expect(bundle?.presentation?.nations.map((n) => n.countryId)).toEqual(["gb", "de"]);
      expect(bundle?.presentation?.regions.areaRegion["eng_home_coast"]).toBe("northern_europe");
      expect(bundle?.presentation?.mapJoin.nationHue["germany"]).toBe(60);
    } finally {
      fixture.cleanup();
    }
  });

  it("omits the presentation section when the input declares none", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      const output = new Compiler().compile(
        { manifestPath: "pack.json", contentDir: fixture.path, ...EMPTY_INPUT },
        new AbortController().signal,
        new DiagnosticCollector(),
      );
      expect(output?.bundle.presentation).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("fails a malformed presentation record naming the file and field path", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "presentation.yaml",
        PRESENTATION.replace("lat: 51.5", 'lat: "north"'),
      );
      const collector = compile(fixture.path, {
        presentationFiles: [resolve(fixture.path, "presentation.yaml")],
      });
      expect(collector.hasErrors).toBe(true);
      const error = collector.errors.find((d) => d.code === "SCHEMA")!;
      expect(error.message).toContain("nations.0.coordinates.lat");
      expect(error.sourceLocation?.path).toContain("presentation.yaml");
    } finally {
      fixture.cleanup();
    }
  });

  it("maps the manifest 'presentation' declaration onto the full-surface input", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "t",
          version: "0.1.0",
          type: "fixture",
          files: { presentation: ["presentation.yaml"] },
        }),
      );
      writeFixture(fixture.path, "presentation.yaml", PRESENTATION);
      const input = buildFullSurfaceInput(
        resolve(fixture.path, "pack.json"),
        fixture.path,
        new DiagnosticCollector(),
      );
      expect(input!.presentationFiles).toEqual([resolve(fixture.path, "presentation.yaml")]);
    } finally {
      fixture.cleanup();
    }
  });

  it("fails an area with no presentation region instead of silently grouping it (CAH-PRES-2)", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "areas.yaml",
        "- id: eng_home_coast\n  name: English Home Waters\n  type: coastal\n" +
          "- id: new_area\n  name: New Area\n  type: sea\n",
      );
      writeFixture(fixture.path, "presentation.yaml", PRESENTATION);
      const collector = compile(fixture.path, {
        areaFiles: [resolve(fixture.path, "areas.yaml")],
        presentationFiles: [resolve(fixture.path, "presentation.yaml")],
      });
      expect(collector.hasErrors).toBe(true);
      const error = collector.errors.find((d) => d.code === "PRESENTATION_REGION")!;
      expect(error.message).toContain("new_area");
      expect(error.sourceLocation?.path).toContain("presentation.yaml");
    } finally {
      fixture.cleanup();
    }
  });

  it("fails a region mapping to an undeclared region", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "areas.yaml",
        "- id: eng_home_coast\n  name: English Home Waters\n  type: coastal\n",
      );
      writeFixture(
        fixture.path,
        "presentation.yaml",
        PRESENTATION.replace("eng_home_coast: northern_europe", "eng_home_coast: atlantis"),
      );
      const collector = compile(fixture.path, {
        areaFiles: [resolve(fixture.path, "areas.yaml")],
        presentationFiles: [resolve(fixture.path, "presentation.yaml")],
      });
      expect(collector.hasErrors).toBe(true);
      const error = collector.errors.find((d) => d.code === "PRESENTATION_REGION")!;
      expect(error.message).toContain("atlantis");
    } finally {
      fixture.cleanup();
    }
  });

  it("fails an area with no campaign-map fixture mapping", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "t", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(
        fixture.path,
        "areas.yaml",
        "- id: eng_home_coast\n  name: English Home Waters\n  type: coastal\n" +
          "- id: new_area\n  name: New Area\n  type: sea\n",
      );
      writeFixture(
        fixture.path,
        "presentation.yaml",
        PRESENTATION.replace("med_malta: mediterranean", "new_area: mediterranean"),
      );
      const collector = compile(fixture.path, {
        areaFiles: [resolve(fixture.path, "areas.yaml")],
        presentationFiles: [resolve(fixture.path, "presentation.yaml")],
      });
      expect(collector.hasErrors).toBe(true);
      const error = collector.errors.find((d) => d.code === "PRESENTATION_REGION")!;
      expect(error.message).toContain("fixture mapping");
    } finally {
      fixture.cleanup();
    }
  });
});
