import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { divisionsOf, fleetsOf } from "./helpers/campaignRecords.js";

/**
 * 1880 initial divisions (N-1 ticket 07, ADR-0224): the opening command
 * structure is authored from the ships already stationed in the era's
 * squadrons rather than the former empty baseline. The collection is compiled
 * content; each record documents its direction in provenance and marks its
 * composition an admitted ADR-0213 balance choice.
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

describe("1880 divisions (N-1 ticket 07)", () => {
  const bundle = buildProductionBundle();
  const divisions = divisionsOf(bundle);
  const fleets = fleetsOf(bundle);

  it("compiles an authored divisions collection into the bundle", () => {
    expect(bundle.campaign?.divisions).toBeDefined();
    expect(divisions.length).toBeGreaterThan(0);
  });

  it("seeds the nations that kept an organised division and not the rest", () => {
    const byNation = new Map<string, number>();
    for (const division of divisions) {
      byNation.set(division.nationId, (byNation.get(division.nationId) ?? 0) + 1);
    }
    // The larger 1880 navies split their squadrons; the US and Qing squadrons
    // were single ships still working up, so no division is seeded.
    expect(byNation.get("uk")).toBe(2);
    expect(byNation.get("netherlands")).toBe(2);
    expect(byNation.has("usa")).toBe(false);
    expect(byNation.has("qing")).toBe(false);
    expect(byNation.size).toBeGreaterThan(1);
  });

  it("groups only real, co-located ships of the division's own nation", () => {
    const shipLocation = new Map<string, { nationId: string; areaId: string }>();
    for (const fleet of fleets) {
      for (const ship of fleet.ships) {
        shipLocation.set(ship.id, { nationId: fleet.nationId, areaId: fleet.locationAreaId });
      }
    }
    for (const division of divisions) {
      expect(division.shipOrder.length).toBeGreaterThan(0);
      const areas = new Set<string>();
      for (const shipId of division.shipOrder) {
        const located = shipLocation.get(shipId);
        expect(located, `division ${division.id} references unknown ship ${shipId}`).toBeDefined();
        expect(located!.nationId).toBe(division.nationId);
        areas.add(located!.areaId);
      }
      expect(areas.size, `division ${division.id} ships are not co-located`).toBe(1);
    }
  });

  it("names a flagship-first order and a real per-nation officer command", () => {
    for (const division of divisions) {
      expect(division.shipOrder.length, `division ${division.id} empty`).toBeGreaterThanOrEqual(1);
      if (division.commanderOfficerId !== undefined) {
        expect(division.commanderOfficerId).toMatch(new RegExp(`^off_${division.nationId}_\\d+$`));
      }
      expect(["INDEPENDENT", "CORE", "SUPPORT", "SCOUT", "SCREEN", "PATROL"]).toContain(
        division.divisionRole,
      );
      expect(["LINE_AHEAD", "LINE_ABREAST", "SEARCH_LINE", "SCREEN"]).toContain(
        division.preferredFormation,
      );
    }
  });

  it("documents every record's direction and marks its composition a balance choice", () => {
    for (const division of divisions) {
      const provenance = division.provenance;
      expect(provenance, `missing provenance on ${division.id}`).toBeDefined();
      expect(provenance!.kind).toBe("balance_adjustment");
      expect(provenance!.sourceStatus).toBe("BALANCE_TARGET");
    }
  });
});
