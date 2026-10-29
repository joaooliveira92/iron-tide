import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { FleetShipSchema } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  FIXTURE_RULESETS_JSON,
  createFixtureDir,
  jsonDocument,
  nationsDocument,
  type FixtureDir,
  writeFixture,
} from "@bluewave/test-support";
import { Result } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CampaignCompiler, type CampaignCompilerInput } from "../src/compiler-public.js";
import { SafeInt } from "@bluewave/contracts";
import {
  crewCeilingFor,
  rampCrewQuality,
  reduceCrewQuality,
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
      rulesets: ["rulesets.json"],
      countries: ["countries.json"],
      areas: ["areas.json"],
      routes: ["routes.json"],
      possessions: ["possessions.json"],
      ports: ["ports.json"],
      technologies: ["technologies.json"],
    },
  }),
  rulesets: FIXTURE_RULESETS_JSON,
  countries: nationsDocument([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
    { id: "france", tag: "FRA", name: "France", homeArea: "par" },
  ]),
  areas: `
[
  {
    "id": "lon",
    "name": "London",
    "type": "land",
    "controller": "uk"
  },
  {
    "id": "par",
    "name": "Paris",
    "type": "land",
    "controller": "france"
  }
]
`,
  routes: `
[
  {
    "id": "lon-par",
    "from": "lon",
    "to": "par",
    "type": "sea",
    "distance": 300
  }
]
`,
  possessions: `
[
  {
    "id": "gbr-lon",
    "nationId": "uk",
    "areaId": "lon"
  },
  {
    "id": "fra-par",
    "nationId": "france",
    "areaId": "par"
  }
]
`,
  ports: `
[
  {
    "id": "port-lon",
    "name": "Port of London",
    "areaId": "lon",
    "nationId": "uk",
    "level": 5
  }
]
`,
  technologies: `
[
  {
    "id": "basic_steam",
    "name": "Basic Steam Turbine",
    "category": "propulsion",
    "cost": 100,
    "year": 1880
  }
]
`,
  economies: `
[
  {
    "nationId": "uk",
    "treasury": 800,
    "income": 150,
    "expenses": 75
  },
  {
    "nationId": "france",
    "treasury": 600,
    "income": 120,
    "expenses": 60
  }
]
`,
  constructions: `[]\n`,
  diplomacy: `
[
  {
    "nationA": "uk",
    "nationB": "france",
    "relation": "neutral",
    "since": "1880-01"
  }
]
`,
  research: `[]\n`,
};

const shipRecord = (
  id: string,
  opts: { underConstruction?: boolean; extra?: Record<string, unknown> } = {},
): Record<string, unknown> => ({
  id,
  name: id,
  classId: "battleship",
  hitPoints: 100,
  maxHitPoints: 100,
  speed: 21,
  firepower: 10,
  armor: 12,
  isUnderConstruction: opts.underConstruction ?? false,
  constructionProgress: 0,
  constructionTotalWork: 0,
  ...opts.extra,
});

function fleetsDocument(ships: readonly Record<string, unknown>[]): string {
  return jsonDocument([
    { id: "fleet-gbr-home", nationId: "uk", name: "Home Fleet", locationAreaId: "lon", ships },
  ]);
}

function baseInput(dir: string): CompilerInput {
  return {
    manifestPath: resolve(dir, "pack.json"),
    contentDir: dir,
    rulesetFiles: ["rulesets.json"],
    countryFiles: ["countries.json"],
    areaFiles: ["areas.json"],
    routeFiles: ["routes.json"],
    possessionFiles: ["possessions.json"],
    portFiles: ["ports.json"],
    technologyFiles: ["technologies.json"],
    fleetFiles: ["fleets.json"],
    economyFiles: ["economies.json"],
    constructionFiles: ["constructions.json"],
    diplomacyFiles: ["diplomacy.json"],
    researchFiles: ["research.json"],
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
  writeFixture(dir, "rulesets.json", FIXTURE.rulesets);
  writeFixture(dir, "countries.json", FIXTURE.countries);
  writeFixture(dir, "areas.json", FIXTURE.areas);
  writeFixture(dir, "routes.json", FIXTURE.routes);
  writeFixture(dir, "possessions.json", FIXTURE.possessions);
  writeFixture(dir, "ports.json", FIXTURE.ports);
  writeFixture(dir, "technologies.json", FIXTURE.technologies);
  writeFixture(dir, "economies.json", FIXTURE.economies);
  writeFixture(dir, "constructions.json", FIXTURE.constructions);
  writeFixture(dir, "diplomacy.json", FIXTURE.diplomacy);
  writeFixture(dir, "research.json", FIXTURE.research);
  writeFixture(dir, "fleets.json", fleets);

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
      fleetsDocument([shipRecord("ship-a"), shipRecord("ship-b", { underConstruction: true })]),
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
      fleetsDocument([shipRecord("ship-a", { extra: { readiness: "RESERVE", crewQuality: 42 } })]),
    );

    expect(collector.hasErrors).toBe(false);
    const ship = output!.state.snapshot.nations.get("uk")!.fleets[0]!.ships[0]!;
    expect(ship.readiness).toBe("RESERVE");
    expect(ship.crewQuality).toBe(42);
  });

  it("rejects an unknown readiness state at the compile boundary", () => {
    const { collector, output } = compileFleets(
      fleetsDocument([shipRecord("ship-a", { extra: { readiness: "BOGUS" } })]),
    );

    expect(output).toBeUndefined();
    expect(collector.errors.map((e) => e.code)).toContain(SHIP_READINESS_CODES.unknownState);
  });

  it("rejects a non-integer or out-of-range crew quality at the compile boundary", () => {
    const outOfRange = compileFleets(
      fleetsDocument([shipRecord("ship-a", { extra: { crewQuality: 150 } })]),
    );
    expect(outOfRange.output).toBeUndefined();
    expect(outOfRange.collector.errors.map((e) => e.code)).toContain(
      SHIP_READINESS_CODES.crewQuality,
    );

    const nonInteger = compileFleets(
      fleetsDocument([shipRecord("ship-a", { extra: { crewQuality: 1.5 } })]),
    );
    expect(nonInteger.output).toBeUndefined();
    expect(nonInteger.collector.errors.map((e) => e.code)).toContain(
      SHIP_READINESS_CODES.crewQuality,
    );
  });

  it("accepts every FleetShipSchema key plus the runtime-only repair counter", () => {
    const record: Record<string, unknown> = Object.fromEntries(
      Object.keys(FleetShipSchema.fields).map((key) => [key, "x"]),
    );
    Object.assign(record, {
      id: "ship-a",
      isUnderConstruction: false,
      readiness: "ACTIVE",
      crewQuality: 50,
    });
    expect(Result.isSuccess(resolveShipReadinessSeed(record, "ship-a"))).toBe(true);
    expect(
      Result.isSuccess(resolveShipReadinessSeed({ ...record, repairMonthsRemaining: 3 }, "ship-a")),
    ).toBe(true);
  });

  it("rejects an excess key on a ship record", () => {
    const viaContent = compileFleets(
      fleetsDocument([shipRecord("ship-a", { extra: { classQ: "x" } })]),
    );
    expect(viaContent.output).toBeUndefined();
    expect(viaContent.collector.errors.map((e) => e.code)).toContain("SCHEMA");

    const seed = resolveShipReadinessSeed(
      { id: "ship-a", isUnderConstruction: false, classQ: "x" },
      "ship-a",
    );
    expect(Result.isSuccess(seed)).toBe(false);
    if (Result.isFailure(seed)) {
      expect(seed.failure._tag).toBe("ShipReadinessFailure");
      expect(seed.failure.code).toBe(SHIP_READINESS_CODES.excessKey);
      expect(seed.failure).toBeInstanceOf(Error);
      expect(typeof seed.failure.message).toBe("string");
    }
  });
});

describe("S-1 crew-quality ramp constants and helpers (ticket 03)", () => {
  it("ramps toward the state ceiling, clamped, and never leaves 0..100", () => {
    expect(rampCrewQuality(SafeInt(100), "ACTIVE") as number).toBe(100);
    expect(rampCrewQuality(SafeInt(55), "ACTIVE") as number).toBe(60);
    expect(rampCrewQuality(SafeInt(70), "MOTHBALLED" as const) as number).toBe(65);
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

describe("S-1 repair months counter (ticket 04)", () => {
  it("accepts a bounded integer counter and rejects negative, non-integer or over-max values", () => {
    const ok = resolveShipReadinessSeed(
      { id: "s", readiness: "REPAIR", crewQuality: 50, repairMonthsRemaining: 6 },
      "s",
    );
    expect(Result.isSuccess(ok)).toBe(true);
    if (Result.isSuccess(ok)) expect(ok.success.repairMonthsRemaining as number).toBe(6);

    for (const bad of [-1, 1.5, 121]) {
      const r = resolveShipReadinessSeed(
        { id: "s", readiness: "REPAIR", crewQuality: 50, repairMonthsRemaining: bad },
        "s",
      );
      expect(Result.isSuccess(r)).toBe(false);
      if (Result.isFailure(r)) expect(r.failure.code).toBe(SHIP_READINESS_CODES.repairMonths);
    }
  });
});

describe("S-5 08 over-base crew-quality reduction (ticket 82)", () => {
  it("subtracts the ruleset points and never goes below the crew-quality floor", () => {
    expect(reduceCrewQuality(SafeInt(100), SafeInt(15)) as number).toBe(85);
    expect(reduceCrewQuality(SafeInt(10), SafeInt(15)) as number).toBe(0);
    expect(reduceCrewQuality(SafeInt(40), SafeInt(0)) as number).toBe(40);
  });
});
