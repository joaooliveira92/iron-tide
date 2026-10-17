import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import {
  constructionsOf,
  designsOf,
  divisionsOf,
  fleetsOf,
  nationsOf,
  researchOf,
} from "./helpers/campaignRecords.js";

/**
 * 1880 per-nation viability (N-1 ticket 06; N-2 static gate from #31).
 * No nation opens as a placeholder. Every nation has at least one ship afloat,
 * at least one own design, and a research programme; no fleet is empty without a
 * documented reason; every ship's design reference resolves; ten nations are
 * playable (ADR-0214); and no starting ship, construction, or division
 * references a post-1880 design.
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

describe("1880 per-nation viability (N-1 ticket 06; N-2 static gate)", () => {
  const bundle = buildProductionBundle();
  const fleets = fleetsOf(bundle);
  const designs = designsOf(bundle);
  const constructions = constructionsOf(bundle);
  const divisions = divisionsOf(bundle);
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

  // ADR-0214: ten playable nations; the remaining four are AI-only.
  const PLAYABLE_NATION_IDS = [
    "uk",
    "germany",
    "france",
    "austria_hungary",
    "russia",
    "italy",
    "japan",
    "qing",
    "spain",
    "usa",
  ] as const;

  // The authored `familyCreationMonth` year is the design's vintage; the 1880
  // start may only reference designs whose family existed by 1880.
  const designYearById = new Map(
    designs.map((design) => [
      design.designVersionId,
      Number((design.familyCreationMonth ?? "").slice(0, 4)),
    ]),
  );
  const shipsById = new Map(fleets.flatMap((fleet) => fleet.ships.map((ship) => [ship.id, ship])));

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

  it("keeps the ten-playable roster of ADR-0214", () => {
    const playable = nationsOf(bundle)
      .filter((nation) => nation.isPlayable)
      .map((nation) => nation.id)
      .sort();
    expect(playable).toEqual([...PLAYABLE_NATION_IDS].sort());
  });

  it("documents any empty fleet and links every starting ship to a compiled design", () => {
    for (const fleet of fleets) {
      if (fleet.ships.length === 0) {
        expect(
          fleet.provenance,
          `empty fleet '${fleet.id}' has no documented reason`,
        ).toBeDefined();
      }
      for (const ship of fleet.ships) {
        expect(ship.designVersionId, `ship '${ship.id}' carries no designVersionId`).toBeDefined();
        if (ship.designVersionId === undefined) continue;
        expect(
          designIds.has(ship.designVersionId),
          `ship '${ship.id}' references unknown design '${ship.designVersionId}'`,
        ).toBe(true);
      }
    }
  });

  it("references no post-1880 design from a starting ship, construction, or division", () => {
    const assertNotPost1880 = (designVersionId: string | undefined, subject: string): void => {
      expect(designVersionId, `${subject} carries no designVersionId`).toBeDefined();
      if (designVersionId === undefined) return;
      const year = designYearById.get(designVersionId);
      expect(year, `${subject} references unknown design '${designVersionId}'`).toBeDefined();
      expect(
        year !== undefined && year > 1880,
        `${subject} references post-1880 design '${designVersionId}' (${String(year)})`,
      ).toBe(false);
    };

    for (const fleet of fleets) {
      for (const ship of fleet.ships) {
        assertNotPost1880(ship.designVersionId, `ship '${ship.id}'`);
      }
    }
    for (const construction of constructions) {
      if (construction.type !== "ship") continue;
      assertNotPost1880(construction.designVersionId, `construction '${construction.id}'`);
    }
    for (const division of divisions) {
      for (const shipId of division.shipOrder) {
        const ship = shipsById.get(shipId);
        expect(ship, `division '${division.id}' references unknown ship '${shipId}'`).toBeDefined();
        if (ship === undefined) continue;
        assertNotPost1880(ship.designVersionId, `division '${division.id}' ship '${shipId}'`);
      }
    }
  });
});
