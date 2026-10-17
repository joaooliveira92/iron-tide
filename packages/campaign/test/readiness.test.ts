import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  createFixtureDir,
  nationsYaml,
  writeFixture,
  type FixtureDir,
} from "@bluewave/test-support";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CampaignCompiler, type CampaignCompilerInput } from "../src/compiler-public.js";
import { SafeInt } from "@bluewave/contracts";
import {
  crewCeilingFor,
  rampCrewQuality,
  readinessAfterCrewRamp,
  resolveShipReadinessSeed,
  SHIP_READINESS_CODES,
} from "../src/readiness.js";

const FIXTURE = {
  pack: JSON.stringify({
    name: "readiness-fixture",
    version: "0.1.0",
    type: "fixture",
    files: {
      rulesets: ["rulesets.yaml"],
      countries: ["countries.yaml"],
      areas: ["areas.yaml"],
      routes: ["routes.yaml"],
      possessions: ["possessions.yaml"],
      ports: ["ports.yaml"],
      technologies: ["technologies.yaml"],
    },
  }),
  rulesets: `- id: "core"\n  name: "Core Rules"\n  version: "1.0"\n`,
  countries: nationsYaml([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true },
    { id: "france", tag: "FRA", name: "France" },
  ]),
  areas: `- id: "lon"\n  name: "London"\n  type: "land"\n  controller: "uk"\n- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n`,
  routes: `- id: "lon-par"\n  from: "lon"\n  to: "par"\n  type: "sea"\n  distance: 300\n`,
  possessions: `- id: "gbr-lon"\n  nationId: "uk"\n  areaId: "lon"\n- id: "fra-par"\n  nationId: "france"\n  areaId: "par"\n`,
  ports: `- id: "port-lon"\n  name: "Port of London"\n  areaId: "lon"\n  nationId: "uk"\n  level: 5\n`,
  technologies: `- id: "basic_steam"\n  name: "Basic Steam Turbine"\n  category: "propulsion"\n  cost: 100\n  year: 1880\n`,
  economies: `- nationId: "uk"\n  treasury: 800\n  income: 150\n  expenses: 75\n- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n`,
  constructions: `[]\n`,
  diplomacy: `- nationA: "uk"\n  nationB: "france"\n  relation: "neutral"\n  since: "1880-01"\n`,
  research: `[]\n`,
};

function fleetsYaml(ships: string): string {
  return `- id: "fleet-gbr-home"\n  nationId: "uk"\n  name: "Home Fleet"\n  locationAreaId: "lon"\n  ships:\n${ships}`;
}

function shipYaml(id: string, opts: { underConstruction?: boolean; extra?: string } = {}): string {
  const underConstruction = opts.underConstruction ?? false;
  return `    - id: "${id}"\n      name: "${id}"\n      classId: "battleship"\n      hitPoints: 100\n      maxHitPoints: 100\n      speed: 21\n      firepower: 10\n      armor: 12\n      isUnderConstruction: ${underConstruction}\n      constructionProgress: 0\n      constructionTotalWork: 0\n${opts.extra ?? ""}`;
}

function baseInput(dir: string): CompilerInput {
  return {
    manifestPath: resolve(dir, "pack.json"),
    contentDir: dir,
    rulesetFiles: ["rulesets.yaml"],
    countryFiles: ["countries.yaml"],
    areaFiles: ["areas.yaml"],
    routeFiles: ["routes.yaml"],
    possessionFiles: ["possessions.yaml"],
    portFiles: ["ports.yaml"],
    technologyFiles: ["technologies.yaml"],
    fleetFiles: ["fleets.yaml"],
    economyFiles: ["economies.yaml"],
    constructionFiles: ["constructions.yaml"],
    diplomacyFiles: ["diplomacy.yaml"],
    researchFiles: ["research.yaml"],
    designFiles: [],
  };
}

let fixture: FixtureDir | undefined;

function compileFleets(
  fleets: string,
  options: Partial<CampaignCompilerInput> = {},
): { collector: DiagnosticCollector; output: ReturnType<CampaignCompiler["compile"]> } {
  fixture = createFixtureDir(resolve(tmpdir(), `bw-readiness-${String(Date.now())}`));
  const dir = fixture.path;
  writeFixture(dir, "pack.json", FIXTURE.pack);
  writeFixture(dir, "rulesets.yaml", FIXTURE.rulesets);
  writeFixture(dir, "countries.yaml", FIXTURE.countries);
  writeFixture(dir, "areas.yaml", FIXTURE.areas);
  writeFixture(dir, "routes.yaml", FIXTURE.routes);
  writeFixture(dir, "possessions.yaml", FIXTURE.possessions);
  writeFixture(dir, "ports.yaml", FIXTURE.ports);
  writeFixture(dir, "technologies.yaml", FIXTURE.technologies);
  writeFixture(dir, "economies.yaml", FIXTURE.economies);
  writeFixture(dir, "constructions.yaml", FIXTURE.constructions);
  writeFixture(dir, "diplomacy.yaml", FIXTURE.diplomacy);
  writeFixture(dir, "research.yaml", FIXTURE.research);
  writeFixture(dir, "fleets.yaml", fleets);

  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const artifact = buildContentBundleArtifact(baseInput(dir), signal, collector);
  if (!artifact) return { collector, output: undefined };
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: "3.0.0",
      ...options,
    },
    signal,
    collector,
  );
  return { collector, output };
}

afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

describe("S-1 ticket 01: per-ship readiness and crew quality", () => {
  it("derives ACTIVE/ceiling for a commissioned ship and WORKING_UP for an under-construction ship", () => {
    const { collector, output } = compileFleets(
      fleetsYaml(`${shipYaml("ship-a")}${shipYaml("ship-b", { underConstruction: true })}`),
    );

    expect(collector.hasErrors).toBe(false);
    expect(output).toBeDefined();

    const ships = output!.state.snapshot.nations.get("uk")!.fleets[0]!.ships;
    const byId = new Map(ships.map((s) => [s.id, s]));

    expect(byId.get("ship-a")!.readiness).toBe("ACTIVE");
    expect(byId.get("ship-a")!.crewQuality).toBe(100);
    expect(byId.get("ship-b")!.readiness).toBe("WORKING_UP");
    expect(byId.get("ship-b")!.crewQuality).toBe(0);
  });

  it("honours a validated authored readiness/crew seed", () => {
    const { collector, output } = compileFleets(
      fleetsYaml(
        shipYaml("ship-a", {
          extra: `      readiness: "RESERVE"\n      crewQuality: 42\n`,
        }),
      ),
    );

    expect(collector.hasErrors).toBe(false);
    const ship = output!.state.snapshot.nations.get("uk")!.fleets[0]!.ships[0]!;
    expect(ship.readiness).toBe("RESERVE");
    expect(ship.crewQuality).toBe(42);
  });

  it("rejects an unknown readiness state at the compile boundary", () => {
    const { collector, output } = compileFleets(
      fleetsYaml(shipYaml("ship-a", { extra: `      readiness: "BOGUS"\n` })),
    );

    expect(output).toBeUndefined();
    expect(collector.errors.map((e) => e.code)).toContain(SHIP_READINESS_CODES.unknownState);
  });

  it("rejects a non-integer or out-of-range crew quality at the compile boundary", () => {
    const outOfRange = compileFleets(
      fleetsYaml(shipYaml("ship-a", { extra: `      crewQuality: 150\n` })),
    );
    expect(outOfRange.output).toBeUndefined();
    expect(outOfRange.collector.errors.map((e) => e.code)).toContain(
      SHIP_READINESS_CODES.crewQuality,
    );

    const nonInteger = compileFleets(
      fleetsYaml(shipYaml("ship-a", { extra: `      crewQuality: 1.5\n` })),
    );
    expect(nonInteger.output).toBeUndefined();
    expect(nonInteger.collector.errors.map((e) => e.code)).toContain(
      SHIP_READINESS_CODES.crewQuality,
    );
  });

  it("rejects an excess key on a ship record", () => {
    // The content boundary rejects the unknown key first (strict decode) ...
    const viaContent = compileFleets(
      fleetsYaml(shipYaml("ship-a", { extra: `      classQ: "x"\n` })),
    );
    expect(viaContent.output).toBeUndefined();
    expect(viaContent.collector.errors.map((e) => e.code)).toContain("SCHEMA");

    // ... and the campaign compile boundary carries a `_tag`-discriminated backstop.
    const seed = resolveShipReadinessSeed(
      { id: "ship-a", isUnderConstruction: false, classQ: "x" },
      "ship-a",
    );
    expect(seed.ok).toBe(false);
    if (!seed.ok) {
      expect(seed.error._tag).toBe("ShipReadinessFailure");
      expect(seed.error.code).toBe(SHIP_READINESS_CODES.excessKey);
    }
  });
});

describe("S-1 crew-quality ramp constants and helpers (ticket 03)", () => {
  it("ramps toward the state ceiling, clamped, and never leaves 0..100", () => {
    // ACTIVE at ceiling stays; below ceiling climbs; above ceiling falls back.
    expect(rampCrewQuality(SafeInt(100), "ACTIVE") as number).toBe(100);
    expect(rampCrewQuality(SafeInt(55), "ACTIVE") as number).toBe(60);
    expect(rampCrewQuality(SafeInt(70), "MOTHBALLED" as const) as number).toBe(65);
    // A laid-up crew climbs toward its lower ceiling and clamps there.
    expect(rampCrewQuality(SafeInt(28), "MOTHBALLED") as number).toBe(30);
    expect(crewCeilingFor("RESERVE") as number).toBe(70);
    expect(crewCeilingFor("MOTHBALLED") as number).toBe(30);
  });

  it("promotes a working-up ship at the decent threshold and never returns it to working up", () => {
    expect(readinessAfterCrewRamp("WORKING_UP", SafeInt(59))).toBe("WORKING_UP");
    expect(readinessAfterCrewRamp("WORKING_UP", SafeInt(60))).toBe("ACTIVE");
    expect(readinessAfterCrewRamp("ACTIVE", SafeInt(100))).toBe("ACTIVE");
    expect(readinessAfterCrewRamp("RESERVE", SafeInt(70))).toBe("RESERVE");
  });
});
