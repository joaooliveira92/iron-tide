#!/usr/bin/env node
// Zero-tolerance ban on React effect hooks (`useEffect`, `useLayoutEffect`,
// `useInsertionEffect`) in authored source outside tests and EXTERNAL_SYNC_MODULE.
// Named, aliased, namespace (`React.useEffect`), default-import member and
// re-export forms are all counted.
//
// Usage: `node scripts/assert-no-effect-hooks.mjs [--self-test]`
//
// Wired into `pnpm preflight` as gate:effect-hooks.

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");

export const BANNED_HOOKS = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect"]);

const AREAS = ["packages/", "apps/"];
const EXCLUDED = ["vendor/", "repos/", "prototype/"];
const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const EXTERNAL_SYNC_MODULE = "apps/desktop/src/renderer/shell/useExternalSync.ts";

export function isGuarded(file) {
  return (
    file !== EXTERNAL_SYNC_MODULE &&
    SOURCE_RE.test(file) &&
    !TEST_RE.test(file) &&
    AREAS.some((prefix) => file.startsWith(prefix)) &&
    !EXCLUDED.some((prefix) => file.startsWith(prefix))
  );
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function nameOf(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  return undefined;
}

/**
 * Find banned effect-hook bindings and references in one source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, hook: string}>}
 */
export function findEffectHooks(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-no-effect-hooks: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide an effect hook)",
    );
  }

  const hookLocals = new Map();
  const namespaceLocals = new Set();
  const findings = [];
  const add = (node, hook) =>
    findings.push({ file: normalized, line: lineAt(text, node.start), hook });

  for (const node of program.body) {
    if (node.type === "ImportDeclaration" && node.source.value === "react") {
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          const hook = nameOf(specifier.imported);
          if (hook !== undefined && BANNED_HOOKS.has(hook)) {
            hookLocals.set(specifier.local.name, hook);
            add(specifier, hook);
          }
        } else {
          namespaceLocals.add(specifier.local.name);
        }
      }
    }
    if (node.type === "ExportAllDeclaration" && node.source.value === "react") {
      add(node, "*");
    }
    if (node.type === "ExportNamedDeclaration" && node.source?.value === "react") {
      for (const specifier of node.specifiers) {
        const hook = nameOf(specifier.local);
        if (hook !== undefined && BANNED_HOOKS.has(hook)) add(specifier, hook);
      }
    }
  }

  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration") return;
    if (node.type === "ExportNamedDeclaration" && node.source) return;
    if (node.type === "Identifier") {
      const hook = hookLocals.get(node.name);
      if (hook !== undefined) add(node, hook);
      return;
    }
    if (node.type === "MemberExpression") {
      const property = node.computed === true ? nameOf(node.property) : node.property?.name;
      if (
        node.object?.type === "Identifier" &&
        namespaceLocals.has(node.object.name) &&
        property !== undefined &&
        BANNED_HOOKS.has(property)
      ) {
        add(node, property);
        return;
      }
      visit(node.object);
      if (node.computed === true) visit(node.property);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      if (key === "key" && node.computed !== true) continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") visit(node);
  }
  return findings;
}

function discoverFiles(repoRoot) {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter(isGuarded),
    ),
  ].sort(byCodeUnit);

  for (const area of AREAS) {
    if (!files.some((file) => file.startsWith(area))) {
      throw new Error(`assert-no-effect-hooks: source discovery omitted ${area}`);
    }
  }
  return files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) {
      throw new Error(`assert-no-effect-hooks: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });
}

/**
 * Count banned hook uses per guarded file.
 * @param {string} repoRoot
 * @returns {Record<string, number>}
 */
export function measureEffectHooks(repoRoot) {
  const counts = {};
  for (const file of discoverFiles(repoRoot)) {
    const found = findEffectHooks(file, readFileSync(resolve(repoRoot, file), "utf8"));
    if (found.length > 0) counts[file] = found.length;
  }
  return counts;
}

/**
 * List every guarded file that uses a banned hook.
 * @param {Record<string, number>} measured
 * @returns {string[]}
 */
export function evaluateEffectHooks(measured) {
  return Object.keys(measured)
    .sort(byCodeUnit)
    .map((file) => `${file}: ${String(measured[file])} effect hook use(s)`);
}

const FIXTURES = [
  {
    name: "named import and call",
    file: "a.tsx",
    source: 'import { useEffect } from "react"; useEffect(() => {}, []);',
    expect: 2,
  },
  {
    name: "aliased import",
    file: "a.tsx",
    source: 'import { useEffect as e } from "react"; e(() => {});',
    expect: 2,
  },
  {
    name: "namespace member call",
    file: "a.tsx",
    source: 'import * as R from "react"; R.useEffect(() => {});',
    expect: 1,
  },
  {
    name: "default import member call",
    file: "a.tsx",
    source: 'import React from "react"; React.useLayoutEffect(() => {});',
    expect: 1,
  },
  {
    name: "bracket member call",
    file: "a.tsx",
    source: 'import * as R from "react"; R["useInsertionEffect"](() => {});',
    expect: 1,
  },
  { name: "re-export", file: "a.ts", source: 'export { useEffect } from "react";', expect: 1 },
  { name: "export star", file: "a.ts", source: 'export * from "react";', expect: 1 },
  {
    name: "unrelated react hooks pass",
    file: "a.tsx",
    source: 'import { useState, useMemo } from "react"; useState(0);',
    expect: 0,
  },
  {
    name: "same name from another module passes",
    file: "a.ts",
    source: 'import { useEffect } from "other"; useEffect();',
    expect: 0,
  },
  {
    name: "foreign member named useEffect passes",
    file: "a.ts",
    source: "const o = {}; o.useEffect();",
    expect: 0,
  },
  {
    name: "object key named useEffect passes",
    file: "a.ts",
    source: "const o = { useEffect: 1 };",
    expect: 0,
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const found = findEffectHooks(fixture.file, fixture.source).length;
    const passed = found === fixture.expect;
    if (!passed) failed += 1;
    console.log(
      `  ${passed ? "ok  " : "FAIL"} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(found)}`,
    );
  }
  return { ok: failed === 0, failed, total: fixtures.length };
}

function main() {
  if (process.argv.includes("--self-test")) {
    console.log("assert-no-effect-hooks: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(
        `assert-no-effect-hooks: self-test FAILED (${String(failed)}/${String(total)})`,
      );
      process.exit(1);
    }
    console.log(`assert-no-effect-hooks: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const violations = evaluateEffectHooks(measureEffectHooks(root));
  if (violations.length > 0) {
    throw new Error(
      "React effect hooks are banned (issue #930); use render-time derivation, event handlers, " +
        "useSyncExternalStore, key resets or ref callbacks instead.\n  " +
        violations.join("\n  "),
    );
  }
  console.log("assert-no-effect-hooks: ok (no effect hooks outside the external-sync module)");
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.filename === resolve(process.argv[1]);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  try {
    main();
  } catch (error) {
    console.error(
      `assert-no-effect-hooks: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
