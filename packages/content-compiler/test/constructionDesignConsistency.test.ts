import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { constructionsOf, designsOf, fleetsOf } from "./helpers/campaignRecords.js";

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
  const fleets = fleetsOf(bundle);
  const designs = designsOf(bundle);
  const constructions = constructionsOf(bundle);

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
