import { describe, it, expect } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Compiler, buildFullSurfaceInput } from "../src/index.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-campaign-"));
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFixture(base: string, rel: string, content: string): string {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
  return full;
}

function compile(
  contentDir: string,
  groups: Record<string, string[]>,
): {
  output: ReturnType<Compiler["compile"]>;
  collector: DiagnosticCollector;
} {
  const collector = new DiagnosticCollector();
  const output = new Compiler().compile(
    {
      manifestPath: "pack.json",
      contentDir,
      rulesetFiles: [],
      countryFiles: [],
      areaFiles: [],
      routeFiles: [],
      possessionFiles: [],
      portFiles: [],
      technologyFiles: [],
      ...groups,
    },
    new AbortController().signal,
    collector,
  );
  return { output, collector };
}

const jsonDocument = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const designRecord = (): Record<string, unknown> => ({
  designId: "des_a",
  designVersionId: "des_a",
  designFamilyId: "fam_a",
  nationId: "uk",
  className: "Alpha",
  hullType: "ironclad_turret_ship",
  displacementKg: 9000000,
  speedUms: 8,
  armorBeltUm: 300,
  mainGuns: { caliber: 305, count: 4, mounts: 2 },
  machineryType: "reciprocating_compound",
  hitPoints: 40,
  crewComplement: 400,
  familyCreationMonth: "1880-01",
});

const shipRecord = (): Record<string, unknown> => ({
  id: "ship_a",
  name: "Ship A",
  classId: "Alpha",
  designVersionId: "des_a",
  hitPoints: 40,
  maxHitPoints: 40,
  speed: 15,
  firepower: 24,
  armor: 24,
  isUnderConstruction: false,
  constructionProgress: 0,
  constructionTotalWork: 0,
});

const fleetDocument = (ship: Record<string, unknown>): string =>
  jsonDocument([
    {
      id: "fleet_a",
      nationId: "uk",
      name: "Home Fleet",
      locationAreaId: "eng",
      ships: [ship],
    },
  ]);

const DESIGN_A = jsonDocument([designRecord()]);
const FLEET_A = fleetDocument(shipRecord());

describe("campaign-file collections through the compiler", () => {
  it("compiles the campaign collections into the bundle", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
      );
      writeFixture(fixture.path, "fleets.json", FLEET_A);
      writeFixture(fixture.path, "designs.json", DESIGN_A);

      const { output, collector } = compile(fixture.path, {
        fleetFiles: [resolve(fixture.path, "fleets.json")],
        designFiles: [resolve(fixture.path, "designs.json")],
      });

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
      expect(output!.bundle.campaign).toBeDefined();
      expect(output!.bundle.campaign!.fleets).toHaveLength(1);
      expect(output!.bundle.campaign!.designs).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a fleet ship missing a required field instead of defaulting it", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
      );
      const { hitPoints: _omitted, ...withoutHitPoints } = shipRecord();
      writeFixture(fixture.path, "fleets.json", fleetDocument(withoutHitPoints));

      const { output, collector } = compile(fixture.path, {
        fleetFiles: [resolve(fixture.path, "fleets.json")],
      });

      expect(output).toBeUndefined();
      const error = collector.errors.find((d) => d.code === "SCHEMA");
      expect(error?.message).toContain("Fleet");
      expect(error?.message).toContain("hitPoints");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects an excess campaign field instead of dropping it", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
      );
      writeFixture(fixture.path, "fleets.json", fleetDocument({ ...shipRecord(), classQ: 1 }));

      const { output, collector } = compile(fixture.path, {
        fleetFiles: [resolve(fixture.path, "fleets.json")],
      });

      expect(output).toBeUndefined();
      expect(collector.errors.map((d) => d.code)).toContain("SCHEMA");
    } finally {
      fixture.cleanup();
    }
  });

  it("omits campaign from the bundle for a content-pack-only input", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      const { output } = compile(fixture.path, {});
      expect(output).toBeDefined();
      expect(output!.bundle.campaign).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects duplicate campaign ids with the source file", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(fixture.path, "designs.json", jsonDocument([designRecord(), designRecord()]));

      const { output, collector } = compile(fixture.path, {
        designFiles: [resolve(fixture.path, "designs.json")],
      });

      expect(output).toBeUndefined();
      const dup = collector.all.find((d) => d.code === "DUP-ID");
      expect(dup).toBeDefined();
      expect(dup!.message).toContain("des_a");
      expect(dup!.sourceLocation?.path).toContain("designs.json");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a dangling fleet -> design reference with the field path", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      writeFixture(fixture.path, "designs.json", DESIGN_A);
      writeFixture(
        fixture.path,
        "fleets.json",
        fleetDocument({ ...shipRecord(), designVersionId: "des_missing" }),
      );

      const { output, collector } = compile(fixture.path, {
        fleetFiles: [resolve(fixture.path, "fleets.json")],
        designFiles: [resolve(fixture.path, "designs.json")],
      });

      expect(output).toBeUndefined();
      const ref = collector.all.find((d) => d.code === "REF");
      expect(ref).toBeDefined();
      expect(ref!.message).toContain("des_missing");
      expect(ref!.remediation).toContain("ships[].designVersionId");
    } finally {
      fixture.cleanup();
    }
  });

  it("normalizes campaign collections canonically regardless of file order", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
      );
      const construction = (id: string, targetId: string): Record<string, unknown> => ({
        id,
        nationId: "uk",
        type: "ship",
        targetId,
        totalWork: 100,
        completedWork: 0,
        paidWork: 0,
        status: "ACTIVE",
        startedAt: "1880-01",
      });
      writeFixture(
        fixture.path,
        "constructions.json",
        jsonDocument([construction("con_b", "ship_b"), construction("con_a", "ship_a")]),
      );
      const { output } = compile(fixture.path, {
        constructionFiles: [resolve(fixture.path, "constructions.json")],
      });
      expect(output).toBeDefined();
      const ids = output!.bundle.campaign!.constructions.map((c) => (c as { id: string }).id);
      expect(ids).toEqual(["con_a", "con_b"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("buildFullSurfaceInput includes the six campaign-file collections", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "fixture",
          files: {
            fleets: ["fleets.json"],
            economies: ["economies.json"],
            constructions: ["constructions.json"],
            diplomacy: ["diplomacy.json"],
            research: ["research.json"],
            designs: ["designs.json"],
          },
        }),
      );
      for (const name of [
        "fleets.json",
        "economies.json",
        "constructions.json",
        "diplomacy.json",
        "research.json",
        "designs.json",
      ]) {
        writeFixture(fixture.path, name, "[]\n");
      }

      const input = buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path);
      expect(input).toBeDefined();
      expect(input!.fleetFiles).toHaveLength(1);
      expect(input!.economyFiles).toHaveLength(1);
      expect(input!.constructionFiles).toHaveLength(1);
      expect(input!.diplomacyFiles).toHaveLength(1);
      expect(input!.researchFiles).toHaveLength(1);
      expect(input!.designFiles).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });
});
