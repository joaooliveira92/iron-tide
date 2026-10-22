import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { FIXTURE_RULESETS_YAML, nationYaml, nationsYaml } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { CampaignCompiler, type CampaignCompilerInput } from "../src/compiler-public.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFile(base: string, rel: string, content: string): void {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function writeContentFixture(fixturePath: string): void {
  writeFile(fixturePath, "pack.json", FIXTURE.pack);
  writeFile(fixturePath, "rulesets.yaml", FIXTURE.rulesets);
  writeFile(fixturePath, "countries.yaml", FIXTURE.countries);
  writeFile(fixturePath, "areas.yaml", FIXTURE.areas);
  writeFile(fixturePath, "routes.yaml", FIXTURE.routes);
  writeFile(fixturePath, "possessions.yaml", FIXTURE.possessions);
  writeFile(fixturePath, "ports.yaml", FIXTURE.ports);
  writeFile(fixturePath, "technologies.yaml", FIXTURE.technologies);
  writeFile(fixturePath, "fleets.yaml", FIXTURE.fleets);
  writeFile(fixturePath, "economies.yaml", FIXTURE.economies);
  writeFile(fixturePath, "constructions.yaml", FIXTURE.constructions);
  writeFile(fixturePath, "diplomacy.yaml", FIXTURE.diplomacy);
  writeFile(fixturePath, "research.yaml", FIXTURE.research);
}

function baseInput(fixturePath: string): CompilerInput {
  return {
    manifestPath: resolve(fixturePath, "pack.json"),
    contentDir: fixturePath,
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

function compileFixture(
  fixturePath: string,
  collector: DiagnosticCollector,
  signal: AbortSignal,
  options: { input?: Partial<CompilerInput>; compiler?: Partial<CampaignCompilerInput> } = {},
) {
  const artifact = buildContentBundleArtifact(
    { ...baseInput(fixturePath), ...options.input },
    signal,
    collector,
  );
  if (!artifact) return undefined;
  return new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: "0.1.0",
      ...options.compiler,
    },
    signal,
    collector,
  );
}

const FIXTURE = {
  pack: JSON.stringify({
    name: "1880-test-scenario",
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

  rulesets: FIXTURE_RULESETS_YAML,

  countries: nationsYaml([
    { id: "uk", tag: "GBR", name: "United Kingdom", isPlayable: true, homeArea: "lon" },
    { id: "france", tag: "FRA", name: "France", homeArea: "par" },
  ]),

  areas: `
- id: "lon"
  name: "London"
  type: "land"
  controller: "uk"
- id: "par"
  name: "Paris"
  type: "land"
  controller: "france"
- id: "eng_ch"
  name: "English Channel"
  type: "sea"
`,

  routes: `
- id: "lon-par"
  from: "lon"
  to: "par"
  type: "sea"
  distance: 300
- id: "lon-eng_ch"
  from: "lon"
  to: "eng_ch"
  type: "sea"
  distance: 50
- id: "par-eng_ch"
  from: "par"
  to: "eng_ch"
  type: "sea"
  distance: 100
`,

  possessions: `
- id: "uk-lon"
  nationId: "uk"
  areaId: "lon"
- id: "fra-par"
  nationId: "france"
  areaId: "par"
`,

  ports: `
- id: "port-lon"
  name: "Port of London"
  areaId: "lon"
  nationId: "uk"
  level: 5
- id: "port-par"
  name: "Port of Paris"
  areaId: "par"
  nationId: "france"
  level: 3
`,

  technologies: `
- id: "basic_steam"
  name: "Basic Steam Turbine"
  category: "propulsion"
  cost: 100
  year: 1880
- id: "advanced_steam"
  name: "Advanced Steam Turbine"
  category: "propulsion"
  prerequisites:
    - { techId: "basic_steam" }
  cost: 200
  year: 1900
`,

  fleets: `
- id: "fleet-uk-home"
  nationId: "uk"
  name: "Home Fleet"
  locationAreaId: "lon"
  ships:
    - id: "ship-hms-dreadnought"
      name: "HMS Dreadnought"
      classId: "battleship"
      hitPoints: 100
      maxHitPoints: 100
      speed: 21
      firepower: 10
      armor: 12
      isUnderConstruction: false
      constructionProgress: 0
      constructionTotalWork: 0
    - id: "ship-hms-invincible"
      name: "HMS Invincible"
      classId: "battlecruiser"
      hitPoints: 80
      maxHitPoints: 80
      speed: 25
      firepower: 8
      armor: 6
      isUnderConstruction: false
      constructionProgress: 0
      constructionTotalWork: 0
- id: "fleet-fra-atlantic"
  nationId: "france"
  name: "Atlantic Fleet"
  locationAreaId: "par"
  ships:
    - id: "ship-fs-courbet"
      name: "FS Courbet"
      classId: "battleship"
      hitPoints: 90
      maxHitPoints: 90
      speed: 20
      firepower: 9
      armor: 11
      isUnderConstruction: false
      constructionProgress: 0
      constructionTotalWork: 0
`,

  economies: `
- nationId: "uk"
  treasury: 800
  income: 150
  expenses: 75
- nationId: "france"
  treasury: 600
  income: 120
  expenses: 60
`,

  constructions: `
- id: "con-uk-ship-battleship2"
  nationId: "uk"
  type: "ship"
  targetId: "ship-hms-thunderer"
  totalWork: 200
  completedWork: 50
  paidWork: 0
  status: "ACTIVE"
  startedAt: "1880-01"
`,

  diplomacy: `
- nationA: "uk"
  nationB: "france"
  relation: "neutral"
  since: "1880-01"
`,

  research: `
- nationId: "uk"
  researchBudget: 30
  currentProjectTechId: "basic_steam"
  technologies:
    - { techId: "basic_steam", investedPoints: 30, completed: false }
- nationId: "france"
  researchBudget: 0
  technologies: []
`,
};

describe("CampaignCompiler", () => {
  it("compiles a valid 1880 campaign fixture", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal);

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
      expect(output!.contentHash).toHaveLength(64);
      expect(output!.state.rawHash).toHaveLength(64);
      expect(output!.state.snapshot.turnNumber).toBe(0);
      expect(output!.state.snapshot.slots).toHaveLength(2);
      expect(output!.state.snapshot.slots[0]?.nationId).toBe("france");
      expect(output!.state.snapshot.slots[0]?.type).toBe("ai");
      expect(output!.state.snapshot.slots[1]?.nationId).toBe("uk");
      expect(output!.state.snapshot.slots[1]?.type).toBe("playable");

      expect(output!.state.snapshot.world.areas).toHaveLength(3);
      expect(output!.state.snapshot.world.routes).toHaveLength(3);
      expect(output!.state.snapshot.world.ports).toHaveLength(2);
      expect(output!.state.snapshot.world.ports[0]?.nationId).toBe("uk");

      const nations = output!.state.snapshot.nations;
      expect(nations.size).toBe(2);

      const uk = nations.get("uk");
      expect(uk).toBeDefined();
      expect(uk!.treasury).toBe(800);
      expect(uk!.income).toBe(150);
      expect(uk!.expenses).toBe(75);
      expect(uk!.fleets).toHaveLength(1);
      expect(uk!.fleets[0]?.ships).toHaveLength(2);
      expect(uk!.constructionProjects).toHaveLength(1);
      expect(uk!.research.currentProjectTechId).toBe("basic_steam");
      expect(uk!.research.technologies).toHaveLength(1);
      expect(uk!.research.technologies[0]!.investedPoints).toBe(30);
      expect(uk!.isPlayable).toBe(true);
      expect(uk!.isAI).toBe(false);

      const fra = nations.get("france");
      expect(fra).toBeDefined();
      expect(fra!.treasury).toBe(600);
      expect(fra!.fleets).toHaveLength(1);
      expect(fra!.fleets[0]?.ships).toHaveLength(1);
      expect(fra!.isPlayable).toBe(false);
      expect(fra!.isAI).toBe(true);

      expect(output!.state.snapshot.politics.relations).toHaveLength(1);
      expect(output!.state.snapshot.politics.relations[0]!.relation).toBe("neutral");

      expect(output!.state.snapshot.wars.wars).toHaveLength(0);
      expect(output!.state.snapshot.wars.battles).toHaveLength(0);

      expect(output!.state.snapshot.intelligence.shells).toEqual({});
    } finally {
      fixture.cleanup();
    }
  });

  it("marks a nation playable from its data isPlayable flag, not its id", () => {
    const fixture = createFixtureDir();
    try {
      writeFile(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "flag-drive",
          version: "0.1.0",
          type: "fixture",
          files: {
            rulesets: ["rulesets.yaml"],
            countries: ["countries.yaml"],
            areas: ["areas.yaml"],
          },
        }),
      );
      writeFile(fixture.path, "rulesets.yaml", FIXTURE_RULESETS_YAML);
      writeFile(
        fixture.path,
        "countries.yaml",
        nationYaml({ id: "france", tag: "FRA", name: "France", isPlayable: true, homeArea: "par" }),
      );
      writeFile(
        fixture.path,
        "areas.yaml",
        '- id: "par"\n  name: "Paris"\n  type: "land"\n  controller: "france"\n',
      );
      writeFile(
        fixture.path,
        "economies.yaml",
        '- nationId: "france"\n  treasury: 600\n  income: 120\n  expenses: 60\n',
      );

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal, {
        input: {
          rulesetFiles: ["rulesets.yaml"],
          countryFiles: ["countries.yaml"],
          areaFiles: ["areas.yaml"],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          fleetFiles: [],
          economyFiles: ["economies.yaml"],
          constructionFiles: [],
          diplomacyFiles: [],
          researchFiles: [],
          designFiles: [],
        },
      });

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();
      expect(output!.state.snapshot.slots).toEqual([{ nationId: "france", type: "playable" }]);
      const fra = output!.state.snapshot.nations.get("france")!;
      expect(fra.isPlayable).toBe(true);
      expect(fra.isAI).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("fails when a nation is missing required content fields", () => {
    const fixture = createFixtureDir();
    try {
      writeFile(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "missing-flag",
          version: "0.1.0",
          type: "fixture",
          files: { countries: ["countries.yaml"] },
        }),
      );
      writeFile(
        fixture.path,
        "countries.yaml",
        `
- id: "france"
  tag: "FRA"
  name: "France"
`,
      );

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal, {
        input: {
          rulesetFiles: [],
          countryFiles: ["countries.yaml"],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          fleetFiles: [],
          economyFiles: [],
          constructionFiles: [],
          diplomacyFiles: [],
          researchFiles: [],
          designFiles: [],
        },
      });

      expect(output).toBeUndefined();
      expect(collector.hasErrors).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("produces deterministic output on repeated compilation", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);

      const signal = new AbortController().signal;

      const run = () => {
        const collector = new DiagnosticCollector();
        return compileFixture(fixture.path, collector, signal);
      };

      const out1 = run();
      const out2 = run();

      expect(out1).toBeDefined();
      expect(out2).toBeDefined();
      expect(out1!.state.rawHash).toBe(out2!.state.rawHash);
      expect(out1!.contentHash).toBe(out2!.contentHash);
    } finally {
      fixture.cleanup();
    }
  });

  it("reports missing nations as error", () => {
    const fixture = createFixtureDir();
    try {
      writeFile(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "empty-test",
          version: "0.1.0",
          type: "fixture",
          files: {},
        }),
      );

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal, {
        input: {
          rulesetFiles: [],
          countryFiles: [],
          areaFiles: [],
          routeFiles: [],
          possessionFiles: [],
          portFiles: [],
          technologyFiles: [],
          fleetFiles: [],
          economyFiles: [],
          constructionFiles: [],
          diplomacyFiles: [],
          researchFiles: [],
          designFiles: [],
        },
      });

      expect(output).toBeUndefined();
      expect(collector.hasErrors).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("supports cancellation", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);

      const collector = new DiagnosticCollector();
      const controller = new AbortController();
      controller.abort();

      const output = compileFixture(fixture.path, collector, controller.signal);

      expect(output).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });

  it("compiles design YAML templates into immutable CompiledDesignVersion records", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);
      writeFile(
        fixture.path,
        "designs.yaml",
        `
- designId: "uk-dreadnought-v1"
  designVersionId: "uk-dreadnought-v1"
  designFamilyId: "dreadnought"
  nationId: "uk"
  className: "Dreadnought-class"
  hullType: "battleship"
  displacementKg: 18000
  speedUms: 11
  armorBeltUm: 300
  mainGuns: { caliber: 305, count: 10, mounts: 5 }
  machineryType: "steam_turbine"
  hitPoints: 120
  crewComplement: 800
- designId: "fra-courbet-v1"
  designVersionId: "fra-courbet-v1"
  designFamilyId: "courbet"
  nationId: "france"
  className: "Courbet-class"
  hullType: "battleship"
  displacementKg: 23000
  speedUms: 10
  armorBeltUm: 280
  mainGuns: { caliber: 305, count: 6, mounts: 6 }
  machineryType: "steam_turbine"
  hitPoints: 110
  crewComplement: 1085
        `,
      );

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal, {
        input: { designFiles: ["designs.yaml"] },
      });

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();

      const designs = output!.state.snapshot.designs;
      expect(designs.size).toBe(2);

      const dreadnought = designs.get("uk-dreadnought-v1")!;
      expect(dreadnought.className).toBe("Dreadnought-class");
      expect(dreadnought.hullType).toBe("battleship");
      expect(dreadnought.normalizedDisplacementKg).toBe(18000);
      expect(dreadnought.normalizedSpeedUms).toBe(11 * 514_444);
      expect(dreadnought.normalizedArmorUm).toBe(300 * 1000);
      expect(dreadnought.mainGunsCaliber).toBe(305 * 1000);
      expect(dreadnought.mainGunsCount).toBe(10);
      expect(dreadnought.hitPoints).toBe(120);
      expect(dreadnought.compiledHash).toHaveLength(64);

      expect(designs.get("fra-courbet-v1")!.nationId).toBe("france");
    } finally {
      fixture.cleanup();
    }
  });

  it("P-1 AC-2: compiles optional torpedoArmament; unarmed designs keep their hash shape", () => {
    const compileDesign = (extra: string) => {
      const fixture = createFixtureDir();
      try {
        writeContentFixture(fixture.path);
        writeFile(
          fixture.path,
          "designs.yaml",
          `
- designId: "uk-inflexible-v1"
  designVersionId: "uk-inflexible-v1"
  designFamilyId: "inflexible"
  nationId: "uk"
  className: "Inflexible"
  hullType: "ironclad_turret_ship"
  displacementKg: 11880000
  speedUms: 14
  armorBeltUm: 610
  mainGuns: { caliber: 406, count: 4, mounts: 2 }
  machineryType: "reciprocating_compound"
  hitPoints: 60
  crewComplement: 460
${extra}`,
        );
        const collector = new DiagnosticCollector();
        const output = compileFixture(fixture.path, collector, new AbortController().signal, {
          input: { designFiles: ["designs.yaml"] },
        });
        expect(collector.hasErrors).toBe(false);
        return output!.state.snapshot.designs.get("uk-inflexible-v1")!;
      } finally {
        fixture.cleanup();
      }
    };

    const unarmed = compileDesign("");
    const armed = compileDesign(`  torpedoArmament:
    - { mountType: "UNDERWATER_FIXED", tubeCount: 2, torpedoModelId: "whitehead_14in_1886" }
    - { mountType: "ABOVE_WATER_TRAINABLE", tubeCount: 2, torpedoModelId: "whitehead_14in_1886" }
`);
    expect("torpedoArmament" in unarmed).toBe(false);
    expect(armed.torpedoArmament).toEqual([
      { mountType: "UNDERWATER_FIXED", tubeCount: 2, torpedoModelId: "whitehead_14in_1886" },
      { mountType: "ABOVE_WATER_TRAINABLE", tubeCount: 2, torpedoModelId: "whitehead_14in_1886" },
    ]);
    expect(armed.compiledHash).not.toBe(unarmed.compiledHash);
    expect(compileDesign("").compiledHash).toBe(unarmed.compiledHash);
  });

  it("links initial fleet ships to compiled designs via designVersionId", () => {
    const fixture = createFixtureDir();
    try {
      writeFile(fixture.path, "pack.json", FIXTURE.pack);
      writeFile(fixture.path, "rulesets.yaml", FIXTURE.rulesets);
      writeFile(fixture.path, "countries.yaml", FIXTURE.countries);
      writeFile(fixture.path, "areas.yaml", FIXTURE.areas);
      writeFile(fixture.path, "routes.yaml", FIXTURE.routes);
      writeFile(fixture.path, "possessions.yaml", FIXTURE.possessions);
      writeFile(fixture.path, "ports.yaml", FIXTURE.ports);
      writeFile(fixture.path, "technologies.yaml", FIXTURE.technologies);
      writeFile(fixture.path, "economies.yaml", FIXTURE.economies);
      writeFile(fixture.path, "constructions.yaml", FIXTURE.constructions);
      writeFile(fixture.path, "diplomacy.yaml", FIXTURE.diplomacy);
      writeFile(fixture.path, "research.yaml", FIXTURE.research);
      writeFile(
        fixture.path,
        "designs.yaml",
        `
- designId: "uk-dreadnought-v1"
  designVersionId: "uk-dreadnought-v1"
  designFamilyId: "dreadnought"
  nationId: "uk"
  className: "Dreadnought-class"
  hullType: "battleship"
  displacementKg: 18000
  speedUms: 11
  armorBeltUm: 300
  mainGuns: { caliber: 305, count: 10, mounts: 5 }
  machineryType: "steam_turbine"
  hitPoints: 120
  crewComplement: 800
        `,
      );
      writeFile(
        fixture.path,
        "fleets.yaml",
        `
- id: "fleet-uk-home"
  nationId: "uk"
  name: "Home Fleet"
  locationAreaId: "lon"
  ships:
    - id: "ship-hms-dreadnought"
      name: "HMS Dreadnought"
      designVersionId: "uk-dreadnought-v1"
      classId: "battleship"
      hitPoints: 120
      maxHitPoints: 120
      speed: 11
      firepower: 10
      armor: 12
      isUnderConstruction: false
      constructionProgress: 0
      constructionTotalWork: 0
        `,
      );

      const collector = new DiagnosticCollector();
      const signal = new AbortController().signal;

      const output = compileFixture(fixture.path, collector, signal, {
        input: { fleetFiles: ["fleets.yaml"], designFiles: ["designs.yaml"] },
      });

      expect(collector.hasErrors).toBe(false);
      expect(output).toBeDefined();

      const uk = output!.state.snapshot.nations.get("uk")!;
      const ship = uk.fleets[0]!.ships[0]!;
      expect(ship.designVersionId).toBe("uk-dreadnought-v1");
      expect(output!.state.snapshot.designs.has("uk-dreadnought-v1")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("CampaignCompiler decoded-bundle path (ticket 07 / CAH-LEG-1)", () => {
  function buildFixtureBundle(fixturePath: string) {
    const collector = new DiagnosticCollector();
    const artifact = buildContentBundleArtifact(
      baseInput(fixturePath),
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    expect(artifact).toBeDefined();
    return artifact!.bundle;
  }

  it("compiles the decoded bundle with the supplied content identity", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);
      const bundle = buildFixtureBundle(fixture.path);
      const signal = new AbortController().signal;

      const decoded = new CampaignCompiler().compile(
        {
          contentBundle: bundle,
          contentHash: "a".repeat(64),
          rulesetVersion: "1.0",
          compatibilityVersion: "0.1.0",
        },
        signal,
        new DiagnosticCollector(),
      );

      expect(decoded).toBeDefined();
      expect(decoded!.contentHash).toBe("a".repeat(64));
      expect(decoded!.state.snapshot.nations.size).toBe(2);
      const again = new CampaignCompiler().compile(
        {
          contentBundle: bundle,
          contentHash: "a".repeat(64),
          rulesetVersion: "1.0",
          compatibilityVersion: "0.1.0",
        },
        signal,
        new DiagnosticCollector(),
      );
      expect(again!.state.rawHash).toBe(decoded!.state.rawHash);
    } finally {
      fixture.cleanup();
    }
  });

  it("ignores campaign-file YAML that diverges from the verified bundle", () => {
    const fixture = createFixtureDir();
    try {
      writeContentFixture(fixture.path);
      const bundle = buildFixtureBundle(fixture.path);
      const signal = new AbortController().signal;

      writeFile(fixture.path, "fleets.yaml", '- id: "bogus"\n  nationId: "uk"\n');
      writeFile(fixture.path, "economies.yaml", "[]\n");

      const decoded = new CampaignCompiler().compile(
        {
          contentBundle: bundle,
          contentHash: "a".repeat(64),
          rulesetVersion: "1.0",
          compatibilityVersion: "0.1.0",
        },
        signal,
        new DiagnosticCollector(),
      );

      expect(decoded).toBeDefined();
      const uk = decoded!.state.snapshot.nations.get("uk")!;
      expect(uk.fleets[0]?.ships).toHaveLength(2);
      expect(decoded!.state.snapshot.nations.get("uk")!.income).toBe(150);
    } finally {
      fixture.cleanup();
    }
  });
});
