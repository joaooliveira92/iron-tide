#!/usr/bin/env node
// Runtime-free import guard (MIG-RUNTIME-1, ADR-0100 §2, ADR-0159).
//
// ADR-0100 makes the Effect runtime-usage boundary a hard architectural rule:
// pure synchronous packages use only the runtime-free subset (`Schema`/`Data`/
// `Result`/`Option`/`Predicate`/`Equal`/`Hash`), and the full runtime
// (`Effect`/`Layer`/`Context`/`ManagedRuntime`/fibers/live services) is
// permitted only at explicit IO/entrypoint boundaries. ADR-0128 declined a
// runtime anywhere; ADR-0159 supersedes it for the app surfaces, adopting the
// full runtime in `apps/desktop/src/main` and `apps/compiler-cli` (both are no
// longer guarded here). The pure packages stay runtime-free, and the single
// runtime symbol in the repo remains `Effect.succeed([])` as a decode default in
// `packages/persistence`.
//
// This gate enforces that boundary for the runtime-free packages: an import of a
// runtime symbol (or of a runtime module subpath) fails closed. It is
// deliberately an allowlist — an unrecognised `effect` export is treated as a
// violation rather than silently admitted, so a future runtime symbol cannot
// slip through.
//
// Usage:
//   node scripts/assert-runtime-free.mjs              # check the real tree
//   node scripts/assert-runtime-free.mjs --self-test  # run embedded fixtures
//
// The check is a pure `findRuntimeImports(file, text) -> findings[]`; it reads
// no clock, RNG, environment, or network, so its verdict is deterministic.

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

// Directories that must stay runtime-free (ADR-0100 §2 runtime-free row, plus
// the renderer-reachable `campaign-engine`). `persistence`/`content-compiler`
// are IO boundaries and are deliberately NOT listed; `apps/desktop/src/main`
// and `apps/compiler-cli` adopt the full runtime (ADR-0159) and are NOT listed.
export const RUNTIME_FREE_ROOTS = [
  "packages/ai/src",
  "packages/armament/src",
  "packages/campaign/src",
  "packages/campaign-engine/src",
  "packages/combat/src",
  "packages/commands/src",
  "packages/content-schema/src",
  "packages/contracts/src",
  "packages/deterministic/src",
  "packages/diagnostics/src",
  "packages/events/src",
  "packages/messages/src",
  "packages/phase-engine/src",
  "packages/random/src",
  "packages/ship-design/src",
  "packages/ship-visual/src",
];

// The test directories of the runtime-free packages are guarded too: a test that imports
// the runtime proves nothing about the pure package it covers. `phase-engine` is the one
// reviewed exemption (RUNTIME_FREE_TEST_EXEMPTIONS): its tests still import runtime
// symbols and must be migrated before it can join.
export const RUNTIME_FREE_TEST_EXEMPTIONS = ["packages/phase-engine"];

export const RUNTIME_FREE_TEST_ROOTS = RUNTIME_FREE_ROOTS.map((root) =>
  root.replace(/\/src$/u, "/test"),
).filter((root) => !RUNTIME_FREE_TEST_EXEMPTIONS.some((exempt) => root.startsWith(`${exempt}/`)));

const GUARDED_ROOTS = [...RUNTIME_FREE_ROOTS, ...RUNTIME_FREE_TEST_ROOTS];

// The runtime-free subset ADR-0100 §2 permits. Anything else imported from
// `effect` (or a matching `effect/<Name>` subpath) is a runtime symbol.
export const RUNTIME_FREE_SYMBOLS = new Set([
  "Data",
  "Equal",
  "Hash",
  "Option",
  "Predicate",
  "Result",
  "Schema",
  "SchemaIssue",
]);

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;

/** Module specifiers that are never permitted in a runtime-free root. */
function runtimeModuleFinding(specifier) {
  if (specifier === "effect") return null; // handled per-symbol
  if (specifier.startsWith("effect/")) {
    const subpath = specifier.slice("effect/".length);
    // Allow the runtime-free data modules (`effect/Schema`, `effect/Data`, …).
    return RUNTIME_FREE_SYMBOLS.has(subpath) ? null : `runtime module import: ${specifier}`;
  }
  if (specifier.startsWith("@effect/")) {
    return `@effect/* package import is not permitted in a runtime-free root: ${specifier}`;
  }
  return null;
}

function moduleName(node) {
  return node.source?.value;
}

/**
 * Collect runtime imports from one parsed source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, detail: string}>}
 */
export function findRuntimeImports(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-runtime-free: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a runtime import)",
    );
  }

  const lineAt = (offset) => {
    let count = 1;
    for (let i = 0; i < offset && i < text.length; i += 1) {
      if (text.charCodeAt(i) === 10) count += 1;
    }
    return count;
  };
  const findings = [];
  const add = (offset, detail) => findings.push({ file: normalized, line: lineAt(offset), detail });

  const checkDeclaration = (node, kind) => {
    const specifier = moduleName(node);
    if (typeof specifier !== "string") return;
    const moduleFinding = runtimeModuleFinding(specifier);
    if (moduleFinding !== null) {
      add(node.source.start, `${moduleFinding} (${kind})`);
      return;
    }
    if (specifier !== "effect") return; // allowed runtime-free subpath
    for (const spec of node.specifiers ?? []) {
      if (spec.type === "ImportNamespaceSpecifier") {
        add(spec.start, `namespace import of the effect runtime (${kind})`);
        continue;
      }
      if (spec.type === "ImportDefaultSpecifier") {
        add(spec.start, `default import of the effect runtime (${kind})`);
        continue;
      }
      const imported = spec.imported?.name ?? spec.local?.name;
      if (typeof imported === "string" && !RUNTIME_FREE_SYMBOLS.has(imported)) {
        add(spec.start, `runtime symbol "${imported}" imported from effect (${kind})`);
      }
    }
  };

  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (node.type === "ImportDeclaration") checkDeclaration(node, "import");
    else if (
      (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") &&
      node.source
    ) {
      checkDeclaration(node, "re-export");
    } else if (node.type === "ImportExpression" && node.source) {
      const specifier = node.source?.value;
      if (typeof specifier === "string") {
        const moduleFinding = runtimeModuleFinding(specifier);
        if (moduleFinding !== null) add(node.source.start, `${moduleFinding} (dynamic import)`);
        else if (specifier === "effect")
          add(node.source.start, "dynamic import of the effect runtime");
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return findings.sort((a, b) => a.line - b.line || (a.detail < b.detail ? -1 : 1));
}

function isGuarded(file) {
  return SOURCE_RE.test(file) && GUARDED_ROOTS.some((prefix) => file.startsWith(`${prefix}/`));
}

/**
 * Scan every authored source file under the runtime-free roots.
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, detail: string}>}
 */
export function scanRuntimeImports(repoRoot) {
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
  ].sort();

  const present = files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) {
      throw new Error(`assert-runtime-free: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  // Fail closed if discovery silently omitted a guarded root.
  for (const root of GUARDED_ROOTS) {
    if (!present.some((file) => file.startsWith(`${root}/`))) {
      throw new Error(`assert-runtime-free: source discovery omitted guarded root ${root}`);
    }
  }

  return present.flatMap((file) =>
    findRuntimeImports(file, readFileSync(resolve(repoRoot, file), "utf8")),
  );
}

// Each fixture asserts the exact number of findings the checker must report.
const FIXTURES = [
  {
    name: "runtime-free named imports are ok",
    source: 'import { Data, Schema } from "effect";\nimport { Result } from "effect";',
    expect: 0,
  },
  {
    name: "aliased runtime-free import is ok",
    source: 'import { Schema as S } from "effect";',
    expect: 0,
  },
  {
    name: "type-only runtime-free import is ok",
    source: 'import type { Schema } from "effect";',
    expect: 0,
  },
  {
    name: "Effect import fails",
    source: 'import { Effect, Schema } from "effect";',
    expect: 1,
  },
  {
    name: "Layer import fails",
    source: 'import { Layer } from "effect";',
    expect: 1,
  },
  {
    name: "Context import fails",
    source: 'import { Context } from "effect";',
    expect: 1,
  },
  {
    name: "ManagedRuntime import fails",
    source: 'import { ManagedRuntime } from "effect";',
    expect: 1,
  },
  {
    name: "namespace import of effect fails",
    source: 'import * as E from "effect";',
    expect: 1,
  },
  {
    name: "runtime module subpath fails",
    source: 'import { runPromise } from "effect/Effect";',
    expect: 1,
  },
  {
    name: "runtime-free subpath is ok",
    source: 'import { Schema } from "effect/Schema";',
    expect: 0,
  },
  {
    name: "@effect package import fails",
    source: 'import { describe } from "@effect/vitest";',
    expect: 1,
  },
  {
    name: "re-export of a runtime symbol fails",
    source: 'export { Effect } from "effect";',
    expect: 1,
  },
  {
    name: "dynamic import of effect fails",
    source: 'const m = await import("effect");',
    expect: 1,
  },
  {
    name: "unrelated package import is ignored",
    source: 'import { SafeInt } from "@bluewave/contracts";',
    expect: 0,
  },
  {
    name: "multi-line import is detected",
    source: 'import {\n  Schema,\n  Effect,\n} from "effect";',
    expect: 1,
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const findings = findRuntimeImports("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    const detail = findings.length > 0 ? ` — ${findings.map((f) => f.detail).join("; ")}` : "";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}${detail}`,
    );
  }
  return { ok: failed === 0, failed, total: fixtures.length };
}

function main() {
  if (process.argv.includes("--self-test")) {
    console.log("assert-runtime-free: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(`assert-runtime-free: self-test FAILED (${String(failed)}/${String(total)})`);
      process.exit(1);
    }
    console.log(`assert-runtime-free: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const findings = scanRuntimeImports(ROOT);
  if (findings.length > 0) {
    console.error(
      "assert-runtime-free: FAILED — the runtime-free roots import the Effect runtime:",
    );
    for (const finding of findings) {
      console.error(`  - ${finding.file}:${String(finding.line)} — ${finding.detail}`);
    }
    console.error(
      "Fix: the runtime-free packages may import only the runtime-free subset " +
        `(${[...RUNTIME_FREE_SYMBOLS].sort().join(", ")}). ` +
        "Move IO/async orchestration behind an explicit entrypoint boundary (ADR-0100 §2, ADR-0159).",
    );
    process.exit(1);
  }

  console.log(
    `assert-runtime-free: ok (${String(GUARDED_ROOTS.length)} roots, no runtime imports)`,
  );
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
    console.error(`assert-runtime-free: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
