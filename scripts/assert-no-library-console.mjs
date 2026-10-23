#!/usr/bin/env node
// Forbid `console.*` in library modules (RULES.md "Services, layers, composition":
// log with `Effect.log*`, never `console.*`). The runtime-free packages and the
// Electron app have no Effect runtime to log through, so a small, reviewed
// allowlist names the genuine boundary sites where `console.*` is the logger;
// everything else in a library module must not use it. The gate fails closed on
// any new console call (ADR-0106 ratchet pattern).
//
// Usage: `node scripts/assert-no-library-console.mjs [--self-test]`
//
// Wired into `pnpm preflight`.

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const CONSOLE_METHODS = new Set(["log", "error", "warn", "info", "debug", "trace"]);

/**
 * Reviewed exceptions. Each `path` is a file or directory prefix (a trailing `/`
 * means "everything under this directory"); each carries the reason it is
 * allowed to use `console.*`.
 * @type {ReadonlyArray<{path: string, reason: string}>}
 */
export const ALLOWLIST = [
  {
    path: "packages/combat/harness/run-weather-child.ts",
    reason:
      "combat weather child-process entry point; the runtime-free package has no Effect runtime to log through",
  },
  {
    path: "apps/desktop/src/main/",
    reason:
      "runtime-free Electron main process; console is the process-boundary logger (no Effect runtime)",
  },
  {
    path: "apps/desktop/src/renderer/",
    reason:
      "renderer app; console is the UI crash/shader/diagnostic boundary (no Effect runtime in the bundle)",
  },
];

/** Library modules and app entry points the rule covers. */
function isGuarded(file) {
  if (!SOURCE_RE.test(file) || TEST_RE.test(file)) return false;
  return (
    /^packages\/[^/]+\/src\//u.test(file) ||
    file.startsWith("apps/desktop/src/main/") ||
    file.startsWith("apps/desktop/src/renderer/")
  );
}

function allowReason(file) {
  return ALLOWLIST.find((entry) =>
    entry.path.endsWith("/") ? file.startsWith(entry.path) : file === entry.path,
  );
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function memberName(member) {
  if (member.computed === true) {
    return typeof member.property?.value === "string" ? member.property.value : undefined;
  }
  return member.property?.name;
}

function isConsoleCall(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === "console" &&
    CONSOLE_METHODS.has(memberName(node.callee) ?? "")
  );
}

/**
 * Find `console.*` calls in one source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, method: string}>}
 */
export function findLibraryConsole(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-no-library-console: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a console call)",
    );
  }
  const findings = [];
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (isConsoleCall(node)) {
      findings.push({
        file: normalized,
        line: lineAt(text, node.start),
        method: memberName(node.callee) ?? "?",
      });
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
 * Scan the guarded library/app source for console calls not on the allowlist.
 * The allowlist is the module-level {@link ALLOWLIST}; the parameter is retained
 * for call-shape symmetry with the other scoped gates.
 * @param {string} repoRoot
 * @param {ReadonlyArray<{path: string, reason: string}>} [_allowlist]
 * @returns {Array<{file: string, line: number, method: string}>}
 */
export function scanLibraryConsole(repoRoot, _allowlist = ALLOWLIST) {
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

  if (!files.some((file) => file.startsWith("packages/"))) {
    throw new Error(
      "assert-no-library-console: source discovery omitted the package library modules",
    );
  }

  const present = files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) {
      throw new Error(`assert-no-library-console: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  return present
    .flatMap((file) => findLibraryConsole(file, readFileSync(resolve(repoRoot, file), "utf8")))
    .filter((finding) => allowReason(finding.file) === undefined);
}

const FIXTURES = [
  { name: "console.error fails", source: "console.error(x);", expect: 1 },
  { name: "console.log fails", source: "console.log(x);", expect: 1 },
  { name: "bracket console.warn fails", source: 'console["warn"](x);', expect: 1 },
  {
    name: "two calls count independently",
    source: "console.log(a); console.error(b);",
    expect: 2,
  },
  { name: "another object's log passes", source: "logger.error(x);", expect: 0 },
  {
    name: "a console member that is not a log method passes",
    source: "console.dir(x);",
    expect: 0,
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const findings = findLibraryConsole("fixture.ts", fixture.source);
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
    console.log("assert-no-library-console: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(
        `assert-no-library-console: self-test FAILED (${String(failed)}/${String(total)})`,
      );
      process.exit(1);
    }
    console.log(`assert-no-library-console: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const findings = scanLibraryConsole(root);
  if (findings.length > 0) {
    const detail = findings
      .map((f) => `  ${f.file}:${String(f.line)} — console.${f.method}`)
      .join("\n");
    throw new Error(
      "assert-no-library-console: console.* is forbidden in library modules " +
        '(RULES.md "Services, layers, composition"). Log with Effect.log* or add a justified allowlist entry.\n' +
        detail,
    );
  }
  console.log("assert-no-library-console: ok (no unallowlisted console calls in library modules)");
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
      `assert-no-library-console: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
