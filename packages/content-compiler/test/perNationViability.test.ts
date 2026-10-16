import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { designsOf, fleetsOf, nationsOf, researchOf } from "./helpers/campaignRecords.js";

/**
 * 1880 per-nation viability (N-1 ticket 06): no nation opens as a placeholder.
 * Every nation has at least one ship afloat, at least one own design, and a
 * research programme; no fleet is empty without a documented reason; and every
 * ship's design reference resolves.
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

describe("1880 per-nation viability (N-1 ticket 06)", () => {
  const bundle = buildProductionBundle();
  const fleets = fleetsOf(bundle);
  const designs = designsOf(bundle);
  const research = researchOf(bundle);

  const shipsByNation = new Map<string, number>();
  for (const fleet of fleets) {
    shipsByNation.set(
      fleet.nationId,
      (shipsByNation.get(fleet.nationId) ?? 0) + fleet.ships.length,
    );
  }
  const designIds = new Set(designs.map((design) => design.designVersionId));
  const designsByNation = new Map<string, number>();
  for (const design of designs) {
    designsByNation.set(design.nationId, (designsByNation.get(design.nationId) ?? 0) + 1);
  }
  const researchNations = new Set(research.map((entry) => entry.nationId));

  it("gives every nation ships, an own design, and a research programme", () => {
    expect(bundle.nations.length).toBe(14);
    for (const nation of nationsOf(bundle)) {
      expect(
        shipsByNation.get(nation.id) ?? 0,
        `nation '${nation.id}' starts with no ships`,
      ).toBeGreaterThan(0);
      expect(
        designsByNation.get(nation.id) ?? 0,
        `nation '${nation.id}' has no own design`,
      ).toBeGreaterThan(0);
      expect(
        researchNations.has(nation.id),
        `nation '${nation.id}' has no research programme`,
      ).toBe(true);
    }
  });

  it("documents any empty fleet and resolves every ship design reference", () => {
    for (const fleet of fleets) {
      if (fleet.ships.length === 0) {
        expect(
          fleet.provenance,
          `empty fleet '${fleet.id}' has no documented reason`,
        ).toBeDefined();
      }
      for (const ship of fleet.ships) {
        if (ship.designVersionId === undefined) continue;
        expect(
          designIds.has(ship.designVersionId),
          `ship '${ship.id}' references unknown design '${ship.designVersionId}'`,
        ).toBe(true);
      }
    }
  });
});
