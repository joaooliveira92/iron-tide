#!/usr/bin/env node
// Reject untagged plain `Error` subclasses in the in-process error roots.
//
// RULES.md "Errors" requires every typed in-process failure to carry a stable
// `_tag` so callers recover by discriminator rather than `instanceof`. The
// renderer-reachable packages cannot use `Data.TaggedError` (that would risk
// bundling the `effect` runtime into the renderer; MIG-EXCL-1, ADR-0128 §1), so
// their classes stay plain TypeScript and instead declare a `readonly _tag`
// field. This gate freezes the rule per reachability scope: a new
// `class … extends Error` with no `_tag` fails closed (ADR-0106 ratchet
// pattern).
//
//   --scope engine   roots whose error classes the renderer cannot reach
//   --scope surface  the renderer-reachable roots (the renderer itself plus the
//                    packages whose public error surface it can reach)
//
// A class is compliant when it carries a `_tag` (field or accessor) OR its name
// is on the reviewed allowlist below with a one-line justification. The
// allowlist is deliberately inline so the exception is visible in review.
//
// `extends Error` detection covers the bare `Error` identifier, the
// `globalThis.Error`/`global.Error` member forms, and a local import alias of
// `Error` (`import { Error as E } from "…"`; G4). It deliberately does not chase
// a locally-declared non-import alias (`const E = Error`), which no authored
// class uses; `Data.TaggedError`/`Schema.TaggedError` subclasses are invisible
// because they carry a `_tag` by construction.
//
// A second rule rejects `throw new Error(...)` (and the other built-in error
// constructors): a thrown plain error carries no `_tag`, so the catching edge can only
// branch on its message. Existing sites are frozen in a shrink-only baseline keyed by
// file and content fingerprint; a new throw fails closed.
//
// A third rule guards the typed-failure roots (`TYPED_FAILURE_ROOTS`: `campaign`, the
// runtime-free authoritative package, and `persistence`, the IO boundary that returns
// failures as `Result` and `Effect`): any `throw` of something other than a caught
// identifier, and any `try/catch`, lets a failure leave the typed channel.
// Existing sites are frozen in `typed-failure-leaks.baseline.json` (shrink-only, same
// fingerprint scheme as the throw baseline).
//
// Usage: `node scripts/assert-tagged-errors.mjs [--scope engine|surface|all] [--self-test] [--write]`
//   (`--write` reseeds the untagged-throw baseline from the current tree)
//
// Wired into `pnpm preflight` (one self-test, then one gate per scope).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");

/**
 * The reachability scopes the gate guards, keyed by `--scope` name.
 *
 * "Renderer-reachable" means the renderer **value-imports** the root (directly,
 * or transitively through another renderer-reachable root); a type-only import
 * (`import type`, or an all-type `export … from`) is erased by the bundler and
 * does not count — so `persistence` (only `import type { SaveMetadata }`),
 * `phase-engine` (only `import type { ForeignConstructionPreview }`) and
 * `diagnostics` (only `import type { DiagnosticCollector }` on the renderer's
 * value path) sit in `engine`. The renderer also value-reaches `armament`,
 * `deterministic`, `random` and `content-schema` (ADR-0128 §Context), but none
 * of those declares a renderer-facing plain `Error` subclass, so `surface`
 * lists the value-imported roots that do: `contracts`, `ship-design`,
 * `campaign`, `campaign-engine` and `ship-visual`.
 *
 * Both scopes enforce the same rule; the lists exist so the split is a reviewed
 * decision, and together they cover every first-party source root, so an
 * untagged error cannot hide in an unguarded package or app (ADR-0152 §4,
 * ticket 12).
 */
export const SCOPES = {
  engine: [
    "apps/compiler-cli/src",
    "apps/desktop/src/main",
    "apps/desktop/src/preload",
    "apps/desktop/src/shared",
    "packages/ai/src",
    "packages/armament/src",
    "packages/combat/src",
    "packages/commands/src",
    "packages/content-compiler/src",
    "packages/content-schema/src",
    "packages/cross-process-test/src",
    "packages/deterministic/src",
    "packages/diagnostics/src",
    "packages/events/src",
    "packages/persistence/src",
    "packages/phase-engine/src",
    "packages/random/src",
    "packages/test-support/src",
  ],
  surface: [
    "apps/desktop/src/renderer",
    "packages/campaign/src",
    "packages/campaign-engine/src",
    "packages/contracts/src",
    "packages/ship-design/src",
    "packages/ship-visual/src",
  ],
};

/**
 * Reviewed exceptions, keyed `"<repo-relative file>#<ClassName>"` with a reason.
 * Empty at adoption: every listed class carries a `_tag`. Entries here only
 * ever shrink.
 * @type {Readonly<Record<string, string>>}
 */
export const ALLOWLIST = {};

const THROW_BASELINE_PATH = "scripts/untagged-throws.baseline.json";
const LEAK_BASELINE_PATH = "scripts/typed-failure-leaks.baseline.json";

export const TYPED_FAILURE_ROOTS = ["packages/campaign/src", "packages/persistence/src"];

/**
 * The typed-failure roots that belong to the scopes being checked, so each scope run
 * guards its own roots and `--scope all` guards both.
 * @param {readonly string[]} scopes
 * @returns {string[]}
 */
export function typedFailureRootsFor(scopes) {
  const covered = new Set(scopes.flatMap((scope) => SCOPES[scope]));
  return TYPED_FAILURE_ROOTS.filter((leakRoot) => covered.has(leakRoot));
}

const BUILTIN_ERROR_CONSTRUCTORS = new Set([
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
]);

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/** The class name from an identifier key, or `undefined`. */
function keyName(key) {
  if (key?.type === "Identifier") return key.name;
  if (key?.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

/** True when the class body declares a `_tag` field or accessor. */
function classHasTag(node) {
  const body = node.body?.body ?? [];
  return body.some((member) => {
    if (
      member?.type !== "PropertyDefinition" &&
      member?.type !== "TSAbstractPropertyDefinition" &&
      member?.type !== "MethodDefinition"
    ) {
      return false;
    }
    return keyName(member.key) === "_tag";
  });
}

/**
 * Collect the local names that alias the global `Error` via an import, e.g.
 * `import { Error as E } from "…"` binds `E`. A class extending such a name is
 * a plain `Error` subclass the gate must guard; without this it would be
 * invisible (G4, ADR-0152).
 * @param {any} program
 * @returns {Set<string>}
 */
function importedErrorAliases(program) {
  const aliases = new Set();
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers ?? []) {
        if (specifier?.type !== "ImportSpecifier") continue;
        if (keyName(specifier.imported) === "Error" && specifier.local?.name) {
          aliases.add(specifier.local.name);
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return aliases;
}

/**
 * True when a class superclass names the global `Error`: the bare `Error`
 * identifier, `globalThis.Error`/`global.Error`, or a local import alias of
 * `Error` (G4).
 * @param {any} node the class declaration/expression
 * @param {ReadonlySet<string>} errorAliases
 */
function extendsError(node, errorAliases) {
  const superClass = node.superClass;
  if (superClass?.type === "Identifier") {
    return superClass.name === "Error" || errorAliases.has(superClass.name);
  }
  if (superClass?.type === "MemberExpression" && !superClass.computed) {
    return (
      superClass.object?.type === "Identifier" &&
      (superClass.object.name === "globalThis" || superClass.object.name === "global") &&
      keyName(superClass.property) === "Error"
    );
  }
  return false;
}

/**
 * Find plain `extends Error` classes without a `_tag` in one source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, name: string}>}
 */
export function findUntaggedErrors(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-tagged-errors: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide an untagged error)",
    );
  }
  const findings = [];
  const errorAliases = importedErrorAliases(program);
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (
      (node.type === "ClassDeclaration" || node.type === "ClassExpression") &&
      extendsError(node, errorAliases) &&
      !classHasTag(node)
    ) {
      findings.push({
        file: normalized,
        line: lineAt(text, node.start),
        name: node.id?.name ?? "<anonymous>",
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
 * Scan the authored (non-test) source under the given roots for untagged errors.
 * @param {string} repoRoot
 * @param {readonly string[]} roots package source prefixes
 * @param {Readonly<Record<string, string>>} allowlist
 * @returns {Array<{file: string, line: number, name: string}>}
 */
export function scanTaggedErrors(repoRoot, roots, allowlist = ALLOWLIST) {
  const isGuarded = (file) =>
    SOURCE_RE.test(file) &&
    !TEST_RE.test(file) &&
    roots.some((prefix) => file.startsWith(`${prefix}/`));
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
      throw new Error(`assert-tagged-errors: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  for (const guarded of roots) {
    if (!present.some((file) => file.startsWith(`${guarded}/`))) {
      throw new Error(`assert-tagged-errors: source discovery omitted ${guarded}`);
    }
  }

  return present
    .flatMap((file) => findUntaggedErrors(file, readFileSync(resolve(repoRoot, file), "utf8")))
    .filter((finding) => !Object.hasOwn(allowlist, `${finding.file}#${finding.name}`));
}

function normalizeSource(text) {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Find `throw new Error(...)` (and sibling built-ins) in one source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, name: string, fingerprint: string}>}
 */
export function findUntaggedThrows(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-tagged-errors: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide an untagged throw)",
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
    if (node.type === "ThrowStatement") {
      const argument = node.argument;
      const callee =
        argument?.type === "NewExpression" || argument?.type === "CallExpression"
          ? argument.callee
          : undefined;
      if (callee?.type === "Identifier" && BUILTIN_ERROR_CONSTRUCTORS.has(callee.name)) {
        findings.push({
          file: normalized,
          line: lineAt(text, node.start),
          name: callee.name,
          fingerprint: createHash("sha256")
            .update(normalizeSource(text.slice(node.start, node.end)))
            .digest("hex"),
        });
      }
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
 * Find typed-failure leaks in one source file: a `throw` of anything but a bare identifier
 * (a rethrow of a caught value) and every `try` statement with a `catch` handler.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, name: string, fingerprint: string}>}
 */
export function findTypedFailureLeaks(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-tagged-errors: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a typed-failure leak)",
    );
  }
  const findings = [];
  const record = (node, name, source) =>
    findings.push({
      file: normalized,
      line: lineAt(text, node.start),
      name,
      fingerprint: createHash("sha256").update(normalizeSource(source)).digest("hex"),
    });
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (node.type === "ThrowStatement" && node.argument?.type !== "Identifier") {
      record(node, "throw", text.slice(node.start, node.end));
    }
    if (node.type === "TryStatement" && node.handler !== null && node.handler !== undefined) {
      record(node, "try/catch", text.slice(node.handler.start, node.handler.end));
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

/** Scan the typed-failure roots for failures that leave the typed channel. */
export function scanTypedFailureLeaks(repoRoot, roots = TYPED_FAILURE_ROOTS) {
  return listGuardedFiles(repoRoot, roots).flatMap((file) =>
    findTypedFailureLeaks(file, readFileSync(resolve(repoRoot, file), "utf8")),
  );
}

function listGuardedFiles(repoRoot, roots) {
  const isGuarded = (file) =>
    SOURCE_RE.test(file) &&
    !TEST_RE.test(file) &&
    roots.some((prefix) => file.startsWith(`${prefix}/`));
  return [
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
  ]
    .sort()
    .filter((file) => lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false })?.isFile());
}

/** Scan the given roots for `throw new Error(...)` sites. */
export function scanUntaggedThrows(repoRoot, roots) {
  return listGuardedFiles(repoRoot, roots).flatMap((file) =>
    findUntaggedThrows(file, readFileSync(resolve(repoRoot, file), "utf8")),
  );
}

/** Count throw sites per file and fingerprint in stable code-unit order. */
export function countThrows(findings) {
  const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const counts = {};
  for (const { file, fingerprint } of findings) {
    const perFile = (counts[file] ??= {});
    perFile[fingerprint] = (perFile[fingerprint] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort(([a], [b]) => byCodeUnit(a, b))
      .map(([file, perFile]) => [
        file,
        Object.fromEntries(Object.entries(perFile).sort(([a], [b]) => byCodeUnit(a, b))),
      ]),
  );
}

function readThrowBaseline(repoRoot, path = THROW_BASELINE_PATH) {
  try {
    const value = JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("baseline must be a file-to-counts object");
    }
    return value;
  } catch (error) {
    throw new Error(
      `assert-tagged-errors: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Subtract the baseline from the observed throw sites.
 * @param {Array<{file: string, fingerprint: string}>} findings
 * @param {Readonly<Record<string, Readonly<Record<string, number>>>>} baseline
 */
export function unbaselinedThrows(findings, baseline) {
  const remaining = structuredClone(baseline);
  const added = [];
  for (const finding of findings) {
    const perFile = remaining[finding.file];
    const allowance = perFile?.[finding.fingerprint] ?? 0;
    if (perFile !== undefined && allowance > 0) perFile[finding.fingerprint] = allowance - 1;
    else added.push(finding);
  }
  return added;
}

const THROW_FIXTURES = [
  { name: "throw new Error fails", source: 'function f() { throw new Error("x"); }', expect: 1 },
  {
    name: "throw new TypeError fails",
    source: 'function f() { throw new TypeError("x"); }',
    expect: 1,
  },
  { name: "throw Error(...) call fails", source: 'function f() { throw Error("x"); }', expect: 1 },
  {
    name: "throwing a tagged error passes",
    source: "function f() { throw new BluewaveError(CODE, { code: CODE }); }",
    expect: 0,
  },
  {
    name: "rethrowing a caught value passes",
    source: "try { f(); } catch (e) { throw e; }",
    expect: 0,
  },
  {
    name: "constructing without throwing passes",
    source: 'const e = new Error("x"); export default e;',
    expect: 0,
  },
  {
    name: "two throws are counted independently",
    source: 'if (a) throw new Error("a"); if (b) throw new RangeError("b");',
    expect: 2,
  },
];

const LEAK_FIXTURES = [
  {
    name: "throwing a constructed error fails",
    source: "function f() { throw new E(); }",
    expect: 1,
  },
  {
    name: "throwing a stored failure fails",
    source: "function f(r) { throw r.failure; }",
    expect: 1,
  },
  { name: "try/catch fails", source: "try { f(); } catch (e) { g(e); }", expect: 1 },
  { name: "rethrowing a caught identifier passes", source: "throw e;", expect: 0 },
  { name: "try/finally without catch passes", source: "try { f(); } finally { g(); }", expect: 0 },
  {
    name: "returning a Result passes",
    source: "function f() { return Result.fail(new E()); }",
    expect: 0,
  },
];

const FIXTURES = [
  { name: "untagged extends Error fails", source: "class E extends Error {}", expect: 1 },
  {
    name: "tagged class field passes",
    source: 'class E extends Error { readonly _tag = "E"; }',
    expect: 0,
  },
  {
    name: "tagged accessor field passes",
    source: 'class E extends Error { get _tag() { return "E"; } }',
    expect: 0,
  },
  {
    name: "Data.TaggedError subclass passes",
    source: 'class E extends Data.TaggedError("E")<{}> {}',
    expect: 0,
  },
  {
    name: "unnamed class expression fails",
    source: "const E = class extends Error {};",
    expect: 1,
  },
  {
    name: "extends a non-Error base passes",
    source: "class E extends Base {}",
    expect: 0,
  },
  {
    name: "untagged globalThis.Error fails",
    source: "class E extends globalThis.Error {}",
    expect: 1,
  },
  {
    name: "tagged globalThis.Error passes",
    source: 'class E extends globalThis.Error { readonly _tag = "E"; }',
    expect: 0,
  },
  {
    name: "untagged imported Error alias fails",
    source: 'import { Error as E } from "./base.js";\nclass C extends E {}',
    expect: 1,
  },
  {
    name: "tagged imported Error alias passes",
    source: 'import { Error as E } from "./base.js";\nclass C extends E { readonly _tag = "C"; }',
    expect: 0,
  },
  {
    name: "two classes are counted independently",
    source: "class A extends Error {}\nclass B extends Error { readonly _tag = 'B'; }",
    expect: 1,
  },
  {
    name: "TSAbstractPropertyDefinition tag passes",
    source: "abstract class E extends Error { abstract readonly _tag: string; }",
    expect: 0,
  },
];

export function runSelfTest(
  fixtures = FIXTURES,
  throwFixtures = THROW_FIXTURES,
  leakFixtures = LEAK_FIXTURES,
) {
  let failed = 0;
  for (const fixture of leakFixtures) {
    const findings = findTypedFailureLeaks("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}`,
    );
  }
  for (const fixture of throwFixtures) {
    const findings = findUntaggedThrows("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}`,
    );
  }
  for (const fixture of fixtures) {
    const findings = findUntaggedErrors("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    const detail = findings.length > 0 ? ` — ${findings.map((f) => f.name).join("; ")}` : "";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}${detail}`,
    );
  }
  return {
    ok: failed === 0,
    failed,
    total: fixtures.length + throwFixtures.length + leakFixtures.length,
  };
}

function scopesFromArgs(args) {
  const index = args.indexOf("--scope");
  const value = index === -1 ? "all" : (args[index + 1] ?? "all");
  if (value === "all") return Object.keys(SCOPES);
  if (!Object.hasOwn(SCOPES, value)) {
    throw new Error(
      `assert-tagged-errors: unknown scope "${value}" (expected ${Object.keys(SCOPES).join(", ")})`,
    );
  }
  return [value];
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    console.log("assert-tagged-errors: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(`assert-tagged-errors: self-test FAILED (${String(failed)}/${String(total)})`);
      process.exit(1);
    }
    console.log(`assert-tagged-errors: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const scopes = scopesFromArgs(args);
  if (args.includes("--write")) {
    const all = scanUntaggedThrows(
      root,
      scopes.flatMap((scope) => SCOPES[scope]),
    );
    writeFileSync(
      resolve(root, THROW_BASELINE_PATH),
      `${JSON.stringify(countThrows(all), null, 2)}\n`,
    );
    console.log(`assert-tagged-errors: throw baseline written with ${String(all.length)} site(s).`);
    const leaks = scanTypedFailureLeaks(root);
    writeFileSync(
      resolve(root, LEAK_BASELINE_PATH),
      `${JSON.stringify(countThrows(leaks), null, 2)}\n`,
    );
    console.log(
      `assert-tagged-errors: typed-failure baseline written with ${String(leaks.length)} site(s).`,
    );
    return;
  }
  const throwBaseline = readThrowBaseline(root);
  let count = 0;
  for (const scope of scopes) {
    const roots = SCOPES[scope];
    const findings = scanTaggedErrors(root, roots, ALLOWLIST);
    count += findings.length;
    if (findings.length > 0) {
      const detail = findings
        .map((f) => `  ${f.file}:${String(f.line)} — ${f.name} extends Error without a _tag`)
        .join("\n");
      throw new Error(
        `assert-tagged-errors (${scope}): every in-process error needs a stable _tag (RULES.md "Errors").\n` +
          detail,
      );
    }
  }
  for (const scope of scopes) {
    const roots = SCOPES[scope];
    const prefixes = (file) => roots.some((prefix) => file.startsWith(`${prefix}/`));
    const scoped = Object.fromEntries(
      Object.entries(throwBaseline).filter(([file]) => prefixes(file)),
    );
    const added = unbaselinedThrows(scanUntaggedThrows(root, roots), scoped);
    if (added.length > 0) {
      const detail = added
        .map((f) => `  ${f.file}:${String(f.line)} — throw new ${f.name}(...) carries no _tag`)
        .join("\n");
      throw new Error(
        `assert-tagged-errors (${scope}): throw a tagged error (BluewaveError with a code, or a Data.TaggedError) so callers discriminate by tag, not message (RULES.md "Errors").\n` +
          detail,
      );
    }
  }
  const leakRoots = typedFailureRootsFor(scopes);
  if (leakRoots.length > 0) {
    const leakBaseline = readThrowBaseline(root, LEAK_BASELINE_PATH);
    const guarded = (file) => leakRoots.some((prefix) => file.startsWith(`${prefix}/`));
    const scopedLeakBaseline = Object.fromEntries(
      Object.entries(leakBaseline).filter(([file]) => guarded(file)),
    );
    const addedLeaks = unbaselinedThrows(
      scanTypedFailureLeaks(root, leakRoots),
      scopedLeakBaseline,
    );
    if (addedLeaks.length > 0) {
      const detail = addedLeaks
        .map(
          (f) => `  ${f.file}:${String(f.line)} — ${f.name} lets a failure leave the typed channel`,
        )
        .join("\n");
      throw new Error(
        `assert-tagged-errors (typed-failure): return the failure as a Result instead of throwing or catching it (RULES.md "Errors").\n` +
          detail,
      );
    }
  }
  console.log(
    `assert-tagged-errors: ok (${scopes.join(", ")} — no untagged errors, ${String(count)} finding(s))`,
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
    console.error(
      `assert-tagged-errors: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
