import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { SHIP_ZONE_IDS } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";

import { Compiler, type CompilerInput } from "../src/index.js";

export const PROVENANCE = `{ sourceStatus: VERIFIED, confidence: HIGH, kind: historical_fact, sources: [{ title: "test" }] }`;

export const HULL_FORMS = JSON.stringify({
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

export interface Fixture {
  readonly path: string;
  write(rel: string, content: string): string;
  cleanup(): void;
}

export function createFixture(): Fixture {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-parts-"));
  return {
    path: dir,
    write(rel, content) {
      const full = resolve(dir, rel);
      mkdirSync(resolve(full, ".."), { recursive: true });
      writeFileSync(full, content, "utf8");
      return full;
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function baseInput(fixture: Fixture, extra: Partial<CompilerInput> = {}): CompilerInput {
  fixture.write(
    "pack.json",
    JSON.stringify({ name: "test-pack", version: "0.1.0", type: "fixture", files: {} }),
  );
  return {
    manifestPath: "pack.json",
    contentDir: fixture.path,
    rulesetFiles: [],
    countryFiles: [],
    areaFiles: [],
    routeFiles: [],
    possessionFiles: [],
    portFiles: [],
    technologyFiles: [],
    shipBalanceFiles: [fixture.write("ship-building/balance.yaml", "ship:\n  dummy: 1\n")],
    hullFormFiles: [fixture.write("ship-building/hull-forms.yaml", HULL_FORMS)],
    ...extra,
  };
}

export function compile(input: CompilerInput) {
  const collector = new DiagnosticCollector();
  const output = new Compiler().compile(input, new AbortController().signal, collector);
  return { output, collector };
}
