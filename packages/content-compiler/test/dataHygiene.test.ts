import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { designsOf, fleetsOf } from "./helpers/campaignRecords.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");

const PLACEHOLDER = /temp|placeholder|todo|fixme/i;

function buildProductionBundle(): ContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  expect(collector.hasErrors).toBe(false);
  expect(output).toBeDefined();
  return output!.bundle;
}

describe("1880 data hygiene (N-1 ticket 08)", () => {
  const bundle = buildProductionBundle();
  const fleets = fleetsOf(bundle);
  const designs = designsOf(bundle);

  it("gives every design an unambiguous class name (no cross-era collision)", () => {
    for (const design of designs) {
      for (const other of designs) {
        if (other.designVersionId === design.designVersionId) continue;
        expect(
          other.className.includes(design.className),
          `class '${design.className}' (${design.designVersionId}) is ambiguous with ` +
            `'${other.className}' (${other.designVersionId})`,
        ).toBe(false);
      }
    }
    expect(designs.length).toBeGreaterThan(0);
  });

  it("carries no placeholder token in any ship or design identifier", () => {
    for (const fleet of fleets) {
      for (const ship of fleet.ships) {
        expect(ship.id, `ship id '${ship.id}'`).not.toMatch(PLACEHOLDER);
        expect(ship.classId, `ship classId '${ship.classId}'`).not.toMatch(PLACEHOLDER);
      }
    }
    for (const design of designs) {
      expect(design.designVersionId, `design '${design.designVersionId}'`).not.toMatch(PLACEHOLDER);
      expect(design.className, `class '${design.className}'`).not.toMatch(PLACEHOLDER);
    }
  });
});
