import { describe, it, expect } from "vite-plus/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Compiler, buildFullSurfaceInput } from "../src/index.js";

function createFixtureDir(): { path: string; cleanup: () => void } {
  const dir = resolve(tmpdir(), `bw-manifest-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function writeFixture(base: string, rel: string, content: string): string {
  const full = resolve(base, rel);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
  return full;
}

const COMPONENT = `
components:
  - id: "comp_a"
    displayName: "A"
    category: "MATERIAL"
    introduction: { fromMonth: "1880-01", obsoleteMonth: null }
    requires: []
    parameters: {}
    constants: {}
    weightKg: "1"
    volumeLitre: "1"
    costMicro: "1"
    crew: "0"
    powerKw: "0"
    upgradePath: []
    tags: []
`;

describe("manifest authority for the loaded surface", () => {
  it("loads the ship-building surface declared in the manifest and nothing else", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "production",
          files: {},
          shipBuilding: { shipComponents: ["ship-building/components.yaml"] },
        }),
      );
      writeFixture(fixture.path, "ship-building/components.yaml", COMPONENT);

      const collector = new DiagnosticCollector();
      const input = buildFullSurfaceInput(
        resolve(fixture.path, "pack.json"),
        fixture.path,
        collector,
      );

      expect(collector.hasErrors).toBe(false);
      expect(input!.shipComponentFiles).toEqual([
        resolve(fixture.path, "ship-building/components.yaml"),
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it("fails when a discovered ship-building file is not declared", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({ name: "test-pack", version: "0.1.0", type: "production", files: {} }),
      );
      writeFixture(fixture.path, "ship-building/components.yaml", COMPONENT);

      const collector = new DiagnosticCollector();
      buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path, collector);

      const error = collector.errors.find((d) => d.code === "MANIFEST");
      expect(error).toBeDefined();
      expect(error!.message).toContain("ship-building/components.yaml");
      expect(error!.sourceLocation?.path).toBe("ship-building/components.yaml");
      expect(error!.remediation).toContain("shipBuilding.shipComponents");

      // Without a collector the same failure throws a descriptive error.
      expect(() => buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path)).toThrow(
        /Undeclared/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("fails when a declared file does not exist", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.1.0",
          type: "production",
          files: { countries: ["countries.yaml"] },
        }),
      );

      const collector = new DiagnosticCollector();
      buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path, collector);

      const error = collector.errors.find((d) => d.code === "MANIFEST");
      expect(error).toBeDefined();
      expect(error!.message).toContain("countries.yaml");
      expect(error!.message).toContain("does not exist");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects a malformed manifest with a MANIFEST diagnostic naming the file", () => {
    const fixture = createFixtureDir();
    try {
      // Missing the required `version`/`type` and carrying an excess key: the
      // strict PackManifestSchema decode must reject it (never a cast).
      writeFixture(fixture.path, "pack.json", JSON.stringify({ name: "x", files: {}, extra: 1 }));

      const collector = new DiagnosticCollector();
      const result = buildFullSurfaceInput(
        resolve(fixture.path, "pack.json"),
        fixture.path,
        collector,
      );

      expect(result).toBeUndefined();
      const error = collector.errors.find((d) => d.code === "MANIFEST");
      expect(error).toBeDefined();
      expect(error!.message).toContain("pack.json");
      expect(error!.sourceLocation?.path).toBe("pack.json");
    } finally {
      fixture.cleanup();
    }
  });

  it("excludes the build-only shipBuilding declaration from the artifact manifest", () => {
    const fixture = createFixtureDir();
    try {
      writeFixture(
        fixture.path,
        "pack.json",
        JSON.stringify({
          name: "test-pack",
          version: "0.4.0",
          type: "production",
          files: { rulesets: ["rulesets.yaml"] },
          shipBuilding: { shipComponents: ["ship-building/components.yaml"] },
        }),
      );
      writeFixture(
        fixture.path,
        "rulesets.yaml",
        `- id: "core"\n  name: "Core"\n  version: "1.0"\n`,
      );
      writeFixture(fixture.path, "ship-building/components.yaml", COMPONENT);

      const input = buildFullSurfaceInput(resolve(fixture.path, "pack.json"), fixture.path);
      const collector = new DiagnosticCollector();
      const output = new Compiler().compile(input!, new AbortController().signal, collector);

      expect(collector.hasErrors).toBe(false);
      const manifest = output!.bundle.manifest as Record<string, unknown>;
      expect(manifest["shipBuilding"]).toBeUndefined();
      expect(manifest["name"]).toBe("test-pack");
      expect(manifest["files"]).toEqual({ rulesets: ["rulesets.yaml"] });
    } finally {
      fixture.cleanup();
    }
  });
});
