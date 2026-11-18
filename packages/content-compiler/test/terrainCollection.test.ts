import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";

import {
  Compiler,
  buildTerrainArtifact,
  verifyTerrainArtifact,
  type CompilerInput,
} from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL authoring fixture",
};

const terrainRules = {
  sectionVersion: 1,
  exclusionRadiusM: 400,
  maxVerticesPerPolygon: 8,
  provenance,
};

const nation = {
  id: "uk",
  tag: "GBR",
  name: "United Kingdom",
  displayNameKey: "nation.uk",
  isPlayable: false,
  homeArea: "a_coast",
  slot: null,
  presentation: { colorBg: "#C8102E", colorFg: "#FFFFFF" },
  identity: { oneSentence: "x", fullIdentity: "x", strategicProblem: "x" },
  traits: [],
  regime: {
    type: "monarchy",
    politicalSystem: "constitutional_monarchy",
    governmentType: "limited_democracy",
    headOfState: "x",
    headOfGovernment: "x",
    leaderTitle: "x",
    navalPolicyActors: [],
    governmentModifiers: [],
    stabilityProfile: { level: "high", factors: [] },
    description: "x",
  },
  strategicObjectives: { primary: "x", secondary: "x" },
  baseResources: {
    gdpTier: "great_power",
    gdpDescription: "x",
    population: "x",
    industrialization: "industrial",
    industrializationDescription: "x",
  },
  navalAppropriation: { budgetLevel: "moderate", justification: "x" },
  economy: {
    description: "x",
    character: "x",
    strengths: [],
    weaknesses: [],
    industrialBase: "mature_global",
  },
  navalInstitution: { description: "x", character: [], seniority: "senior_service" },
  doctrine: { summary: "x", schools: [] },
  shipDesign: { summary: "x", principles: [], favoredTypes: [] },
  ai: { archetype: "status_quo_maritime_hegemon", behavior: [] },
  navalPurpose: "sustain_global_empire",
  coreAnxiety: "loss_of_sea_control_overstretch",
  gameplayFeel: "manage_supremacy",
  historicalAssumptions: [],
};

const square = (id: string, layer: "LAND" | "SHALLOWS", x: number, y: number, size: number) => ({
  id,
  layer,
  vertices: [
    { xM: x, yM: y },
    { xM: x + size, yM: y },
    { xM: x + size, yM: y + size },
    { xM: x, yM: y + size },
  ],
});

const record = (overrides: Record<string, unknown> = {}) => ({
  areaId: "a_coast",
  box: { minXM: -5000, minYM: -5000, maxXM: 5000, maxYM: 5000 },
  polygons: [square("land_b", "LAND", 0, 0, 1000), square("land_a", "LAND", 2000, 0, 500)],
  bases: [{ portId: "p_one", xM: 1500, yM: 1500 }],
  provenance,
  ...overrides,
});

function compile(terrain: readonly unknown[], rulesets: readonly unknown[] = [rulesetWith()]) {
  const documents: Record<string, unknown> = {
    "pack.json": {
      name: "t",
      version: "0.0.1",
      type: "fixture",
      files: { terrain: ["terrain.ts"] },
    },
    "countries.ts": [nation],
    "rulesets.ts": rulesets,
    "areas.ts": [
      { id: "a_coast", name: "Coast", type: "coastal" },
      { id: "a_other", name: "Other", type: "sea" },
    ],
    "ports.ts": [
      { id: "p_one", name: "One", areaId: "a_coast", nationId: "uk" },
      { id: "p_far", name: "Far", areaId: "a_other", nationId: "uk" },
    ],
    "terrain.ts": terrain,
  };
  const input: CompilerInput = {
    manifestPath: "pack.json",
    contentDir: "/virtual",
    rulesetFiles: ["rulesets.ts"],
    countryFiles: ["countries.ts"],
    areaFiles: ["areas.ts"],
    routeFiles: [],
    possessionFiles: [],
    portFiles: ["ports.ts"],
    technologyFiles: [],
    terrainFiles: ["terrain.ts"],
    documents,
  };
  const collector = new DiagnosticCollector();
  const output = new Compiler().compile(input, new AbortController().signal, collector);
  return { output, codes: collector.diagnostics.map((d) => d.code) };
}

function rulesetWith(...terrain: readonly unknown[]) {
  const section = terrain.length === 0 ? terrainRules : terrain[0];
  return {
    id: "r",
    name: "R",
    version: "1.0.0",
    ...(section === undefined ? {} : { terrain: section }),
  };
}

describe("terrain collection", () => {
  it("compiles sorted records, polygons and derived exclusions", () => {
    const { output, codes } = compile([record()]);
    expect(codes).toEqual([]);
    const compiled = output?.terrain;
    expect(compiled?.records.map((r) => r.areaId)).toEqual(["a_coast"]);
    expect(compiled?.records[0]?.land.map((p) => p.id)).toEqual(["land_a", "land_b"]);
    expect(compiled?.records[0]?.exclusions).toEqual([
      { id: "exclusion.p_one", portId: "p_one", xM: 1500, yM: 1500, radiusM: 400 },
    ]);
  });

  it("is absent without records and strips the terrain section from the bundle", () => {
    const withTerrain = compile([record()]).output;
    const without = compile([]).output;
    expect(without?.terrain).toBeUndefined();
    expect(JSON.stringify(withTerrain?.bundle)).not.toContain("terrain");
    expect(withTerrain?.rawHash).toBe(without?.rawHash);
    expect(withTerrain?.envelopeHash).toBe(without?.envelopeHash);
    const bare = compile([], [rulesetWith(undefined)]).output;
    expect(bare?.rawHash).toBe(without?.rawHash);
  });

  it("builds a domain-separated artifact that verifies and detects tampering", () => {
    const compiled = compile([record()]).output?.terrain;
    if (compiled === undefined) throw new Error("terrain missing");
    const artifact = buildTerrainArtifact(compiled);
    expect(artifact.envelope.hashDomain).toBe("bluewave.terrain.v1");
    expect(artifact.envelope.bodyHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(verifyTerrainArtifact(JSON.parse(artifact.artifactJson)).ok).toBe(true);
    const tampered = JSON.parse(artifact.artifactJson);
    tampered.terrain.records[0].exclusions[0].radiusM = 401;
    expect(verifyTerrainArtifact(tampered)).toMatchObject({
      ok: false,
      code: "TERRAIN_ARTIFACT_HASH_MISMATCH",
    });
    expect(buildTerrainArtifact(compiled).envelope.bodyHash).toBe(artifact.envelope.bodyHash);
  });

  it("reports a missing ruleset section", () => {
    expect(compile([record()], [rulesetWith(undefined)]).codes).toContain("TERRAIN-RULES-MISSING");
  });

  it.each([
    [
      "self-intersection",
      [
        {
          ...square("bow", "LAND", 0, 0, 10),
          vertices: [
            { xM: 0, yM: 0 },
            { xM: 100, yM: 100 },
            { xM: 100, yM: 0 },
            { xM: 0, yM: 100 },
          ],
        },
      ],
      "TERRAIN-SELF-INTERSECTION",
    ],
    ["vertex outside the box", [square("far", "LAND", 4900, 0, 500)], "TERRAIN-OUTSIDE-BOX"],
    [
      "clockwise winding",
      [
        {
          ...square("cw", "LAND", 0, 0, 100),
          vertices: [
            { xM: 0, yM: 0 },
            { xM: 0, yM: 100 },
            { xM: 100, yM: 100 },
            { xM: 100, yM: 0 },
          ],
        },
      ],
      "TERRAIN-NOT-COUNTER-CLOCKWISE",
    ],
    [
      "too many vertices",
      [
        {
          ...square("many", "LAND", 0, 0, 100),
          vertices: Array.from({ length: 9 }, (_, i) => ({
            xM: Math.round(1000 * Math.cos((i * 2 * Math.PI) / 9)),
            yM: Math.round(1000 * Math.sin((i * 2 * Math.PI) / 9)),
          })),
        },
      ],
      "TERRAIN-VERTEX-CAP",
    ],
    [
      "land over shallows",
      [square("land", "LAND", 0, 0, 1000), square("shoal", "SHALLOWS", 500, 500, 1000)],
      "TERRAIN-LAND-OVER-SHALLOWS",
    ],
    [
      "identical land and shallows",
      [square("land", "LAND", 0, 0, 1000), square("shoal", "SHALLOWS", 0, 0, 1000)],
      "TERRAIN-LAND-OVER-SHALLOWS",
    ],
    [
      "shallows inside land",
      [square("land", "LAND", 0, 0, 1000), square("shoal", "SHALLOWS", 200, 200, 100)],
      "TERRAIN-LAND-OVER-SHALLOWS",
    ],
  ])("blocks on %s", (_name, polygons, code) => {
    const { output, codes } = compile([record({ polygons })]);
    expect(output).toBeUndefined();
    expect(codes).toContain(code);
  });

  it("allows shallows that only touch the coast", () => {
    const { output, codes } = compile([
      record({
        polygons: [square("land", "LAND", 0, 0, 1000), square("shoal", "SHALLOWS", 1000, 0, 500)],
      }),
    ]);
    expect(codes).toEqual([]);
    expect(output?.terrain?.records[0]?.shallows).toHaveLength(1);
  });

  it("rejects bad references and duplicates", () => {
    expect(compile([record({ areaId: "nowhere" })]).codes).toContain("TERRAIN-UNKNOWN-AREA");
    expect(compile([record({ bases: [{ portId: "ghost", xM: 0, yM: 0 }] })]).codes).toContain(
      "TERRAIN-UNKNOWN-PORT",
    );
    expect(compile([record({ bases: [{ portId: "p_far", xM: 0, yM: 0 }] })]).codes).toContain(
      "TERRAIN-PORT-AREA-MISMATCH",
    );
    expect(compile([record(), record()]).codes).toContain("TERRAIN-DUPLICATE-AREA");
  });

  it("rejects non-integer and out-of-range coordinates at the schema", () => {
    const fractional = [
      {
        ...square("f", "LAND", 0, 0, 100),
        vertices: [
          { xM: 0.5, yM: 0 },
          { xM: 100, yM: 0 },
          { xM: 100, yM: 100 },
        ],
      },
    ];
    expect(compile([record({ polygons: fractional })]).output).toBeUndefined();
    const huge = [square("h", "LAND", 0, 0, 2_000_000)];
    expect(compile([record({ polygons: huge })]).output).toBeUndefined();
  });
});
