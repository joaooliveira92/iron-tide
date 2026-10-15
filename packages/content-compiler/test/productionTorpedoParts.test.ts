import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

/**
 * Production index propagation (ship-part-model ticket 13a): the compiled artifact carries the
 * torpedo parts and every `DQ-TORPEDO-001` `forPart` cross-reference resolves to a torpedo.
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

describe("production part index carries the torpedo family (13a)", () => {
  const bundle = buildProductionBundle();
  const index = bundle.shipBuilding?.partModel?.partIndex;

  it("indexes the eight torpedo parts and the 19 launchers", () => {
    expect(index?.byFamily.torpedo).toHaveLength(8);
    expect(index?.byFamily.torpedo_launcher).toHaveLength(19);
    expect(index?.byInterface.torpedo).toEqual(index?.byFamily.torpedo);
  });

  it("resolves every launcher waiver's forPart to a strictly decoded torpedo part", () => {
    const byId = index?.byId ?? {};
    let waivers = 0;
    for (const launcher of index?.byFamily.torpedo_launcher ?? []) {
      const part = byId[launcher];
      for (const exception of part.legacyExceptions ?? []) {
        waivers += 1;
        expect(byId[exception.forPart]?.family, exception.forPart).toBe("torpedo");
      }
    }
    expect(waivers).toBe(5);
  });

  it("carries the 1884 Whitehead revision in the index", () => {
    const whitehead = index?.byId["whitehead_14in_1886"];
    expect(whitehead?.family).toBe("torpedo");
    expect(whitehead?.revisions.map((r) => r.from)).toEqual(["1884-01"]);
    if (whitehead?.family !== "torpedo") return;
    expect(whitehead.spec.warheadExplosiveMassKg).toBe(12);
  });
});
