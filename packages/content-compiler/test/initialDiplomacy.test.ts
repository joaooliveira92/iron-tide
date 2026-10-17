import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { diplomacyOf, nationsOf } from "./helpers/campaignRecords.js";

/**
 * 1880 diplomacy (N-1 ticket 05): the opening political posture is authored from
 * the era's alignments and rivalries rather than a flat neutral@5 baseline. The
 * relations are compiled content; each record documents its direction in
 * provenance and its tension magnitude as an admitted balance choice.
 */

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

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

describe("1880 diplomacy (N-1 ticket 05)", () => {
  const bundle = buildProductionBundle();
  const diplomacy = diplomacyOf(bundle);
  const byPair = new Map(diplomacy.map((r) => [pairKey(r.nationA, r.nationB), r]));

  it("author(s) the major 1880 alignments and rivalries with correct directions", () => {
    expect(bundle.nations.length).toBe(14);
    const totalPairs = (nationsOf(bundle).length * (bundle.nations.length - 1)) / 2;

    expect(diplomacy.length).toBeGreaterThan(0);
    expect(diplomacy.length).toBeLessThan(totalPairs);

    const expected: readonly { a: string; b: string; relation: string; tension: number }[] = [
      { a: "germany", b: "austria_hungary", relation: "allied", tension: 1 },
      { a: "portugal", b: "uk", relation: "allied", tension: 1 },
      { a: "france", b: "germany", relation: "neutral", tension: 9 },
      { a: "ottoman_empire", b: "russia", relation: "neutral", tension: 8 },
      { a: "austria_hungary", b: "russia", relation: "neutral", tension: 7 },
      { a: "uk", b: "russia", relation: "neutral", tension: 7 },
      { a: "france", b: "uk", relation: "neutral", tension: 6 },
      { a: "japan", b: "qing", relation: "neutral", tension: 6 },
      { a: "germany", b: "russia", relation: "neutral", tension: 3 },
      { a: "ottoman_empire", b: "uk", relation: "neutral", tension: 3 },
    ];

    for (const want of expected) {
      const record = byPair.get(pairKey(want.a, want.b));
      expect(record, `missing authored relation ${want.a}/${want.b}`).toBeDefined();
      expect(record!.relation, `relation ${want.a}/${want.b}`).toBe(want.relation);
      expect(record!.tension, `tension ${want.a}/${want.b}`).toBe(want.tension);
    }
  });

  it("differs from a uniform neutral@5 baseline and starts at peace", () => {
    const uniform = diplomacy.filter((r) => r.relation === "neutral" && r.tension === 5);
    expect(uniform.length).toBeLessThan(diplomacy.length);
    expect(diplomacy.some((r) => r.relation === "at_war")).toBe(false);

    const alliances = diplomacy.filter((r) => r.relation === "allied");
    expect(alliances.length).toBeGreaterThanOrEqual(2);
    for (const alliance of alliances) {
      expect(
        alliance.nap,
        `alliance ${alliance.nationA}/${alliance.nationB} should have a NAP`,
      ).toBe(true);
    }
  });

  it("documents every authored record's direction and marks its tension a balance choice", () => {
    for (const record of diplomacy) {
      const provenance = record.provenance;
      expect(provenance, `missing provenance on ${record.nationA}/${record.nationB}`).toBeDefined();
      expect(provenance!.kind).toBe("balance_adjustment");
      expect(provenance!.sourceStatus).toBe("BALANCE_TARGET");
    }
  });
});
