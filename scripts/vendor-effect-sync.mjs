#!/usr/bin/env node
// Vendor the exact published `effect` and `@effect/vitest` artifacts (vendor
// model V1) into `vendor/`, plus a thin Bluewave workspace wrapper so the workspace
// task runner does not build Effect from source.
//
// Usage:
//   node scripts/vendor-effect-sync.mjs            # sync at the pinned version
//   node scripts/vendor-effect-sync.mjs --verify   # re-check integrity + tree, no writes
//
// The pinned version/integrity lives in PIN below and is mirrored into each
// vendored package's UPSTREAM.md. A no-op re-run at the pin produces an empty
// `git diff --stat` (the sync date is preserved when version + integrity are
// unchanged, so the provenance record is byte-stable across re-runs).

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY = process.argv.includes("--verify");

// --- pin (exact stable only; never an rc) ---------------------------------
const PIN = [
  {
    name: "effect",
    version: "4.0.2",
    dir: "vendor/effect",
    integrity:
      "sha512-YeYnLqSFrL4+tCOXRrfNP03w8FILoF/wDl+ukraJAGzXrjcS383W7LAAvGBbLatEyktmLxRq+9xJinx7QzXW5A==",
    shasum: "568ce7989ece849f55f1acea644bc85b5ea88b2e",
  },
  {
    name: "@effect/vitest",
    version: "4.0.2",
    dir: "vendor/effect-vitest",
    integrity:
      "sha512-Zb72nu7iUy3rNdBp9J1Xu5oUQGwJ8cOYsUwmYgujj88aqyvASRDjOS01SjlcPViqf77csduetKdCJTVndMNfzw==",
    shasum: "",
  },
];

// Files copied verbatim from the published tarball (everything except the
// upstream package.json, which is kept as UPSTREAM.package.json). The wrapper
// package.json and UPSTREAM.md are Bluewave-authored.
const VERBATIM_TOP = ["src", "dist", "LICENSE", "README.md", "AGENTS.md", "CLAUDE.md", "ai-docs"];

function log(msg) {
  console.log(`vendor-effect-sync: ${msg}`);
}

function die(msg) {
  console.error(`vendor-effect-sync: ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function sha512Integrity(file) {
  const hash = createHash("sha512").update(fs.readFileSync(file)).digest("base64");
  return `sha512-${hash}`;
}

async function fetchTarball(pkg, destDir) {
  const metaUrl = `https://registry.npmjs.org/${pkg.name.replace("/", "%2f")}/${pkg.version}`;
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) die(`registry metadata ${metaRes.status} for ${pkg.name}@${pkg.version}`);
  const meta = await metaRes.json();
  const tarballUrl = meta.dist.tarball;
  const tgz = path.join(destDir, `${pkg.name.replace(/[@/]/g, "_")}-${pkg.version}.tgz`);
  const res = await fetch(tarballUrl);
  if (!res.ok) die(`tarball download ${res.status} for ${tarballUrl}`);
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  const integrity = sha512Integrity(tgz);
  if (integrity !== pkg.integrity) {
    die(
      `integrity mismatch for ${pkg.name}@${pkg.version}: expected ${pkg.integrity}, got ${integrity}`,
    );
  }
  return { tgz, tarballUrl, integrity, shasum: meta.dist.shasum };
}

function extract(tgz, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync("tar", ["-xzf", tgz, "-C", destDir], { stdio: ["ignore", "pipe", "pipe"] });
  return path.join(destDir, "package");
}

function copyTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
    else fs.copyFileSync(from, to);
  }
}

// The thin workspace wrapper: identical name/version/exports/files/sideEffects,
// zero build/typecheck/lint/test scripts and no devDependencies, so `vp run -r
// build` skips it rather than invoking Effect's own (unsatisfied) upstream build.
function wrapperPackageJson(upstream) {
  const out = {
    name: upstream.name,
    version: upstream.version,
  };
  for (const key of ["type", "license", "description"]) {
    if (upstream[key] !== undefined) out[key] = upstream[key];
  }
  out.exports = upstream.exports;
  if (upstream.files !== undefined) out.files = upstream.files;
  if (upstream.sideEffects !== undefined) out.sideEffects = upstream.sideEffects;
  if (upstream.peerDependencies !== undefined) out.peerDependencies = upstream.peerDependencies;
  return `${JSON.stringify(out, null, 2)}\n`;
}

function upstreamMd(pkg, info, syncDate) {
  return [
    `# Vendored upstream: \`${pkg.name}\``,
    "",
    "This directory does **not** resolve from the npm registry. It is a vendored",
    "copy of the exact published artifact (vendor model V1), consumed across the",
    'workspace as `"effect"/"@effect/vitest": "workspace:*"`.',
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Upstream repository | https://github.com/Effect-TS/effect (packages/${pkg.name === "effect" ? "effect" : "vitest"}) |`,
    `| Git tag | \`${pkg.name}@${pkg.version}\` |`,
    `| Exact npm version | \`${pkg.version}\` |`,
    `| npm tarball | ${info.tarballUrl} |`,
    `| Tarball integrity (sha512) | \`${info.integrity}\` |`,
    `| Tarball shasum (sha1) | \`${info.shasum}\` |`,
    `| Sync date | ${syncDate} |`,
    "| Patch list | none |",
    "",
    "Regenerate with `node scripts/vendor-effect-sync.mjs`; verify with",
    "`node scripts/vendor-effect-sync.mjs --verify`.",
    "",
  ].join("\n");
}

function readExistingSyncDate(dir) {
  const file = path.join(ROOT, dir, "UPSTREAM.md");
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/\| Sync date \| (\d{4}-\d{2}-\d{2}) \|/);
  const v = text.match(/\| Exact npm version \| `([^`]+)` \|/);
  const i = text.match(/\| Tarball integrity \(sha512\) \| `([^`]+)` \|/);
  return { date: m ? m[1] : null, version: v ? v[1] : null, integrity: i ? i[1] : null };
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs, base));
    else out.push(path.relative(base, abs));
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function compareTrees(expectedDir, actualDir, label) {
  const expected = listFiles(expectedDir);
  const actual = listFiles(actualDir).filter(
    (f) => !["package.json", "UPSTREAM.package.json", "UPSTREAM.md"].includes(f),
  );
  const problems = [];
  for (const f of expected) {
    const a = path.join(expectedDir, f);
    const b = path.join(actualDir, f);
    if (!fs.existsSync(b)) {
      problems.push(`${label}: missing vendored file ${f}`);
    } else if (!fs.readFileSync(a).equals(fs.readFileSync(b))) {
      problems.push(`${label}: content drift in ${f}`);
    }
  }
  for (const f of actual) {
    if (!expected.includes(f)) problems.push(`${label}: unexpected extra file ${f}`);
  }
  return problems;
}

async function vendorOne(pkg, tmpDir) {
  const { tgz, tarballUrl, integrity, shasum } = await fetchTarball(pkg, tmpDir);
  const srcRoot = extract(tgz, path.join(tmpDir, pkg.name.replace(/[@/]/g, "_")));
  const destDir = path.join(ROOT, pkg.dir);
  const upstream = JSON.parse(fs.readFileSync(path.join(srcRoot, "package.json"), "utf8"));

  const prior = readExistingSyncDate(pkg.dir);
  const syncDate =
    prior && prior.version === pkg.version && prior.integrity === `sha512-${integrity.slice(7)}`
      ? prior.date
      : new Date().toISOString().slice(0, 10);

  if (VERIFY) {
    const problems = [];
    if (!fs.existsSync(destDir)) problems.push(`${pkg.dir}: vendored directory missing`);
    else {
      for (const top of VERBATIM_TOP) {
        const e = path.join(srcRoot, top);
        const a = path.join(destDir, top);
        if (!fs.existsSync(e)) continue;
        if (!fs.existsSync(a)) problems.push(`${pkg.dir}: missing ${top}`);
        else if (fs.statSync(e).isDirectory())
          problems.push(...compareTrees(e, a, `${pkg.dir}/${top}`));
        else if (!fs.readFileSync(e).equals(fs.readFileSync(a)))
          problems.push(`${pkg.dir}: drift in ${top}`);
      }
      const up = path.join(destDir, "UPSTREAM.package.json");
      if (!fs.existsSync(up)) problems.push(`${pkg.dir}: missing UPSTREAM.package.json`);
      else if (!fs.readFileSync(path.join(srcRoot, "package.json")).equals(fs.readFileSync(up)))
        problems.push(`${pkg.dir}: UPSTREAM.package.json != upstream package.json`);
      if (!fs.existsSync(path.join(destDir, "UPSTREAM.md")))
        problems.push(`${pkg.dir}: missing UPSTREAM.md`);
      if (!fs.existsSync(path.join(destDir, "package.json")))
        problems.push(`${pkg.dir}: missing wrapper package.json`);
      if (
        fs.existsSync(path.join(destDir, "patches")) &&
        fs.readdirSync(path.join(destDir, "patches")).length > 0
      )
        problems.push(`${pkg.dir}: patches present (expected zero-patch)`);
    }
    return { pkg, problems, tarballUrl, integrity, shasum, upstream };
  }

  // Sync: rebuild the directory deterministically.
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const top of VERBATIM_TOP) {
    const from = path.join(srcRoot, top);
    if (!fs.existsSync(from)) continue;
    if (fs.statSync(from).isDirectory()) copyTree(from, path.join(destDir, top));
    else fs.copyFileSync(from, path.join(destDir, top));
  }
  fs.copyFileSync(path.join(srcRoot, "package.json"), path.join(destDir, "UPSTREAM.package.json"));
  fs.writeFileSync(path.join(destDir, "package.json"), wrapperPackageJson(upstream));
  fs.writeFileSync(
    path.join(destDir, "UPSTREAM.md"),
    upstreamMd(pkg, { tarballUrl, integrity, shasum }, syncDate),
  );

  // Re-apply patches if any (zero by default).
  const patchesDir = path.join(destDir, "patches");
  if (fs.existsSync(patchesDir)) {
    for (const p of fs
      .readdirSync(patchesDir)
      .filter((f) => f.endsWith(".patch"))
      .sort()) {
      log(`applying patch ${pkg.dir}/patches/${p}`);
      run("git", ["apply", path.join(pkg.dir, "patches", p)]);
    }
  }
  return { pkg };
}

void (async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-effect-"));
  try {
    const results = [];
    for (const pkg of PIN) {
      results.push(await vendorOne(pkg, tmpDir));
    }
    if (VERIFY) {
      const problems = results.flatMap((r) => r.problems);
      if (problems.length > 0) {
        for (const p of problems) console.error(`  - ${p}`);
        die(`verify failed (${problems.length} problem(s))`);
      }
      log(
        `verify ok: ${PIN.map((p) => `${p.name}@${p.version}`).join(", ")} match the published tarballs`,
      );
      return;
    }
    log(`synced ${PIN.map((p) => `${p.name}@${p.version}`).join(", ")}`);
    console.log("\ngit status --short vendor/");
    process.stdout.write(run("git", ["status", "--short", "--", "vendor/"]));
    console.log("\ngit diff --stat");
    process.stdout.write(run("git", ["diff", "--stat", "--", "vendor/"]));
  } catch (err) {
    die(err && err.stack ? err.stack : String(err));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
