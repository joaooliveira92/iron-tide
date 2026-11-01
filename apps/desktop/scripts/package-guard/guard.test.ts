import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { encodeAsar } from "./asar.ts";
import { PackageGuardInputError, PackagePolicyError } from "./errors.ts";
import { evaluatePackage, formatReport } from "./guard.ts";
import { decodePolicy, type PackageMode, type PackagePolicy } from "./policy.ts";
import { snapshotPackage } from "./snapshot.ts";

const POLICY_FILE = join(
  import.meta.dirname,
  "..",
  "..",
  "package-policy",
  "package-policy.v1.json",
);
const realPolicy = decodePolicy(JSON.parse(readFileSync(POLICY_FILE, "utf8")));

function budgeted(policy: PackagePolicy, archive: number, outside: number): PackagePolicy {
  const budget = (mode: PackageMode) => ({
    ...policy.modes[mode].budget,
    archiveBytesMax: archive,
    outsideArchiveBytesMax: outside,
  });
  return {
    ...policy,
    modes: {
      default: { ...policy.modes.default, budget: budget("default") },
      spike: { ...policy.modes.spike, budget: budget("spike") },
      adapter: { ...policy.modes.adapter, budget: budget("adapter") },
    },
  };
}

const policy = budgeted(realPolicy, 5_000_000, 100_000);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

interface Layout {
  readonly archive: ReadonlyMap<string, Uint8Array>;
  readonly outside?: ReadonlyMap<string, Uint8Array>;
}

function writePackage(
  layout: Layout,
  resourcesRelative = "Bluewave.app/Contents/Resources",
): string {
  const root = mkdtempSync(join(tmpdir(), "bw-package-guard-"));
  roots.push(root);
  const resources = join(root, resourcesRelative);
  mkdirSync(resources, { recursive: true });
  writeFileSync(join(resources, "app.asar"), encodeAsar(layout.archive));
  for (const [path, data] of layout.outside ?? []) {
    const target = join(resources, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  return root;
}

const BASE_ARCHIVE = (): Map<string, Uint8Array> =>
  new Map<string, Uint8Array>([
    ["package.json", text('{"name":"bluewave"}')],
    ["out/main/index.js", text("export {}")],
    ["out/renderer/index.html", text("<html></html>")],
    ["out/renderer/assets/index-abc.js", randomBytes(300_000)],
    ["out/renderer/assets/coastline-data-abc.js", randomBytes(200_000)],
    ["node_modules/maplibre-gl/dist/maplibre-gl.js", randomBytes(2_500_000)],
  ]);

function withProductionAssets(archive: Map<string, Uint8Array>): Map<string, Uint8Array> {
  const pack = randomBytes(40_000);
  const manifest = {
    integrity: { packSha256: sha(pack) },
    sizes: { packBytes: pack.length },
  };
  archive.set("out/renderer/map-assets/land-tiles/land.bwtp", pack);
  archive.set("out/renderer/map-assets/land-tiles/manifest.json", text(JSON.stringify(manifest)));
  archive.set("out/renderer/map-assets/land-tiles/licences/natural-earth-terms.txt", text("terms"));
  archive.set("out/renderer/map-assets/glyphs/Inter Regular/0-255.pbf", randomBytes(2_000));
  archive.set("out/renderer/map-assets/glyphs/OFL.txt", text("SIL OFL 1.1"));
  archive.set("out/renderer/assets/GlobeAdapter-abc.js", randomBytes(20_000));
  return archive;
}

const DEFAULT_ARCHIVE = (): Map<string, Uint8Array> => withProductionAssets(BASE_ARCHIVE());

function spikeArchive(): Map<string, Uint8Array> {
  const archive = BASE_ARCHIVE();
  const pack = randomBytes(40_000);
  const manifest = {
    integrity: { packSha256: sha(pack) },
    sizes: { packBytes: pack.length },
  };
  archive.set("out/renderer/map-spike/land-tiles/land.bwtp", pack);
  archive.set("out/renderer/map-spike/land-tiles/manifest.json", text(JSON.stringify(manifest)));
  archive.set("out/renderer/map-spike/land-tiles/licences/natural-earth-terms.txt", text("terms"));
  archive.set("out/renderer/map-spike/glyphs/Inter Regular/0-255.pbf", randomBytes(2_000));
  archive.set("out/renderer/assets/GlobeSpike-abc.js", randomBytes(20_000));
  return archive;
}

function run(layout: Layout, mode: PackageMode, using: PackagePolicy = policy) {
  return evaluatePackage(snapshotPackage(writePackage(layout)), using, mode);
}

function rules(layout: Layout, mode: PackageMode, using: PackagePolicy = policy): string[] {
  return run(layout, mode, using).violations.map(
    (violation) => `${violation.rule}@${violation.path}`,
  );
}

describe("clean packages", () => {
  it("passes a clean default package", () => {
    const report = run({ archive: DEFAULT_ARCHIVE() }, "default");
    expect(report.violations).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("passes a clean spike package under its own policy", () => {
    const report = run({ archive: spikeArchive() }, "spike");
    expect(report.violations).toEqual([]);
    expect(report.counts.allowed).toBe(5);
  });

  it("accepts an expected default runtime asset", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/renderer/assets/hero-abc.png", randomBytes(900_000));
    expect(rules({ archive }, "default")).toEqual([]);
  });

  it("allows the packaged corrupt-pack fixture only in spike mode", () => {
    const archive = spikeArchive();
    archive.set("out/renderer/map-spike/land-tiles-corrupt/land.bwtp", randomBytes(5_000));
    archive.set("out/renderer/map-spike/land-tiles-corrupt/manifest.json", text("{}"));
    expect(rules({ archive }, "spike")).toEqual([]);
    expect(rules({ archive }, "default")).toContain(
      "spike-runtime-asset@out/renderer/map-spike/land-tiles-corrupt/land.bwtp",
    );
  });
});

describe("production globe package policy", () => {
  it("requires the production pack, manifest, glyphs and adapter chunk", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.delete("out/renderer/map-assets/land-tiles/land.bwtp");
    archive.delete("out/renderer/map-assets/land-tiles/manifest.json");
    archive.delete("out/renderer/map-assets/glyphs/Inter Regular/0-255.pbf");
    archive.delete("out/renderer/assets/GlobeAdapter-abc.js");
    expect(rules({ archive }, "default")).toEqual(
      expect.arrayContaining([
        "production-tile-pack:missing@out/renderer/map-assets/land-tiles/land.bwtp",
        "production-tile-manifest:missing@out/renderer/map-assets/land-tiles/manifest.json",
        "production-glyphs:missing@out/renderer/map-assets/glyphs/**/*.pbf",
        "production-adapter-chunk:missing@out/renderer/assets/GlobeAdapter-*.js",
      ]),
    );
  });

  it("rejects a production pack that does not match its manifest", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/renderer/map-assets/land-tiles/land.bwtp", randomBytes(40_000));
    expect(rules({ archive }, "default")).toContain(
      "spike-pack-integrity@out/renderer/map-assets/land-tiles/land.bwtp",
    );
  });

  it("rejects the production pack when it outgrows its cap", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/renderer/map-assets/land-tiles/land.bwtp", randomBytes(20_100_000));
    expect(rules({ archive }, "default")).toContain(
      "production-tile-pack:size@out/renderer/map-assets/land-tiles/land.bwtp",
    );
  });
});

describe("contamination of the default package", () => {
  it("rejects a generated tile pack and manifest in the archive", () => {
    const found = rules({ archive: spikeArchive() }, "default");
    expect(found).toContain("spike-runtime-asset@out/renderer/map-spike/land-tiles/land.bwtp");
    expect(found).toContain("spike-runtime-asset@out/renderer/map-spike/land-tiles/manifest.json");
    expect(found).toContain("spike-code-chunk@out/renderer/assets/GlobeSpike-abc.js");
  });

  it("rejects a source archive beside the application archive", () => {
    const found = rules(
      { archive: DEFAULT_ARCHIVE(), outside: new Map([["ne_10m_land.zip", randomBytes(100)]]) },
      "default",
    );
    expect(found).toContain("source-archive@Bluewave.app/Contents/Resources/ne_10m_land.zip");
    expect(found).toContain("extracted-source@Bluewave.app/Contents/Resources/ne_10m_land.zip");
  });

  it("rejects an extraction cache inside the archive", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set(".map-data-cache/ne_10m_land/ne_10m_land.shp", randomBytes(100));
    const found = rules({ archive }, "default");
    expect(found).toContain("source-archive@.map-data-cache/ne_10m_land/ne_10m_land.shp");
    expect(found).toContain("extracted-source@.map-data-cache/ne_10m_land/ne_10m_land.shp");
  });

  it("rejects a forbidden file outside the archive and in the unpacked directory", () => {
    const outside = new Map<string, Uint8Array>([
      ["map-spike/land-tiles/land.bwtp", randomBytes(100)],
      ["app.asar.unpacked/out/renderer/map-spike/land-tiles/land.bwtp", randomBytes(101)],
    ]);
    const report = run({ archive: DEFAULT_ARCHIVE(), outside }, "default");
    expect(report.violations.map((v) => `${v.location}:${v.path}`)).toEqual(
      expect.arrayContaining([
        "outside:Bluewave.app/Contents/Resources/map-spike/land-tiles/land.bwtp",
        "unpacked:out/renderer/map-spike/land-tiles/land.bwtp",
      ]),
    );
  });

  it("rejects investigation evidence, fixtures, validation output and bake inputs", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("test-results/globe-spike/shot.png", randomBytes(50));
    archive.set("evidence/g03-g04/run.log", text("log"));
    archive.set("scripts/map-data/bake.ts", text("export {}"));
    archive.set("map-data/protected-features.v1.json", text("{}"));
    archive.set("fixtures/protected/probe.json", text("{}"));
    archive.set("out/renderer/validation.json", text("{}"));
    archive.set("scripts/globe-spike-land.mjs", text("export {}"));
    const found = rules({ archive }, "default");
    for (const expected of [
      "investigation-evidence@test-results/globe-spike/shot.png",
      "investigation-evidence@evidence/g03-g04/run.log",
      "map-data-input@scripts/map-data/bake.ts",
      "map-data-input@map-data/protected-features.v1.json",
      "test-fixture@fixtures/protected/probe.json",
      "validation-output@out/renderer/validation.json",
      "benchmark-and-harness@scripts/globe-spike-land.mjs",
    ]) {
      expect(found).toContain(expected);
    }
  });

  it("does not infer cleanliness from size: a tiny forbidden file still fails", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/renderer/tiny.bwtp", new Uint8Array([1]));
    expect(rules({ archive }, "default")).toContain("spike-runtime-asset@out/renderer/tiny.bwtp");
  });

  it("rejects byte-identical duplicates of a map asset", () => {
    const archive = spikeArchive();
    const pack = archive.get("out/renderer/map-spike/land-tiles/land.bwtp") as Uint8Array;
    archive.set("out/renderer/map-spike/copy/land.bwtp", pack);
    const found = rules({ archive }, "spike");
    expect(found).toContain("duplicate-copy@out/renderer/map-spike/land-tiles/land.bwtp");
    expect(found).toContain("spike-runtime-asset@out/renderer/map-spike/copy/land.bwtp");
  });
});

describe("spike package policy", () => {
  it("rejects raw source archives and caches even in spike mode", () => {
    const archive = spikeArchive();
    archive.set(".map-data-cache/ne_10m_land.zip", randomBytes(100));
    archive.set("out/renderer/map-spike/land-tiles/ne_10m_land.shp", randomBytes(100));
    const found = rules({ archive }, "spike");
    expect(found).toContain("source-archive@.map-data-cache/ne_10m_land.zip");
    expect(found).toContain("extracted-source@out/renderer/map-spike/land-tiles/ne_10m_land.shp");
  });

  it("rejects validation output and test inputs inside the spike asset directory", () => {
    const archive = spikeArchive();
    archive.set("out/renderer/map-spike/land-tiles/validation.json", text("{}"));
    archive.set("out/renderer/map-spike/land-tiles/protected-resolution.json", text("{}"));
    const found = rules({ archive }, "spike");
    expect(found).toContain("validation-output@out/renderer/map-spike/land-tiles/validation.json");
    expect(found).toContain(
      "test-fixture@out/renderer/map-spike/land-tiles/protected-resolution.json",
    );
  });

  it("requires the tile pack, manifest and glyphs", () => {
    const archive = spikeArchive();
    archive.delete("out/renderer/map-spike/land-tiles/land.bwtp");
    archive.delete("out/renderer/map-spike/land-tiles/manifest.json");
    expect(rules({ archive }, "spike")).toEqual(
      expect.arrayContaining([
        "spike-tile-pack:missing@out/renderer/map-spike/land-tiles/land.bwtp",
        "spike-tile-manifest:missing@out/renderer/map-spike/land-tiles/manifest.json",
      ]),
    );
  });

  it("rejects a tile pack that does not match its manifest", () => {
    const archive = spikeArchive();
    archive.set("out/renderer/map-spike/land-tiles/land.bwtp", randomBytes(40_000));
    expect(rules({ archive }, "spike")).toContain(
      "spike-pack-integrity@out/renderer/map-spike/land-tiles/land.bwtp",
    );
  });

  it("rejects an allowed asset that outgrows its cap", () => {
    const archive = spikeArchive();
    archive.set("out/renderer/map-spike/glyphs/Inter Regular/256-511.pbf", randomBytes(300_000));
    expect(rules({ archive }, "spike")).toContain(
      "spike-glyphs:size@out/renderer/map-spike/glyphs/Inter Regular/256-511.pbf",
    );
  });
});

describe("size policy", () => {
  it("rejects a large unexpected binary outside node_modules", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/renderer/assets/blob.bin", randomBytes(1_500_000));
    expect(rules({ archive }, "default")).toContain(
      "unexpected-large-file@out/renderer/assets/blob.bin",
    );
  });

  it("rejects a large unexpected binary beside the archive", () => {
    expect(
      rules(
        { archive: DEFAULT_ARCHIVE(), outside: new Map([["extra.bin", randomBytes(1_200_000)]]) },
        "default",
      ),
    ).toContain("unexpected-large-file@Bluewave.app/Contents/Resources/extra.bin");
  });

  it("allows the content artifact under the Linux lowercase resources directory", () => {
    const root = writePackage(
      {
        archive: DEFAULT_ARCHIVE(),
        outside: new Map([
          ["content/generated/1880/content-artifact.json", randomBytes(1_500_000)],
        ]),
      },
      "linux-unpacked/resources",
    );
    const generous = budgeted(realPolicy, 210_000_000, 2_000_000);
    expect(evaluatePackage(snapshotPackage(root), generous, "default").violations).toEqual([]);
  });

  it("enforces the archive and outside-resource budgets", () => {
    const tight = budgeted(realPolicy, 100_000, 10);
    const found = rules(
      { archive: DEFAULT_ARCHIVE(), outside: new Map([["notes.txt", text("some resource")]]) },
      "default",
      tight,
    );
    expect(found).toContain("archive-size-budget@app.asar");
    expect(found).toContain("outside-archive-size-budget@Resources (outside app.asar)");
  });

  it("does not budget Electron's own framework files as application resources", () => {
    const outside = new Map<string, Uint8Array>([
      [
        "../Frameworks/Electron Framework.framework/Versions/A/Resources/resources.pak",
        randomBytes(1_500_000),
      ],
    ]);
    expect(rules({ archive: DEFAULT_ARCHIVE(), outside }, "default")).toEqual([]);
  });

  it("holds the named budgets in the shipped policy", () => {
    expect(realPolicy.modes.default.budget.archiveBytesMax).toBeLessThan(
      realPolicy.modes.spike.budget.archiveBytesMax,
    );
    const growth =
      realPolicy.modes.spike.budget.archiveBytesMax -
      realPolicy.modes.default.budget.archiveBytesMax;
    const allowedCaps = realPolicy.modes.spike.allow.reduce((sum, rule) => sum + rule.maxBytes, 0);
    expect(growth).toBeLessThanOrEqual(allowedCaps);
  });
});

describe("machine-specific content", () => {
  it("detects absolute paths serialised into packaged files", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set("out/main/paths.js", text('const root = "/Users/someone/dev/bluewave";'));
    archive.set("out/main/win.json", text('{"p":"C:\\\\Users\\\\someone\\\\dev"}'));
    archive.set("out/main/ok.js", text('const root = "/usr/lib";'));
    const found = rules({ archive }, "default");
    expect(found).toContain("machine-path:macos-home@out/main/paths.js");
    expect(found).toContain("machine-path:windows-home@out/main/win.json");
    expect(found.some((entry) => entry.endsWith("@out/main/ok.js"))).toBe(false);
  });

  it("detects machine-specific files", () => {
    const archive = DEFAULT_ARCHIVE();
    archive.set(".DS_Store", randomBytes(20));
    archive.set("tsconfig.web.tsbuildinfo", text("{}"));
    const found = rules({ archive }, "default");
    expect(found).toContain("machine-specific-file@.DS_Store");
    expect(found).toContain("build-metadata@tsconfig.web.tsbuildinfo");
  });
});

describe("unreadable or missing artefacts", () => {
  it("fails clearly when the package directory is missing", () => {
    expect(() => snapshotPackage(join(tmpdir(), "bw-package-guard-absent"))).toThrow(
      PackageGuardInputError,
    );
  });

  it("fails clearly when there is no app.asar", () => {
    const root = mkdtempSync(join(tmpdir(), "bw-package-guard-"));
    roots.push(root);
    mkdirSync(join(root, "Bluewave.app", "Contents", "Resources"), { recursive: true });
    expect(() => snapshotPackage(root)).toThrow(/no app\.asar/);
  });

  it("fails clearly on a truncated or non-asar archive", () => {
    const root = writePackage({ archive: DEFAULT_ARCHIVE() });
    const file = join(root, "Bluewave.app", "Contents", "Resources", "app.asar");
    writeFileSync(file, readFileSync(file).subarray(0, 12));
    expect(() => snapshotPackage(root)).toThrow(PackageGuardInputError);
    writeFileSync(file, text("this is not an asar archive at all"));
    expect(() => snapshotPackage(root)).toThrow(/not an asar/);
  });

  it("rejects a malformed policy", () => {
    expect(() => decodePolicy({ schemaVersion: 2 })).toThrow(PackagePolicyError);
    expect(() =>
      decodePolicy({ ...JSON.parse(readFileSync(POLICY_FILE, "utf8")), modes: {} }),
    ).toThrow(PackagePolicyError);
  });
});

describe("determinism", () => {
  it("orders and renders results identically regardless of file insertion order", () => {
    const forward = spikeArchive();
    forward.set("test-results/a.png", randomBytes(10));
    forward.set("evidence/b.log", text("x"));
    const reversed = new Map([...forward].reverse());
    const a = formatReport(run({ archive: forward }, "default"));
    const b = formatReport(run({ archive: reversed }, "default"));
    expect(a.replace(/[0-9a-f]{64}/g, "")).toBe(b.replace(/[0-9a-f]{64}/g, ""));
    const paths = run({ archive: forward }, "default").violations.map(
      (v) => `${v.location}:${v.path}:${v.rule}`,
    );
    expect(paths).toEqual([...paths].sort((x, y) => (x < y ? -1 : 1)));
  });

  it("never prints the machine-specific location of the package", () => {
    const report = formatReport(run({ archive: spikeArchive() }, "default"));
    expect(report).not.toContain(tmpdir());
    expect(report).not.toContain("bw-package-guard-");
  });
});
