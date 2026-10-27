#!/usr/bin/env node
// Workspace graph coherence gate (MONO-004). Three sources describe how a
// package depends on its siblings: package.json, tsconfig `references`, and the
// imports in its files. They drift silently, so this compares them:
//   1. a sibling imported anywhere in a package must be declared by it;
//   2. a declared sibling must be imported somewhere in the package;
//   3. a sibling imported from `src/` must be a `dependencies` entry, not dev-only;
//   4. a sibling imported from `src/` must have a tsconfig reference, so
//      `tsc -b` builds it first.
//
// Usage: `node scripts/verify-workspace-graph.mjs [--self-test]`

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const REFERENCE_EXEMPT = new Set(["apps/desktop"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  "dist-electron",
  "test-results",
  ".vite",
]);
const SOURCE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u;
const SPECIFIER =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\(\s*|\bimport\s+|\b(?:mock|doMock|importActual|importOriginal)\(\s*)["'](@bluewave\/[a-z0-9-]+)(?:\/[^"']*)?["']/gu;

export function importedSiblings(source) {
  const found = new Set();
  for (const match of source.matchAll(SPECIFIER)) found.add(match[1]);
  return found;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function workspaceDirs(root) {
  const dirs = [];
  for (const group of ["packages", "apps"]) {
    for (const entry of readdirSync(resolve(root, group), { withFileTypes: true })) {
      const dir = `${group}/${entry.name}`;
      if (!entry.isDirectory()) continue;
      try {
        statSync(resolve(root, dir, "package.json"));
        dirs.push(dir);
      } catch {
        continue;
      }
    }
  }
  return dirs;
}

function referencedDirs(root, dir) {
  const refs = new Set();
  for (const file of readdirSync(resolve(root, dir))) {
    if (!/^tsconfig.*\.json$/u.test(file)) continue;
    const text = readFileSync(resolve(root, dir, file), "utf8");
    for (const match of text.matchAll(/"path"\s*:\s*"([^"]+)"/gu)) {
      refs.add(
        relative(root, resolve(root, dir, match[1]))
          .split(sep)
          .join("/"),
      );
    }
  }
  return refs;
}

/**
 * @param {Array<{ dir: string, manifest: object, srcImports: Set<string>, otherImports: Set<string>, references: Set<string> }>} packages
 * @returns {string[]} problems (empty when coherent)
 */
export function analyze(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
  const problems = [];
  for (const { dir, manifest, srcImports, otherImports, references } of packages) {
    const prod = new Set(Object.keys(manifest.dependencies ?? {}));
    const dev = new Set(Object.keys(manifest.devDependencies ?? {}));
    const peer = new Set(Object.keys(manifest.peerDependencies ?? {}));
    const declared = new Set([...prod, ...dev, ...peer]);
    const imported = new Set([...srcImports, ...otherImports]);
    imported.delete(manifest.name);

    for (const name of [...imported].sort()) {
      if (!byName.has(name)) continue;
      if (!declared.has(name)) problems.push(`${dir}: imports ${name} but does not declare it`);
    }
    for (const name of [...declared].sort()) {
      if (!name.startsWith("@bluewave/") || !byName.has(name)) continue;
      if (!imported.has(name)) problems.push(`${dir}: declares ${name} but never imports it`);
    }
    for (const name of [...srcImports].sort()) {
      if (name === manifest.name || !byName.has(name)) continue;
      if (declared.has(name) && !prod.has(name) && !peer.has(name)) {
        problems.push(`${dir}: src imports ${name} but it is only a devDependency`);
      }
      const target = byName.get(name).dir;
      if (!REFERENCE_EXEMPT.has(dir) && !references.has(target)) {
        problems.push(`${dir}: src imports ${name} but no tsconfig references ${target}`);
      }
    }
  }
  return problems;
}

function collect(root) {
  return workspaceDirs(root).map((dir) => {
    const base = resolve(root, dir);
    const manifest = JSON.parse(readFileSync(resolve(base, "package.json"), "utf8"));
    const srcImports = new Set();
    const otherImports = new Set();
    for (const file of walk(base)) {
      const inSrc = relative(base, file).split(sep)[0] === "src";
      const target = inSrc && !/\.(?:test|spec)\./u.test(file) ? srcImports : otherImports;
      for (const name of importedSiblings(readFileSync(file, "utf8"))) target.add(name);
    }
    return { dir, manifest, srcImports, otherImports, references: referencedDirs(root, dir) };
  });
}

function selfTest() {
  const pkg = (dir, name, extra) => ({
    dir,
    manifest: { name, dependencies: {}, devDependencies: {}, ...extra.manifest },
    srcImports: new Set(extra.src ?? []),
    otherImports: new Set(extra.other ?? []),
    references: new Set(extra.refs ?? []),
  });
  const leaf = pkg("packages/leaf", "@bluewave/leaf", {});
  /** @type {Array<[string, ReturnType<typeof pkg>[], number]>} */
  const cases = [
    [
      "coherent",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", {
          manifest: { dependencies: { "@bluewave/leaf": "workspace:*" } },
          src: ["@bluewave/leaf"],
          refs: ["packages/leaf"],
        }),
      ],
      0,
    ],
    [
      "undeclared import",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", { src: ["@bluewave/leaf"], refs: ["packages/leaf"] }),
      ],
      1,
    ],
    [
      "unused declaration",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", {
          manifest: { dependencies: { "@bluewave/leaf": "workspace:*" } },
        }),
      ],
      1,
    ],
    [
      "dev-only in src",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", {
          manifest: { devDependencies: { "@bluewave/leaf": "workspace:*" } },
          src: ["@bluewave/leaf"],
          refs: ["packages/leaf"],
        }),
      ],
      1,
    ],
    [
      "missing reference",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", {
          manifest: { dependencies: { "@bluewave/leaf": "workspace:*" } },
          src: ["@bluewave/leaf"],
        }),
      ],
      1,
    ],
    [
      "test-only dev dependency",
      [
        leaf,
        pkg("packages/a", "@bluewave/a", {
          manifest: { devDependencies: { "@bluewave/leaf": "workspace:*" } },
          other: ["@bluewave/leaf"],
        }),
      ],
      0,
    ],
  ];
  let failed = false;
  for (const [label, packages, expected] of cases) {
    const got = analyze(packages).length;
    const ok = got === expected;
    failed ||= !ok;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} fixture "${label}": expected ${expected} finding(s), got ${got}`,
    );
  }
  const specs = [
    ...importedSiblings(
      'import x from "@bluewave/a/sub"; vi.mock("@bluewave/b"); await import("@bluewave/c")',
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const specsOk = specs.join() === "@bluewave/a,@bluewave/b,@bluewave/c";
  failed ||= !specsOk;
  console.log(
    `  ${specsOk ? "ok  " : "FAIL"} fixture "import, mock and dynamic import specifiers"`,
  );
  process.exit(failed ? 1 : 0);
}

function main() {
  if (process.argv.includes("--self-test")) selfTest();
  const packages = collect(ROOT);
  const problems = analyze(packages);
  if (problems.length > 0) {
    console.error("verify-workspace-graph: FAILED\n");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`verify-workspace-graph: ok (${packages.length} workspaces coherent).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
