#!/usr/bin/env node
// Forbid ambient filesystem / process I/O inside compiler stages.
//
// ADR-0004: compiler stages are explicit, statically ordered, typed, immutable,
// and free of ambient I/O. The compiler's loader reads content at the boundary
// and hands the stage an in-memory map; a stage that imports `node:fs` or
// `node:child_process` has stepped outside that contract. This gate freezes the
// rule over the stage directory (ADR-0106 ratchet pattern).
//
// Usage: `node scripts/assert-no-stage-io.mjs [--self-test]`
//
// Wired into `pnpm preflight`.

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");

/** The compiler stage directory whose modules must never import ambient I/O. */
export const STAGE_ROOT = "packages/content-compiler/src/stages";

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;
/** Module specifiers that are ambient I/O. */
const IO_MODULES = ["node:fs", "node:child_process"];

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function isIoSelfModule(specifier) {
  return (
    typeof specifier === "string" &&
    IO_MODULES.some((module) => specifier === module || specifier.startsWith(`${module}/`))
  );
}

/**
 * Find ambient-IO imports in one stage source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, detail: string}>}
 */
export function findStageIo(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-no-stage-io: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a stage import)",
    );
  }
  const findings = [];
  const record = (node, detail) =>
    findings.push({ file: normalized, line: lineAt(text, node.start), detail });
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (
      (node.type === "ImportDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      node.source
    ) {
      if (isIoSelfModule(node.source.value)) record(node, `import of ${node.source.value}`);
    } else if (node.type === "ImportExpression" && isIoSelfModule(node.source?.value)) {
      record(node, `dynamic import of ${node.source.value}`);
    } else if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      node.callee.name === "require" &&
      isIoSelfModule(node.arguments?.[0]?.value)
    ) {
      record(node, `require of ${node.arguments[0].value}`);
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return findings;
}

/**
 * Scan every authored stage source file for ambient I/O imports.
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, detail: string}>}
 */
export function scanStageIo(repoRoot) {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter((file) => SOURCE_RE.test(file) && !TEST_RE.test(file))
        .filter((file) => file.startsWith(`${STAGE_ROOT}/`)),
    ),
  ].sort();

  const present = files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) {
      throw new Error(`assert-no-stage-io: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  if (present.length === 0) {
    throw new Error(`assert-no-stage-io: source discovery found no stage under ${STAGE_ROOT}`);
  }

  return present.flatMap((file) =>
    findStageIo(file, readFileSync(resolve(repoRoot, file), "utf8")),
  );
}

const FIXTURES = [
  { name: "node:fs import fails", source: 'import { readFileSync } from "node:fs";', expect: 1 },
  {
    name: "node:fs/promises import fails",
    source: 'import { readFile } from "node:fs/promises";',
    expect: 1,
  },
  {
    name: "node:child_process import fails",
    source: 'import { exec } from "node:child_process";',
    expect: 1,
  },
  { name: "dynamic import fails", source: 'const fs = await import("node:fs");', expect: 1 },
  { name: "require fails", source: 'const fs = require("node:fs");', expect: 1 },
  {
    name: "node:path import passes",
    source: 'import { resolve } from "node:path";',
    expect: 0,
  },
  {
    name: "a non-node fs import passes",
    source: 'import { readFileSync } from "./readFileSync.js";',
    expect: 0,
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const findings = findStageIo("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    console.log(
      `  ${passed ? "ok  " : "FAIL"} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}`,
    );
  }
  return { ok: failed === 0, failed, total: fixtures.length };
}

function main() {
  if (process.argv.includes("--self-test")) {
    console.log("assert-no-stage-io: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(`assert-no-stage-io: self-test FAILED (${String(failed)}/${String(total)})`);
      process.exit(1);
    }
    console.log(`assert-no-stage-io: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const findings = scanStageIo(root);
  if (findings.length > 0) {
    const detail = findings.map((f) => `  ${f.file}:${String(f.line)} — ${f.detail}`).join("\n");
    throw new Error(
      "assert-no-stage-io: a compiler stage imports ambient I/O. The loader reads content and " +
        "hands the stage an in-memory map; stages must stay I/O-free (ADR-0004).\n" +
        detail,
    );
  }
  console.log("assert-no-stage-io: ok (no ambient I/O under the stage directory)");
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
    console.error(`assert-no-stage-io: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
