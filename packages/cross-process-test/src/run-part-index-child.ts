// Cross-process determinism proof for the part index (ship-part-model ticket 02).
// Builds a bundle with a prototype, a national variant with revisions declared out of
// order, and a supersession edge, in a fresh per-process directory, and prints its
// body hash. Source files are recorded relative to the content root, so two processes
// (and two host locales) must print the same hash.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { buildContentBundleArtifact, type CompilerInput } from "@bluewave/content-compiler";
import { SHIP_ZONE_IDS } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";

const PROVENANCE = `{ sourceStatus: VERIFIED, confidence: HIGH, kind: historical_fact, sources: [{ title: "fixture" }] }`;

const HULL_FORMS = JSON.stringify({
  hullForms: [
    {
      id: "battleship_1880",
      lengthMinMm: 90_000,
      lengthMaxMm: 130_000,
      lbMinX100: 450,
      lbMaxX100: 650,
      formBp: 10_000,
      waterplaneCoeffBp: 7000,
      sheerBp: 10_000,
      volumeFullnessBp: 6000,
      deckFullnessBp: 7000,
      lcbPermille: 500,
      zones: SHIP_ZONE_IDS.map((id, index) => ({
        id,
        startPermille: index * 100,
        endPermille: index === SHIP_ZONE_IDS.length - 1 ? 1000 : (index + 1) * 100,
        volumeBp: index === 0 ? 1112 : 1111,
        deckAreaBp: index === 0 ? 1112 : 1111,
        buoyancyBp: index === 0 ? 1112 : 1111,
      })),
    },
  ],
});

const PARTS = `parts:
  - id: whitehead_18in
    family: torpedo
    provides: torpedo
    name: "Whitehead 18-inch"
    lifecycle: { availableFrom: "1890-01", supersedes: [whitehead_14in_fiume, whitehead_14in] }
    spec:
      diameterUm: 457000
      massKg: 560
      warheadType: WET_GUNCOTTON
      warheadExplosiveMassKg: 90
      warheadExplosiveEquivalentMassKg: 90
      propulsionType: COMPRESSED_AIR
      speedSettings: [{ settingId: "s1", speedMilliKnots: 29000, rangeM: 730 }]
      minimumArmingDistanceM: 25
      reliabilityBp: 90000
      guidanceCapability: none
      launchTypes: [ABOVE_WATER_TRAINABLE]
      technologyPrerequisiteIds: []
      tubeHitHazardPolicy: ORDINARY
    provenance: ${PROVENANCE}
  - id: whitehead_14in_fiume
    family: torpedo
    provides: torpedo
    name: "Fiume 14-inch"
    extends: whitehead_14in
    lifecycle: { availableFrom: "1881-01" }
    spec: { massKg: 305 }
    revisions:
      - { from: "1889-07", spec: { speedSettings: [{ settingId: "s2", speedMilliKnots: 26000, rangeM: 550 }, { settingId: "s3", speedMilliKnots: 22000, rangeM: 900 }] }, provenance: ${PROVENANCE} }
      - { from: "1885-03", spec: { warheadExplosiveMassKg: 30, warheadExplosiveEquivalentMassKg: 30 }, provenance: ${PROVENANCE} }
    provenance: ${PROVENANCE}
  - id: whitehead_14in
    family: torpedo
    provides: torpedo
    name: "Whitehead 14-inch"
    lifecycle: { availableFrom: "1880-01" }
    spec:
      diameterUm: 356000
      massKg: 300
      warheadType: WET_GUNCOTTON
      warheadExplosiveMassKg: 12
      warheadExplosiveEquivalentMassKg: 12
      propulsionType: COMPRESSED_AIR
      speedSettings: [{ settingId: "s4", speedMilliKnots: 24000, rangeM: 550 }]
      minimumArmingDistanceM: 25
      reliabilityBp: 88000
      guidanceCapability: none
      launchTypes: [ABOVE_WATER_TRAINABLE]
      technologyPrerequisiteIds: []
      tubeHitHazardPolicy: ORDINARY
    quantities: [{ id: torpedo_mass, kind: massKg, value: 300, basis: PER_PART_UNIT }]
    provenance: ${PROVENANCE}
`;

const SLOT_TEMPLATES = `slotTemplates:
  - id: capital_ship_1880s
    slots: [{ id: tubes, accepts: [torpedo_launcher], mountCount: { min: 0, max: 4 } }]
`;

const PLATFORMS = `platforms:
  - { id: pre_dreadnought_form, hullForm: battleship_1880, slotTemplates: [capital_ship_1880s] }
`;

function run(): void {
  const dir = resolve(tmpdir(), `bw-part-index-${String(process.pid)}-${String(Date.now())}`);
  const write = (rel: string, content: string): string => {
    const full = resolve(dir, rel);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf8");
    return full;
  };
  try {
    write("pack.json", JSON.stringify({ name: "p", version: "0.1.0", type: "fixture", files: {} }));
    const input: CompilerInput = {
      manifestPath: "pack.json",
      contentDir: dir,
      rulesetFiles: [],
      countryFiles: [],
      areaFiles: [],
      routeFiles: [],
      possessionFiles: [],
      portFiles: [],
      technologyFiles: [],
      shipBalanceFiles: [write("ship-building/balance.yaml", "ship:\n  dummy: 1\n")],
      hullFormFiles: [write("ship-building/hull-forms.yaml", HULL_FORMS)],
      partFiles: [write("ship-building/parts/torpedoes.yaml", PARTS)],
      slotTemplateFiles: [write("ship-building/slot-templates.yaml", SLOT_TEMPLATES)],
      platformFiles: [write("ship-building/platforms.yaml", PLATFORMS)],
    };
    const collector = new DiagnosticCollector();
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    if (!artifact || collector.hasErrors) {
      throw new Error(`part index bundle build failed: ${JSON.stringify(collector.errors)}`);
    }
    if (artifact.bundle.shipBuilding?.partModel === undefined) {
      throw new Error("part index bundle carries no part model");
    }
    process.stdout.write(
      JSON.stringify({ partIndexBundleHash: artifact.envelope.bodyHash }) + "\n",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

run();
