#!/usr/bin/env node
// Single-copy `effect` guard (MIG-GRAPH-1 / MIG-GRAPH-2).
//
// Effect uses `Context`/`Layer`/service identity at runtime: two copies of
// `effect` in the pnpm graph cause silent failures (services not found,
// `instanceof` mismatches). This guard inspects `pnpm-lock.yaml` and fails when
// the graph contains more than one distinct resolution of `effect`, or when any
// `effect` / `@effect/vitest` is resolved from the npm registry instead of the
// vendored workspace copy.
//
// Spec: `.scratch/effect-v4-vendor-migration/spec.md` — "Single-copy guard"
//       (MIG-GRAPH-1, MIG-GRAPH-2) and `pnpm mechanics` (MIG-VENDOR-4).
// Plan: `.scratch/effect-v4-vendor-migration/plan.md` §2.5.
//
// Usage:
//   node scripts/assert-single-effect.mjs              # check the real lockfile
//   node scripts/assert-single-effect.mjs --self-test  # run embedded fixtures
//
// The check is a pure `checkLockfile(text) -> { ok, findings, resolutions }`; it
// reads no clock, RNG, environment, or network, so its verdict is deterministic.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCKFILE = path.join(ROOT, "pnpm-lock.yaml");

const EFFECT = "effect";
const EFFECT_VITEST = "@effect/vitest";

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

// Split a lockfile package key ("name@version", possibly with trailing peer
// suffixes like "name@1.2.3(peer@4.5.6)") into name + version. A leading "/"
// (legacy pnpm key form, e.g. "/effect@4.0.2") is stripped so the same name
// detection applies across lockfile generations.
function splitKeyVersion(key) {
  const bare = key.replace(/^\//, "").replace(/\(.*$/, "");
  const at = bare.lastIndexOf("@");
  if (at <= 0) return { name: bare, version: null };
  return { name: bare.slice(0, at), version: bare.slice(at + 1) };
}

// Normalize an importer's `version:` value into a stable resolution identity.
// A workspace link is resolved relative to its importer so that the same
// workspace package linked from two different depths dedupes to one target.
function normalizeResolution(importer, value) {
  if (value.startsWith("link:")) {
    const target = value.slice("link:".length);
    const base = importer === "." ? "" : importer;
    const abs = path.posix.normalize(path.posix.join(base, target));
    return `workspace:${abs.replace(/^\.\//, "")}`;
  }
  if (value.startsWith("file:")) return `file:${value.slice("file:".length)}`;
  const npmAlias = value.match(/^npm:(.+)$/);
  if (npmAlias) return `registry:${npmAlias[1]}`;
  return `registry:${value}`;
}

// Pure lockfile scan. Dependency-free: the keys we care about sit at fixed
// indentation in the pnpm lockfile v9 format, so a targeted line scan is more
// robust (and far smaller) than a general YAML parser.
export function checkLockfile(text) {
  const lines = text.split(/\r?\n/);
  const registryEntries = []; // { name, version, key, section }
  const effectResolutions = new Set();
  const registryVitest = [];

  // Fail closed if this does not look like a pnpm lockfile at all: a present but
  // empty/truncated/garbage file must not pass the hard gate with a false "ok".
  const hasVersion = lines.some((l) => /^lockfileVersion:\s*'?\d/.test(l));
  const hasSection = lines.some((l) => /^(importers|packages|snapshots):\s*$/.test(l));

  let section = null;
  let importer = null;
  let dep = null;

  for (const raw of lines) {
    const sec = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*$/);
    if (sec) {
      section = sec[1];
      importer = null;
      dep = null;
      continue;
    }

    if (section === "packages" || section === "snapshots") {
      // Package keys are exactly two spaces in; nested keys are deeper. Catch
      // both `  name@ver:` and inline `  name@ver: {}` entries.
      const m = raw.match(/^ {2}([^:]+):\s*(\{.*\})?\s*$/);
      if (m) {
        const key = unquote(m[1]);
        const { name, version } = splitKeyVersion(key);
        if (name === EFFECT || name === EFFECT_VITEST) {
          const entry = { name, version, key, section };
          registryEntries.push(entry);
          if (name === EFFECT) effectResolutions.add(`registry:${version}`);
          else registryVitest.push(entry);
        }
      }
      continue;
    }

    if (section === "importers") {
      // 2 spaces: importer path; 4 spaces: dependency group; 6 spaces: dependency
      // name; 8 spaces: its `specifier`/`version`.
      const m2 = raw.match(/^ {2}(\S.*?):\s*$/);
      if (m2) {
        importer = unquote(m2[1]);
        dep = null;
        continue;
      }
      const m4 = raw.match(/^ {4}(\S.*?):\s*$/);
      if (m4) {
        dep = unquote(m4[1]);
        continue;
      }
      const m6 = raw.match(/^ {6}(\S.*?):\s*$/);
      if (m6) {
        dep = unquote(m6[1]);
        continue;
      }
      const m8 = raw.match(/^ {8}version:\s*(.*?)\s*$/);
      if (m8 && dep) {
        if (dep === EFFECT) {
          effectResolutions.add(normalizeResolution(importer, unquote(m8[1])));
        }
        dep = null;
        continue;
      }
    }
  }

  const findings = [];

  if (!hasVersion || !hasSection) {
    findings.push(
      "unrecognized pnpm-lock.yaml (missing a `lockfileVersion:` header or a known section) — failing closed",
    );
  }

  // (b) any registry `effect` / `@effect/vitest` package entry is a failure.
  for (const entry of registryEntries) {
    findings.push(
      `registry ${entry.name} resolution present: ${entry.key} (in \`${entry.section}:\`)`,
    );
  }
  // Keep the explicit vitest flag separate for a clear diagnostic even if the
  // loop above ever changes shape.
  if (registryVitest.length > 0 && !registryEntries.some((e) => e.name === EFFECT_VITEST)) {
    for (const entry of registryVitest) {
      findings.push(`registry @effect/vitest resolution present: ${entry.key}`);
    }
  }

  // (a) more than one distinct resolution of `effect`.
  const resolutions = [...effectResolutions].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (resolutions.length > 1) {
    findings.push(
      `more than one distinct effect resolution in the pnpm graph: ${resolutions.join(", ")}`,
    );
  }

  return { ok: findings.length === 0, findings, resolutions };
}

// ---- embedded self-test fixtures ------------------------------------------
// Each fixture is a minimal lockfile snippet with the outcome the checker must
// reproduce. `effect@4.0.2` in `packages:` must fail; two link targets must fail.
const FIXTURES = [
  {
    name: "zero-resolution is ok",
    expectOk: true,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    devDependencies:",
      "      typescript:",
      "        specifier: 7.0.2",
      "        version: 7.0.2",
      "",
      "packages:",
      "",
      "  typescript@7.0.2:",
      "    resolution: {integrity: sha512-AAAA}",
      "",
      "snapshots:",
      "",
      "  typescript@7.0.2: {}",
    ].join("\n"),
  },
  {
    name: "single workspace link is ok",
    expectOk: true,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  apps/consumer:",
      "    dependencies:",
      "      effect:",
      "        specifier: workspace:*",
      "        version: link:../../vendor/effect",
      "",
      "packages: {}",
      "",
      "snapshots: {}",
    ].join("\n"),
  },
  {
    name: "same workspace link from two depths dedupes to one resolution",
    expectOk: true,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    dependencies:",
      "      effect:",
      "        specifier: workspace:*",
      "        version: link:vendor/effect",
      "  apps/consumer:",
      "    dependencies:",
      "      effect:",
      "        specifier: workspace:*",
      "        version: link:../../vendor/effect",
      "",
      "packages: {}",
      "",
      "snapshots: {}",
    ].join("\n"),
  },
  {
    name: "registry effect package entry fails",
    expectOk: false,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    dependencies:",
      "      effect:",
      "        specifier: ^4.0.2",
      "        version: 4.0.2",
      "",
      "packages:",
      "",
      "  effect@4.0.2:",
      "    resolution: {integrity: sha512-BBBB}",
      "",
      "snapshots:",
      "",
      "  effect@4.0.2: {}",
    ].join("\n"),
  },
  {
    name: "two distinct effect link targets fail",
    expectOk: false,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  apps/a:",
      "    dependencies:",
      "      effect:",
      "        specifier: workspace:*",
      "        version: link:../../vendor/effect",
      "  vendor/effect-vitest:",
      "    dependencies:",
      "      effect:",
      "        specifier: workspace:*",
      "        version: link:../other-effect",
      "",
      "packages: {}",
      "",
      "snapshots: {}",
    ].join("\n"),
  },
  {
    name: "registry @effect/vitest package entry fails",
    expectOk: false,
    lockfile: [
      "lockfileVersion: '9.0'",
      "",
      "importers: {}",
      "",
      "packages:",
      "",
      "  '@effect/vitest@4.0.2':",
      "    resolution: {integrity: sha512-CCCC}",
      "",
      "snapshots: {}",
    ].join("\n"),
  },
  {
    name: "legacy leading-slash registry effect key fails",
    expectOk: false,
    lockfile: [
      "lockfileVersion: '6.0'",
      "",
      "packages:",
      "",
      "  /effect@4.0.2:",
      "    resolution: {integrity: sha512-DDDD}",
    ].join("\n"),
  },
  {
    name: "empty lockfile fails closed",
    expectOk: false,
    lockfile: "",
  },
  {
    name: "header-less garbage fails closed",
    expectOk: false,
    lockfile: "not: a lockfile\nrandom text",
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const { ok, findings } = checkLockfile(fixture.lockfile);
    const passed = ok === fixture.expectOk;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    const detail = findings.length > 0 ? ` — ${findings.join("; ")}` : "";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${fixture.expectOk ? "ok" : "fail"}, got ${ok ? "ok" : "fail"}${detail}`,
    );
  }
  return { ok: failed === 0, failed, total: fixtures.length };
}

function main() {
  if (process.argv.includes("--self-test")) {
    console.log("assert-single-effect: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(`assert-single-effect: self-test FAILED (${failed}/${total} fixtures)`);
      process.exit(1);
    }
    console.log(`assert-single-effect: self-test ok (${total} fixtures)`);
    return;
  }

  if (!fs.existsSync(LOCKFILE)) {
    console.error(
      `assert-single-effect: FAILED — ${path.relative(ROOT, LOCKFILE)} is missing; ` +
        "cannot verify the single-copy `effect` invariant. Run `pnpm install` first.",
    );
    process.exit(1);
  }

  const { ok, findings, resolutions } = checkLockfile(fs.readFileSync(LOCKFILE, "utf8"));
  if (!ok) {
    console.error(
      "assert-single-effect: FAILED — the pnpm graph violates the single-copy `effect` invariant:",
    );
    for (const finding of findings) console.error(`  - ${finding}`);
    console.error(
      "Fix: keep `vendor/effect` + `vendor/effect-vitest` in pnpm-workspace.yaml `packages:` and map",
    );
    console.error(
      "`effect`/`@effect/vitest` to `workspace:*` in pnpm-workspace.yaml `overrides:`, then re-run `pnpm install`.",
    );
    process.exit(1);
  }

  const detail =
    resolutions.length === 0
      ? "no effect resolution yet (wiring-only state)"
      : `${resolutions.join(", ")}`;
  console.log(`assert-single-effect: ok (no registry effect; ${detail})`);
}

// Only run the CLI when this module is the entrypoint. Compare real paths so a
// symlinked or `/var`-vs-`/private/var` spelling cannot silently no-op the gate.
function isEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main();
}
