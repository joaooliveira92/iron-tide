import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

/**
 * Construction target/design consistency (N-1 ticket 03). A ship-building
 * project must build the class of the ship it targets: the design's class name
 * equals the target ship's class id. (The constructed design's *id* need not
 * equal the ship id — e.g. a class member built from its class design.)
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

describe("construction target/design consistency (N-1 ticket 03)", () => {
  const bundle = buildProductionBundle();
  const fleets = bundle.campaign?.fleets ?? [];
  const designs = bundle.campaign?.designs ?? [];
  const constructions = bundle.campaign?.constructions ?? [];

  const shipClassById = new Map(
    fleets.flatMap((fleet) => fleet.ships.map((ship) => [ship.id, ship.classId] as const)),
  );
  const designClassById = new Map(
    designs.map((design) => [design.designVersionId, design.className] as const),
  );

  it("builds the target ship's class for every ship-building project", () => {
    let checked = 0;
    for (const construction of constructions) {
      if (construction.type !== "ship") continue;
      const designVersionId = construction.designVersionId;
      if (designVersionId === undefined || designVersionId === "") continue;

      const targetClass = shipClassById.get(construction.targetId);
      expect(
        targetClass,
        `project '${construction.id}' targets unknown ship '${construction.targetId}'`,
      ).toBeDefined();
      const builtClass = designClassById.get(designVersionId);
      expect(
        builtClass,
        `project '${construction.id}' references unknown design '${designVersionId}'`,
      ).toBeDefined();
      expect(
        builtClass,
        `project '${construction.id}' builds '${builtClass}' but targets a '${targetClass}' ship`,
      ).toBe(targetClass);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
