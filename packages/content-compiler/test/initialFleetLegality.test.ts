import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { designsOf, fleetsOf } from "./helpers/campaignRecords.js";

/**
 * Initial-fleet legality (N-1 ticket 01, resolved by ADR-0212). Every starting
 * ship in the 1880 scenario must either resolve to a design that existed by 1880
 * or carry an explicit, documented exemption. The chosen rule is the global 1880
 * tech set: research gates new construction, modernization and design, not
 * inherited service, so a ship is legal when its design predates 1880.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");

const SCENARIO_YEAR = 1880;

/**
 * Starting ships with no modelled 1880 design, grandfathered under ADR-0212.
 * Each entry is a shipped historical hull the scenario opens with; a matching
 * design is authored later (ticket 08 for the UK placeholder). The value is the
 * required reason.
 */
const DESIGN_LESS_EXEMPTIONS: ReadonlyMap<string, string> = new Map([
  [
    "aut_custoza",
    "Austro-Hungarian Custoza-class ironclad; no 1880 design is authored in the pack.",
  ],
  [
    "gbr_temeraire",
    "UK Temeraire-class central-battery ironclad; no 1880 design is authored in the pack.",
  ],
]);

function buildProductionBundle(): ContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  expect(collector.hasErrors).toBe(false);
  expect(output).toBeDefined();
  return output!.bundle;
}

/** The four-digit year a design entered service, or `undefined` when unrecorded. */
function designYear(familyCreationMonth: string | undefined): number | undefined {
  if (typeof familyCreationMonth !== "string") return undefined;
  const match = /^(\d{4})-/.exec(familyCreationMonth);
  return match ? Number(match[1]) : undefined;
}

describe("initial fleet legality (ADR-0212)", () => {
  const bundle = buildProductionBundle();
  const fleets = fleetsOf(bundle);
  const designs = designsOf(bundle);
  const designById = new Map(designs.map((design) => [design.designVersionId, design]));
  const ships = fleets.flatMap((fleet) => fleet.ships);
  const designLess = ships.filter(
    (ship) => ship.designVersionId === undefined || ship.designVersionId === "",
  );

  it("compiles a non-empty starting order of battle", () => {
    expect(fleets.length).toBeGreaterThan(0);
    expect(ships.length).toBeGreaterThan(0);
  });

  it("links every design-carrying starting ship to a design that predates 1880", () => {
    for (const ship of ships) {
      const designVersionId = ship.designVersionId;
      if (designVersionId === undefined || designVersionId === "") continue;
      const design = designById.get(designVersionId);
      expect(design, `ship '${ship.id}' references '${designVersionId}'`).toBeDefined();
      const year = designYear(design?.familyCreationMonth);
      expect(year, `design '${designVersionId}' has no familyCreationMonth`).toBeDefined();
      expect(
        year ?? Number.POSITIVE_INFINITY,
        `ship '${ship.id}' design '${designVersionId}'`,
      ).toBeLessThanOrEqual(SCENARIO_YEAR);
    }
  });

  it("documents every design-less starting ship with an explicit exemption", () => {
    for (const ship of designLess) {
      const reason = DESIGN_LESS_EXEMPTIONS.get(ship.id);
      expect(reason, `design-less ship '${ship.id}' has no exemption`).toBeDefined();
      expect(reason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("carries no stale exemptions", () => {
    const designLessIds = new Set(designLess.map((ship) => ship.id));
    for (const exemptId of DESIGN_LESS_EXEMPTIONS.keys()) {
      expect(designLessIds.has(exemptId), `stale exemption '${exemptId}'`).toBe(true);
    }
  });
});
