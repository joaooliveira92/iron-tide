import { describe, expect, it } from "vite-plus/test";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");
const manifestPath = resolve(contentDir, "pack.json");

const declaredFiles = (): string[] =>
  (
    JSON.parse(readFileSync(manifestPath, "utf8")) as {
      shipBuilding: { shipComponents: string[] };
    }
  ).shipBuilding.shipComponents;

const shippedComponents = () => {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(manifestPath, contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  expect(collector.hasErrors).toBe(false);
  return (output!.bundle.shipBuilding?.components ?? []) as {
    id: string;
    sourceFile?: string;
  }[];
};

describe("shipped ship components carry their authored file", () => {
  it("stamps every component from the manifest declaration, not a hard-coded path", () => {
    const declared = new Set(declaredFiles());
    const components = shippedComponents();
    expect(components.length).toBeGreaterThan(0);
    for (const component of components) {
      expect(component.sourceFile, component.id).toBeDefined();
      expect(declared.has(component.sourceFile!), component.id).toBe(true);
      expect(existsSync(join(contentDir, component.sourceFile!)), component.sourceFile).toBe(true);
    }
    expect(new Set(components.map((c) => c.sourceFile))).toEqual(declared);
  }, 30_000);
});
