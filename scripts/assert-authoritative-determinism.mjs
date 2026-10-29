#!/usr/bin/env node
// Reject ambient non-determinism inside the authoritative pure packages.
//
// Bluewave's core guarantee is that identical content, inputs, commands and seeds
// produce identical authoritative hashes (RULES.md "Determinism"). The runtime-free
// pure packages must therefore never read ambient wall-clock time, randomness,
// process environment, or enumerate the filesystem — all of which vary between runs
// and machines. `pnpm lint:effect` surfaces these as *warnings*; this gate makes
// the rule fail closed over the pure packages, so the determinism guarantee cannot
// silently decay (ADR-0106 ratchet pattern).
//
// Scope: the `packages/**` entries of `RUNTIME_FREE_ROOTS` (the pure engine).
// `apps/desktop/src/main` is an app entry point and a synchronous `node:fs`
// pipeline (ADR-0128), and the IO-boundary packages (`persistence`,
// `content-compiler`, `compiler-cli`) are excluded by construction — their clocks
// and explicit-path reads are legitimate at the boundary. Tests are excluded.
//
// Detection is deliberately narrow and true to the RULES.md wording: an explicit
// `new Date(ms)` value conversion is deterministic and allowed; only the ambient
// zero-argument `new Date()` is rejected. An explicit-path `readFileSync` is
// deterministic; only *enumeration* (`readdir`/`opendir` and their `Sync`
// variants) is rejected.
//
// A second rule (map D4/D5) rejects float arithmetic in the outcome-producing pure
// packages (`FLOAT_ROOTS`): a fractional numeric literal or `parseFloat` fails closed,
// so no float drifts into a hashed outcome. It excludes the rounding-vocabulary home
// (`contracts`/`deterministic`) and presentation (`ship-visual`), which carry fractional
// constants legitimately.
//
// A third rule rejects locale-sensitive APIs (`localeCompare`, `toLocale*String`,
// `toLocaleUpperCase`/`toLocaleLowerCase`, any `Intl` access): collation and
// formatting vary with the ICU build and runtime locale, so authoritative order and
// text must use code-unit comparison (ADR-0218). A fourth rule inspects every
// `RandomLedger.record({...})` call: a blank `inputHash` or an inline string-literal
// `reasonCode` (rather than a catalogued constant) leaves a draw without provenance.
//
// New occurrences are forbidden; a small reviewed allowlist (keyed by file +
// content fingerprint) exists for exceptions, and may only shrink.
//
// Usage: `node scripts/assert-authoritative-determinism.mjs [--self-test|--write]`
//   (default)   verify the tree against the allowlist
//   --self-test run the embedded detection fixtures
//   --write     (re)seed the allowlist from the current tree (accepts current debt)
//
// Wired into `pnpm preflight`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

import { RUNTIME_FREE_ROOTS } from "./assert-runtime-free.mjs";

const root = resolve(import.meta.dirname, "..");
const BASELINE_PATH = "scripts/authoritative-determinism.baseline.json";

/** The authoritative pure packages: the `packages/**` runtime-free roots. */
export const DETERMINISM_ROOTS = RUNTIME_FREE_ROOTS.filter((entry) =>
  entry.startsWith("packages/"),
);

/**
 * The outcome-producing pure packages whose arithmetic must stay integer/fixed-point
 * (map D4/D5): the authoritative serialization roots plus the two float paths the audit
 * found (combat strength, the economy capacity ratio). Excludes the rounding-vocabulary
 * home (`contracts`, `deterministic`) and presentation (`ship-visual`), which legitimately
 * carry fractional constants. A fractional float literal or `parseFloat` here fails closed.
 */
export const FLOAT_ROOTS = [
  "packages/campaign/src",
  "packages/campaign-engine/src",
  "packages/commands/src",
  "packages/events/src",
  "packages/phase-engine/src",
  "packages/combat/src",
  "packages/ship-design/src",
];

/**
 * Authored content modules (ADR-0334). They are data, not application code: only
 * the authoring package may be imported, no dynamic import, no eval/Function, and
 * unlike the package roots they carry no allowlist at all.
 */
export const CONTENT_MODULE_ROOTS = ["content/production"];

export const CONTENT_MODULE_IMPORT_ALLOWLIST = ["@bluewave/content-authoring"];

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const LOCALE_METHODS = new Set([
  "localeCompare",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
  "toLocaleLowerCase",
]);

/** Filesystem *enumeration* is ambient; explicit-path reads are not. */
const FS_ENUMERATION = new Set(["readdir", "readdirSync", "opendir", "opendirSync"]);

function isGuarded(file) {
  return (
    SOURCE_RE.test(file) &&
    !TEST_RE.test(file) &&
    DETERMINISM_ROOTS.some((prefix) => file.startsWith(`${prefix}/`))
  );
}

function normalize(text) {
  return text.replace(/\s+/gu, " ").trim();
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function memberName(member) {
  if (member === null || member === undefined || member.computed === true) {
    return typeof member?.property?.value === "string" ? member.property.value : undefined;
  }
  return member.property?.name;
}

function isCall(node) {
  return node.type === "CallExpression";
}

/**
 * Classify a call expression as an ambient-determinism hazard, or `null`.
 * @param {object} node - an oxc CallExpression.
 * @returns {string | null}
 */
function classifyCall(node) {
  const callee = node.callee;
  if (callee === null || typeof callee !== "object") return null;
  if (callee.type === "Identifier") {
    if (callee.name === "randomUUID") return "random-uuid";
    if (callee.name === "parseFloat") return "parse-float";
    if (FS_ENUMERATION.has(callee.name)) return "fs-enumeration";
    return null;
  }
  if (callee.type !== "MemberExpression") return null;
  const object = callee.object;
  const property = memberName(callee);
  if (LOCALE_METHODS.has(property ?? "")) return "locale-sensitive";
  if (object?.type !== "Identifier") {
    if (property === "randomUUID") return "random-uuid";
    if (FS_ENUMERATION.has(property ?? "")) return "fs-enumeration";
    return null;
  }
  if (object.name === "Date" && property === "now") return "date-now";
  if (object.name === "Math" && property === "random") return "math-random";
  if (object.name === "crypto" && property === "randomUUID") return "random-uuid";
  if (object.name === "Number" && property === "parseFloat") return "parse-float";
  if (FS_ENUMERATION.has(property ?? "")) return "fs-enumeration";
  return null;
}

/**
 * Classify a member access (not called) as an ambient hazard, or `null`.
 * @param {object} node - an oxc MemberExpression.
 * @returns {string | null}
 */
function classifyMember(node) {
  if (node.object?.type === "Identifier" && node.object.name === "process") {
    if (memberName(node) === "env") return "process-env";
  }
  if (node.object?.type === "Identifier" && node.object.name === "Intl") return "locale-sensitive";
  return null;
}

function propertyKeyName(property) {
  const key = property?.key;
  if (key?.type === "Identifier") return key.name;
  if (key?.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

function isEmptyString(value) {
  if (value?.type === "Literal") return value.value === "";
  if (value?.type === "TemplateLiteral") {
    return value.expressions.length === 0 && value.quasis.every((q) => q.value.cooked === "");
  }
  return false;
}

function isStringLiteral(value) {
  return (
    (value?.type === "Literal" && typeof value.value === "string") ||
    (value?.type === "TemplateLiteral" && value.expressions.length === 0)
  );
}

/**
 * Inspect a `<ledger>.record({...})` call for draws recorded without provenance.
 * @param {object} node - an oxc CallExpression.
 * @returns {Array<{kind: string, node: object}>}
 */
function classifyLedgerRecord(node) {
  const callee = node.callee;
  if (callee?.type !== "MemberExpression" || memberName(callee) !== "record") return [];
  const argument = node.arguments?.[0];
  if (argument?.type !== "ObjectExpression") return [];
  const hazards = [];
  for (const property of argument.properties) {
    if (property.type !== "Property") continue;
    const name = propertyKeyName(property);
    if (name === "inputHash" && isEmptyString(property.value)) {
      hazards.push({ kind: "ledger-blank-input-hash", node: property });
    }
    if (name === "reasonCode" && isStringLiteral(property.value)) {
      hazards.push({ kind: "ledger-literal-reason-code", node: property });
    }
  }
  return hazards;
}

/**
 * Find ambient non-determinism in one source file, in source order.
 * @param {string} file - repository-relative path (forward slashes).
 * @param {string} text - source contents.
 * @returns {Array<{file: string, line: number, kind: string, fingerprint: string}>}
 */
export function findAmbientDeterminism(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-authoritative-determinism: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a hazard)",
    );
  }
  const findings = [];
  const record = (kind, start, end) => {
    findings.push({
      file: normalized,
      line: lineAt(text, start),
      kind,
      fingerprint: createHash("sha256")
        .update(`${kind}:${normalize(text.slice(start, end))}`)
        .digest("hex"),
    });
  };
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (node.type === "NewExpression" && node.callee?.type === "Identifier") {
      if (node.callee.name === "Date" && (node.arguments?.length ?? 0) === 0) {
        record("date-new", node.start, node.end);
      }
    } else if (isCall(node)) {
      const kind = classifyCall(node);
      if (kind !== null) record(kind, node.start, node.end);
      for (const hazard of classifyLedgerRecord(node)) {
        record(hazard.kind, hazard.node.start, hazard.node.end);
      }
    } else if (node.type === "MemberExpression") {
      const kind = classifyMember(node);
      if (kind !== null) record(kind, node.start, node.end);
    } else if (
      node.type === "Literal" &&
      typeof node.value === "number" &&
      Number.isFinite(node.value) &&
      !Number.isInteger(node.value)
    ) {
      record("float-literal", node.start, node.end);
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return findings.sort((a, b) => a.line - b.line || (a.kind < b.kind ? -1 : 1));
}

export function isContentModule(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized.endsWith(".ts") &&
    !TEST_RE.test(normalized) &&
    CONTENT_MODULE_ROOTS.some((root) => normalized.startsWith(`${root}/`))
  );
}

/**
 * Find forbidden imports and dynamic code in one authored content module.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, kind: string, fingerprint: string}>}
 */
export function findContentModuleHazards(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-authoritative-determinism: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed content module could hide a hazard)",
    );
  }
  const findings = [];
  const record = (kind, start, end) => {
    findings.push({
      file: normalized,
      line: lineAt(text, start),
      kind,
      fingerprint: createHash("sha256")
        .update(`${kind}:${normalize(text.slice(start, end))}`)
        .digest("hex"),
    });
  };
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
      typeof node.source?.value === "string"
    ) {
      const specifier = node.source.value;
      if (!CONTENT_MODULE_IMPORT_ALLOWLIST.includes(specifier)) {
        record("forbidden-import", node.start, node.end);
      }
    } else if (node.type === "ImportExpression") {
      record("dynamic-import", node.start, node.end);
    } else if (isCall(node) && node.callee?.type === "Identifier") {
      if (node.callee.name === "require" || node.callee.name === "eval") {
        record("dynamic-code", node.start, node.end);
      }
    } else if (node.type === "NewExpression" && node.callee?.type === "Identifier") {
      if (node.callee.name === "Function") record("dynamic-code", node.start, node.end);
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return findings.sort((a, b) => a.line - b.line || (a.kind < b.kind ? -1 : 1));
}

/**
 * Scan every authored source file under the authoritative pure packages.
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, kind: string, fingerprint: string}>}
 */
export function scanAmbientDeterminism(repoRoot) {
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
      throw new Error(`assert-authoritative-determinism: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  // Fail closed if discovery silently omitted a guarded root.
  for (const guarded of DETERMINISM_ROOTS) {
    if (!present.some((file) => file.startsWith(`${guarded}/`))) {
      throw new Error(`assert-authoritative-determinism: source discovery omitted ${guarded}`);
    }
  }

  const isFloatKind = (kind) => kind === "float-literal" || kind === "parse-float";
  const packageFindings = present
    .flatMap((file) => findAmbientDeterminism(file, readFileSync(resolve(repoRoot, file), "utf8")))
    .filter(
      (finding) =>
        !isFloatKind(finding.kind) ||
        FLOAT_ROOTS.some((root) => finding.file.startsWith(`${root}/`)),
    );

  const contentFiles = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter(isContentModule),
    ),
  ].sort();
  const contentFindings = contentFiles.flatMap((file) => {
    const text = readFileSync(resolve(repoRoot, file), "utf8");
    return [
      ...findContentModuleHazards(file, text),
      ...findAmbientDeterminism(file, text).filter((finding) => finding.kind !== "float-literal"),
    ];
  });

  return [...packageFindings, ...contentFindings];
}

/** Count findings per file and fingerprint, in stable code-unit order. */
export function countFindings(findings) {
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

function readAllowlist(repoRoot) {
  let value;
  try {
    value = JSON.parse(readFileSync(resolve(repoRoot, BASELINE_PATH), "utf8"));
  } catch (error) {
    throw new Error(
      `assert-authoritative-determinism: cannot read ${BASELINE_PATH}: ${error.message}`,
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("assert-authoritative-determinism: allowlist must be a file-to-counts object");
  }
  const allowlist = {};
  for (const [file, perFile] of Object.entries(value)) {
    if (
      !isGuarded(file) ||
      file.startsWith("/") ||
      file.includes("\\") ||
      file.split("/").includes("..") ||
      typeof perFile !== "object" ||
      perFile === null ||
      Array.isArray(perFile)
    ) {
      throw new Error(`assert-authoritative-determinism: invalid allowlist file: ${file}`);
    }
    const parsed = {};
    for (const [fingerprint, count] of Object.entries(perFile)) {
      if (!/^[a-f0-9]{64}$/u.test(fingerprint) || !Number.isSafeInteger(count) || count <= 0) {
        throw new Error(
          `assert-authoritative-determinism: invalid allowlist count: ${file}:${fingerprint}`,
        );
      }
      parsed[fingerprint] = count;
    }
    allowlist[file] = parsed;
  }
  return allowlist;
}

function writeAllowlist(repoRoot, allowlist) {
  writeFileSync(resolve(repoRoot, BASELINE_PATH), `${JSON.stringify(allowlist, null, 2)}\n`);
}

/**
 * Verify (or seed) the ambient-determinism allowlist.
 * @param {string} repoRoot
 * @param {"verify"|"write"} mode
 * @returns {number} the number of findings observed.
 */
export function verifyAmbientDeterminism(repoRoot, mode = "verify") {
  const findings = scanAmbientDeterminism(repoRoot);
  const current = countFindings(findings);

  if (mode === "write") {
    writeAllowlist(repoRoot, current);
    return findings.length;
  }

  const allowlist = readAllowlist(repoRoot);
  const remaining = structuredClone(allowlist);
  const added = [];
  for (const finding of findings) {
    if (isContentModule(finding.file)) {
      added.push(finding);
      continue;
    }
    const perFile = remaining[finding.file];
    const allowance = perFile?.[finding.fingerprint] ?? 0;
    if (perFile !== undefined && allowance > 0) perFile[finding.fingerprint] = allowance - 1;
    else added.push(finding);
  }
  if (added.length > 0) {
    const detail = added
      .map((f) => `  ${f.file}:${String(f.line)} — ${f.kind} (${f.fingerprint})`)
      .join("\n");
    throw new Error(
      "assert-authoritative-determinism: ambient non-determinism in an authoritative package.\n" +
        "Required inputs must enter through validated requests/ports, not the ambient clock, " +
        "randomness, environment, or filesystem enumeration (RULES.md 'Determinism').\n" +
        detail,
    );
  }
  return findings.length;
}

const FIXTURES = [
  { name: "Date.now() fails", source: "const t = Date.now();", expect: 1 },
  { name: "new Date() with no args fails", source: "const t = new Date();", expect: 1 },
  {
    name: "new Date(ms) value conversion is allowed",
    source: "const t = new Date(1234);",
    expect: 0,
  },
  {
    name: "Date.UTC is allowed",
    source: "const t = Date.UTC(1910, 0, 1);",
    expect: 0,
  },
  { name: "Math.random() fails", source: "const r = Math.random();", expect: 1 },
  { name: "randomUUID() fails", source: "const id = randomUUID();", expect: 1 },
  { name: "crypto.randomUUID() fails", source: "const id = crypto.randomUUID();", expect: 1 },
  { name: "process.env fails", source: "const v = process.env.HOME;", expect: 1 },
  {
    name: "process.env bracket access fails",
    source: 'const v = process.env["HOME"];',
    expect: 1,
  },
  { name: "readdirSync fails", source: "const xs = readdirSync(dir);", expect: 1 },
  { name: "fs.readdirSync fails", source: "const xs = fs.readdirSync(dir);", expect: 1 },
  {
    name: "explicit-path readFileSync is allowed",
    source: "const s = readFileSync(path, 'utf8');",
    expect: 0,
  },
  {
    name: "member Date.now on another object is allowed",
    source: "const t = clock.now();",
    expect: 0,
  },
  {
    name: "a field named env on another object is allowed",
    source: "const v = config.env;",
    expect: 0,
  },
  {
    name: "multiple hazards in one line are each counted",
    source: "const x = [Date.now(), Math.random()];",
    expect: 2,
  },
  { name: "a fractional float literal fails", source: "const x = 1.5;", expect: 1 },
  { name: "an integer literal is allowed", source: "const x = 2;", expect: 0 },
  { name: "a BigInt literal is allowed", source: "const x = 2n;", expect: 0 },
  { name: "a float value inside a string is allowed", source: 'const s = "1.5";', expect: 0 },
  { name: "parseFloat fails", source: "const x = parseFloat(s);", expect: 1 },
  { name: "localeCompare fails", source: "const o = a.localeCompare(b);", expect: 1 },
  { name: "toLocaleString fails", source: "const t = n.toLocaleString();", expect: 1 },
  { name: "toLocaleUpperCase fails", source: "const t = s.toLocaleUpperCase();", expect: 1 },
  { name: "Intl.NumberFormat fails", source: "const f = new Intl.NumberFormat('en');", expect: 1 },
  {
    name: "a compareStrings call is allowed",
    source: "const o = compareStrings(a, b);",
    expect: 0,
  },
  {
    name: "a ledger draw with a blank inputHash fails",
    source: "ledger.record({ streamId, inputHash: '', reasonCode: CODE });",
    expect: 1,
  },
  {
    name: "a ledger draw with an inline reasonCode literal fails",
    source: "ledger.record({ streamId, inputHash: digest, reasonCode: 'DAMAGE_HIT_ZONE_DRAW' });",
    expect: 1,
  },
  {
    name: "a ledger draw with a hash and catalogued code passes",
    source: "ledger.record({ streamId, inputHash: digest, reasonCode: DAMAGE_KEYED_DRAW });",
    expect: 0,
  },
  {
    name: "a blank inputHash outside a ledger record is allowed",
    source: "const row = { inputHash: '' };",
    expect: 0,
  },
  { name: "Number.parseFloat fails", source: "const x = Number.parseFloat(s);", expect: 1 },
];

const CONTENT_FIXTURES = [
  {
    name: "content module importing the authoring package is allowed",
    source: 'import { defineShipComponent } from "@bluewave/content-authoring";',
    expect: 0,
  },
  {
    name: "content module importing node:fs fails",
    source: 'import { readFileSync } from "node:fs";',
    expect: 1,
  },
  {
    name: "content module importing a relative module fails",
    source: 'import shared from "../shared.ts";',
    expect: 1,
  },
  {
    name: "content module re-export from the authoring package is allowed",
    source: 'export { number } from "@bluewave/content-authoring";',
    expect: 0,
  },
  {
    name: "content module dynamic import fails",
    source: 'const m = await import("./x.ts");',
    expect: 1,
  },
  {
    name: "content module new Function fails",
    source: 'const f = new Function("return 1");',
    expect: 1,
  },
  { name: "content module eval fails", source: 'const x = eval("1");', expect: 1 },
  { name: "content module Math.random fails", source: "const r = Math.random();", expect: 1 },
  { name: "content module Date.now fails", source: "const t = Date.now();", expect: 1 },
  { name: "content module process.env fails", source: "const e = process.env.HOME;", expect: 1 },
  { name: "content module fractional literal fails", source: "const x = 1.5;", expect: 1 },
];

export function runSelfTest(fixtures = FIXTURES, contentFixtures = CONTENT_FIXTURES) {
  let failed = 0;
  for (const fixture of contentFixtures) {
    const file = "content/production/1880/fixture.ts";
    const findings = [
      ...findContentModuleHazards(file, fixture.source),
      ...findAmbientDeterminism(file, fixture.source),
    ];
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const detail = findings.length > 0 ? ` — ${findings.map((f) => f.kind).join("; ")}` : "";
    console.log(
      `  ${passed ? "ok  " : "FAIL"} content fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}${detail}`,
    );
  }
  for (const fixture of fixtures) {
    const findings = findAmbientDeterminism("fixture.ts", fixture.source);
    const passed = findings.length === fixture.expect;
    if (!passed) failed += 1;
    const verdict = passed ? "ok  " : "FAIL";
    const detail = findings.length > 0 ? ` — ${findings.map((f) => f.kind).join("; ")}` : "";
    console.log(
      `  ${verdict} fixture "${fixture.name}": expected ${String(fixture.expect)} finding(s), got ${String(findings.length)}${detail}`,
    );
  }
  return { ok: failed === 0, failed, total: fixtures.length + contentFixtures.length };
}

function main() {
  if (process.argv.includes("--self-test")) {
    console.log("assert-authoritative-determinism: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(
        `assert-authoritative-determinism: self-test FAILED (${String(failed)}/${String(total)})`,
      );
      process.exit(1);
    }
    console.log(`assert-authoritative-determinism: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const mode = process.argv.includes("--write") ? "write" : "verify";
  const count = verifyAmbientDeterminism(root, mode);
  if (mode === "write") {
    console.log(
      `assert-authoritative-determinism: allowlist written with ${String(count)} existing finding(s).`,
    );
    return;
  }
  console.log(
    `assert-authoritative-determinism: ok (${String(DETERMINISM_ROOTS.length)} roots, no ambient determinism)`,
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
      `assert-authoritative-determinism: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
