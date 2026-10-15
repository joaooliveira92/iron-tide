#!/usr/bin/env node
// Require the versioned canonical serializer for authoritative records.
//
// RULES.md "Determinism" forbids treating JavaScript insertion order as the
// canonical contract: authoritative bytes must be produced by the versioned
// canonical serializer (`canonicalSerialize` in `@bluewave/deterministic`), whose
// key/collection ordering is defined. This gate rejects raw `JSON.stringify` in
// the authoritative serialization roots — except the canonical serializer itself
// and a small reviewed allowlist of human-readable / non-hash uses (ADR-0106
// ratchet pattern).
//
// Scope: the authoritative serialization/command/event roots (`campaign`,
// `campaign-engine`, `commands`, `events`, `phase-engine`). Display formatting
// and deep-clone uses elsewhere are not part of the serialization contract.
//
// Usage: `node scripts/assert-canonical-serialization.mjs [--self-test]`
//
// Wired into `pnpm preflight`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");

/** The authoritative serialization roots the gate guards. */
export const AUTHORITATIVE_ROOTS = [
  "packages/campaign/src",
  "packages/campaign-engine/src",
  "packages/commands/src",
  "packages/events/src",
  "packages/phase-engine/src",
];

/**
 * Reviewed exceptions, keyed `"<repo-relative file>#<fingerprint>"` with a reason.
 * Each entry is a non-canonical use that is not an authoritative record: a
 * human-readable dump or a formatting helper.
 * @type {Readonly<Record<string, string>>}
 */
export const ALLOWLIST = {
  // Event-ledger / diagnostic dumps are human-readable `toString()` output, never
  // an authoritative hash or a persisted record.
  "packages/events/src/ledger.ts#db4858196f19763ad68ec45fcdc902944c16125ab66dc485b47dce0d6e4465a6":
    "human-readable ledger dump (toString), not an authoritative record",
};

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_RE = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;

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
  if (member.computed === true) {
    return typeof member.property?.value === "string" ? member.property.value : undefined;
  }
  return member.property?.name;
}

function isJsonStringify(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    memberName(node.callee) === "stringify"
  );
}

/**
 * Find raw `JSON.stringify(...)` calls in one source file.
 * @param {string} file repository-relative path (forward slashes)
 * @param {string} text source contents
 * @returns {Array<{file: string, line: number, fingerprint: string}>}
 */
export function findCanonicalSerialization(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-canonical-serialization: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide a raw serializer)",
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
    if (isJsonStringify(node)) {
      findings.push({
        file: normalized,
        line: lineAt(text, node.start),
        fingerprint: createHash("sha256")
          .update(normalize(text.slice(node.start, node.end)))
          .digest("hex"),
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
 * Scan the authored (non-test) source under the authoritative roots.
 * @param {string} repoRoot
 * @param {Readonly<Record<string, string>>} allowlist
 * @returns {Array<{file: string, line: number, fingerprint: string}>}
 */
export function scanCanonicalSerialization(repoRoot, allowlist = ALLOWLIST) {
  const isGuarded = (file) =>
    SOURCE_RE.test(file) &&
    !TEST_RE.test(file) &&
    AUTHORITATIVE_ROOTS.some((prefix) => file.startsWith(`${prefix}/`));
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
      throw new Error(`assert-canonical-serialization: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });

  for (const guarded of AUTHORITATIVE_ROOTS) {
    if (!present.some((file) => file.startsWith(`${guarded}/`))) {
      throw new Error(`assert-canonical-serialization: source discovery omitted ${guarded}`);
    }
  }

  return present
    .flatMap((file) =>
      findCanonicalSerialization(file, readFileSync(resolve(repoRoot, file), "utf8")),
    )
    .filter((finding) => !Object.hasOwn(allowlist, `${finding.file}#${finding.fingerprint}`));
}

// ---- embedded self-test fixtures ------------------------------------------
const FIXTURES = [
  { name: "raw JSON.stringify fails", source: "const s = JSON.stringify(x);", expect: 1 },
  { name: "bracket stringify fails", source: 'const s = JSON["stringify"](x);', expect: 1 },
  {
    name: "canonicalSerialize passes",
    source: "const s = canonicalSerialize(x);",
    expect: 0,
  },
  { name: "another object's stringify passes", source: "const s = codec.stringify(x);", expect: 0 },
  {
    name: "two stringify calls are counted independently",
    source: "const a = JSON.stringify(x); const b = JSON.stringify(y);",
    expect: 2,
  },
];

export function runSelfTest(fixtures = FIXTURES) {
  let failed = 0;
  for (const fixture of fixtures) {
    const findings = findCanonicalSerialization("fixture.ts", fixture.source);
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
    console.log("assert-canonical-serialization: self-test");
    const { ok, failed, total } = runSelfTest();
    if (!ok) {
      console.error(
        `assert-canonical-serialization: self-test FAILED (${String(failed)}/${String(total)})`,
      );
      process.exit(1);
    }
    console.log(`assert-canonical-serialization: self-test ok (${String(total)} fixtures)`);
    return;
  }

  const findings = scanCanonicalSerialization(root);
  if (findings.length > 0) {
    const detail = findings
      .map((f) => `  ${f.file}:${String(f.line)} (${f.fingerprint})`)
      .join("\n");
    throw new Error(
      "assert-canonical-serialization: raw JSON.stringify in an authoritative root. " +
        'Serialize authoritative records with the versioned canonical serializer (RULES.md "Determinism").\n' +
        detail,
    );
  }
  console.log(
    "assert-canonical-serialization: ok (no raw JSON.stringify in the authoritative roots)",
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
      `assert-canonical-serialization: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
