import { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { nationsYaml } from "@bluewave/test-support";
import {
  loadContentDirectory,
  saveProjectFile,
  loadProjectFile,
  extractProject,
  buildProject,
  serializeProject,
  loadProjectFileJson,
} from "../src/main/project.js";

const FIXTURE_FILES: Record<string, string> = {
  "pack.json": JSON.stringify({
    name: "1880-test-scenario",
    version: "0.1.0",
    type: "fixture",
    files: {
      rulesets: ["rulesets.yaml"],
      countries: ["countries.yaml"],
    },
  }),
  "rulesets.yaml": `- id: "core"\n  name: "Core Rules"\n  version: "1.0"\n`,
  "countries.yaml": nationsYaml([{ id: "uk", tag: "GBR", name: "United Kingdom" }]),
};

function writeFixture(dir: string): void {
  for (const [name, content] of Object.entries(FIXTURE_FILES)) {
    writeFileSync(resolve(dir, name), content, "utf8");
  }
}

describe("project module", () => {
  let fixtureDir: string;
  let workingDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(resolve(tmpdir(), "bw-project-src-"));
    workingDir = mkdtempSync(resolve(tmpdir(), "bw-project-dst-"));
    mkdirSync(fixtureDir, { recursive: true });
    writeFixture(fixtureDir);
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(workingDir, { recursive: true, force: true });
  });

  it("loads a content directory into a project", () => {
    const project = loadContentDirectory(fixtureDir);
    expect(project.format).toBe("bluewave-project");
    expect(project.version).toBe(1);
    expect(project.name).toBe("1880-test-scenario");
    expect(project.manifest.name).toBe("1880-test-scenario");
    expect(project.files["rulesets.yaml"]).toContain('id: "core"');
    expect(project.files["countries.yaml"]).toBeDefined();
  });

  it("round-trips a project through a saved file", () => {
    const tmpProj = mkdtempSync(resolve(tmpdir(), "bw-project-file-"));
    const destPath = resolve(tmpProj, "scenario.bluewave");
    const project = loadContentDirectory(fixtureDir);
    saveProjectFile(project, destPath);

    const loaded = loadProjectFile(destPath);
    expect(loaded.name).toBe("1880-test-scenario");
    expect(loaded.files).toEqual(project.files);

    const extracted = resolve(workingDir, "extracted");
    extractProject(loaded, extracted);
    expect(readFileSync(resolve(extracted, "pack.json"), "utf8")).toContain("1880-test-scenario");
    expect(existsSync(resolve(extracted, "rulesets.yaml"))).toBe(true);
    expect(readFileSync(resolve(extracted, "countries.yaml"), "utf8")).toBe(
      project.files["countries.yaml"],
    );

    rmSync(tmpProj, { recursive: true, force: true });
    rmSync(extracted, { recursive: true, force: true });
  });

  it("throws on a non-project file", () => {
    const tmpProj = mkdtempSync(resolve(tmpdir(), "bw-project-bad-"));
    const badPath = resolve(tmpProj, "bad.json");
    writeFileSync(badPath, '{"hello": "world"}', "utf8");
    expect(() => loadProjectFile(badPath)).toThrow();
    rmSync(tmpProj, { recursive: true, force: true });
  });

  it("loadProjectFileJson parses serialized project strings", () => {
    const project = loadContentDirectory(fixtureDir);
    const json = serializeProject(project);
    const parsed = loadProjectFileJson(json);
    expect(parsed.name).toBe(project.name);
    expect(parsed.files).toEqual(project.files);
  });

  it("rejects path traversal filenames when serializing", () => {
    const project = buildProject({ name: "evil", files: {} }, {});
    expect(() => loadProjectFileJson(serializeProject(project))).not.toThrow();
    expect(() =>
      loadProjectFileJson(
        '{"format":"bluewave-project","version":1,"name":"x","manifest":{},"files":{"..\\..\\x.yaml":"data"}}',
      ),
    ).toThrow();
  });
});
