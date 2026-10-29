import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DesignLoadoutSchema, FlattenedPartSchema, decodeStrict } from "@bluewave/content-schema";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { fromYaml } from "../src/yaml.js";
import {
  loadLegacySource,
  planFromLegacy,
  planFromStaged,
  publishMigration,
  readStagedSource,
  validateStagingDir,
} from "../src/index.js";
import {
  contentDir,
  legacySource,
  torpedoDiameterUm,
  torpedoModels,
} from "./helpers/production.js";
import { hashDir, listFiles, makeTempRoot, removeDir } from "./helpers/temp.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

const plannedResult = planFromLegacy(legacySource);
if (!plannedResult.ok) throw new Error(JSON.stringify(plannedResult.failures));
const planned = plannedResult.value;

describe("content codemod publisher (ticket 11c)", () => {
  let root: string;
  beforeEach(() => {
    root = makeTempRoot();
  });
  afterEach(() => {
    removeDir(root);
  });

  it("publishes a complete tree and cleans its temporary files", () => {
    const stagingDir = join(root, "staged");
    const result = publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    expect(result.ok).toBe(true);
    const files = listFiles(stagingDir);
    expect(files).toContain("manifest.json");
    expect(files).toContain("platforms.yaml");
    expect(files).toContain("slot-templates.yaml");
    expect(files.some((f) => f.startsWith("parts/"))).toBe(true);
    expect(files.some((f) => f.startsWith("designs/"))).toBe(true);
    expect(files.some((f) => f.includes(".codemod-tmp"))).toBe(false);
    expect(files.some((f) => f.includes(".codemod-old"))).toBe(false);
    expect(existsSync(`${stagingDir}.codemod-tmp`)).toBe(false);
  });

  it("strictly decodes every published record from disk", () => {
    const stagingDir = join(root, "staged");
    publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    const read = readStagedSource(stagingDir);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.parts).toHaveLength(327);
    expect(read.value.designs).toHaveLength(97);
    for (const file of listFiles(stagingDir).filter((f) => f.startsWith("parts/"))) {
      const raw = fromYaml(readFileSync(join(stagingDir, file), "utf8"));
      for (const record of (raw as { parts: unknown[] }).parts) {
        decodeStrict(FlattenedPartSchema, record);
      }
    }
    for (const file of listFiles(stagingDir).filter((f) => f.startsWith("designs/"))) {
      const raw = fromYaml(readFileSync(join(stagingDir, file), "utf8"));
      for (const record of (raw as { designs: { header: unknown; loadout: unknown }[] }).designs) {
        decodeStrict(DesignLoadoutSchema, { header: record.header, loadout: record.loadout });
      }
    }
  });

  it("is byte-identical across two clean staging directories", () => {
    const a = join(root, "a");
    const b = join(root, "b");
    publishMigration(planned, { stagingDir: a, protectedRoots: [contentDir] });
    publishMigration(planned, { stagingDir: b, protectedRoots: [contentDir] });
    const filesA = listFiles(a);
    const filesB = listFiles(b);
    expect(filesA).toEqual(filesB);
    for (const file of filesA) {
      expect(readFileSync(join(b, file)), file).toEqual(readFileSync(join(a, file)));
    }
  });

  it("is a fixed point: a staged tree re-migrates without a second diff", () => {
    const stagingDir = join(root, "staged");
    publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    const read = readStagedSource(stagingDir);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const second = planFromStaged(read.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.contentHash).toBe(planned.contentHash);
    const republish = publishMigration(second.value, {
      stagingDir,
      protectedRoots: [contentDir],
      ifExists: "replace",
    });
    expect(republish.ok).toBe(true);
    if (republish.ok) expect(republish.value.noop).toBe(true);
    const reread = readStagedSource(stagingDir);
    expect(reread.ok && reread.value.designs.length).toBe(97);
  });

  it("refuses unsafe, ambiguous or protected output paths", () => {
    const cases: readonly string[] = [
      "/",
      "relative/dir",
      `${root}/a/../b`,
      contentDir,
      join(contentDir, "stage"),
      repoRoot,
    ];
    for (const stagingDir of cases) {
      const result = publishMigration(planned, {
        stagingDir,
        protectedRoots: [contentDir, repoRoot],
      });
      expect(result.ok, stagingDir).toBe(false);
      if (!result.ok) expect(result.failures.map((f) => f.code)).toContain("CODEMOD_UNSAFE_OUTPUT");
    }
    expect(validateStagingDir({ stagingDir: "", protectedRoots: [] }).ok).toBe(false);
  });

  it("refuses an existing destination by default and republishes on request", () => {
    const stagingDir = join(root, "staged");
    publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    const refused = publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    expect(refused.ok).toBe(false);
    if (!refused.ok)
      expect(refused.failures.map((f) => f.code)).toContain("CODEMOD_EXISTING_OUTPUT");

    writeFileSync(join(stagingDir, "foreign.txt"), "not ours", "utf8");
    const replaced = publishMigration(planned, {
      stagingDir,
      protectedRoots: [contentDir],
      ifExists: "replace",
    });
    expect(replaced.ok).toBe(true);
    expect(existsSync(join(stagingDir, "foreign.txt"))).toBe(false);
    expect(listFiles(stagingDir)).toContain("manifest.json");
  });

  it("leaves no partial tree when a write fails", () => {
    const blocker = join(root, "blocker");
    writeFileSync(blocker, "a file, not a directory", "utf8");
    const result = publishMigration(planned, {
      stagingDir: join(blocker, "staged"),
      protectedRoots: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures.map((f) => f.code)).toContain("CODEMOD_IO_FAILURE");
    expect(existsSync(blocker)).toBe(true);
    expect(existsSync(`${join(blocker, "staged")}.codemod-tmp`)).toBe(false);
  });

  it("never modifies authoritative production content", () => {
    const before = hashDir(contentDir);
    const result = publishMigration(planned, {
      stagingDir: join(root, "staged"),
      protectedRoots: [contentDir],
    });
    expect(result.ok).toBe(true);
    expect(hashDir(contentDir)).toBe(before);
  });

  it("loads the same content from disk as the in-memory source", () => {
    const loaded = loadLegacySource({ contentDir, torpedoDiameterUm, torpedoModels });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.designs).toHaveLength(97);
    expect(loaded.value.sourceFiles.length).toBeGreaterThan(10);
    const fromDisk = planFromLegacy(loaded.value);
    expect(fromDisk.ok).toBe(true);
    if (fromDisk.ok) expect(fromDisk.value.contentHash).toBe(planned.contentHash);
  });

  it("rejects a malformed staged input with a typed failure", () => {
    const stagingDir = join(root, "staged");
    publishMigration(planned, { stagingDir, protectedRoots: [contentDir] });
    mkdirSync(join(stagingDir, "designs"), { recursive: true });
    writeFileSync(
      join(stagingDir, "designs", "bogus.yaml"),
      "designs:\n  - id: broken\n    name: broken\n    month: 1800-01\n",
      "utf8",
    );
    const read = readStagedSource(stagingDir);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.failures.map((f) => f.code)).toContain("CODEMOD_INVALID_SOURCE");
  });
});
