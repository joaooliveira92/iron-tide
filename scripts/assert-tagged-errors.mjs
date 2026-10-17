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
// Usage: `node scripts/assert-tagged-errors.mjs [--scope engine|surface|all] [--self-test]`
//
// Wired into `pnpm preflight` (one self-test, then one gate per scope).

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
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

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
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
  return { ok: failed === 0, failed, total: fixtures.length };
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
