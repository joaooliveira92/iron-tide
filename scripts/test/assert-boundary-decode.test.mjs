// Tests for scripts/assert-boundary-decode.mjs — the boundary-cast gate over the
// content loader, desktop main and the bwc CLI entry point (RULES.md "Schema and
// boundaries"). Covers the rejected shapes (`as T`, parens, double assertion),
// the required decode shape, the fail-closed parse path, the reviewed allowlist
// (including its occurrence-count ratchet), and the guarded scopes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWLIST,
  SCOPES,
  filterAllowlisted,
  findBoundaryDecodeCasts,
  partitionAllowlist,
  scanBoundaryDecodeCasts,
} from "../assert-boundary-decode.mjs";

const count = (text) => findBoundaryDecodeCasts("a.ts", text).length;

void test("rejects a JSON.parse boundary cast", () => {
  assert.equal(count("const x = JSON.parse(s) as Foo;"), 1);
  assert.equal(count("const x = (JSON.parse(s)) as { a: number };"), 1);
});

void test("counts a double assertion once", () => {
  assert.equal(count("const x = JSON.parse(s) as unknown as Foo;"), 1);
});

void test("permits parsing into an unknown binding for schema decode", () => {
  assert.equal(count("const x: unknown = JSON.parse(s);"), 0);
  assert.equal(count("const x = decodeStrict(S, JSON.parse(s));"), 0);
});

void test("ignores non-JSON parse calls", () => {
  assert.equal(count("const x = parseYaml(s) as Foo;"), 0);
  assert.equal(count("const x = body.parse(s) as Foo;"), 0);
});

void test("reports the offending line", () => {
  const findings = findBoundaryDecodeCasts(
    "a.ts",
    "const a = 1;\nconst x = JSON.parse(s) as Foo;\n",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

void test("fails closed on a parse error", () => {
  assert.throws(
    () => findBoundaryDecodeCasts("a.ts", "const x = JSON.parse(s) as"),
    /failing closed/u,
  );
});

void test("reports the whitespace-normalised cast source as the allowlist key", () => {
  const [finding] = findBoundaryDecodeCasts("a.ts", "const x = JSON.parse( s ) as\n  Foo;");
  assert.equal(finding.snippet, "JSON.parse( s ) as Foo");
});

void test("an allowlist entry drops only its own finding", () => {
  const findings = [
    { file: "a.ts", line: 1, snippet: "JSON.parse(s) as Foo" },
    { file: "a.ts", line: 2, snippet: "JSON.parse(t) as Bar" },
    { file: "b.ts", line: 3, snippet: "JSON.parse(u) as Baz" },
  ];
  const kept = filterAllowlisted(findings, {
    "a.ts": { "JSON.parse(s) as Foo": { count: 1, reason: "why" } },
  });
  assert.deepEqual(
    kept.map((f) => `${f.file}:${String(f.line)}`),
    ["a.ts:2", "b.ts:3"],
  );
});

void test("a duplicate cast beyond its occurrence allowance is kept", () => {
  const snippet = "JSON.parse(s) as Foo";
  const findings = [
    { file: "a.ts", line: 1, snippet },
    { file: "a.ts", line: 9, snippet },
  ];
  const kept = filterAllowlisted(findings, { "a.ts": { [snippet]: { count: 1, reason: "why" } } });
  assert.deepEqual(
    kept.map((f) => f.line),
    [9],
  );
});

void test("partitionAllowlist reports an entry whose cast was removed as stale", () => {
  const allowlist = {
    "a.ts": {
      "JSON.parse(s) as Foo": { count: 1, reason: "why" },
      "JSON.parse(t) as Bar": { count: 1, reason: "gone" },
    },
  };
  const findings = [{ file: "a.ts", line: 1, snippet: "JSON.parse(s) as Foo" }];
  const { kept, stale } = partitionAllowlist(findings, allowlist);
  assert.deepEqual(kept, []);
  assert.deepEqual(stale, [{ file: "a.ts", snippet: "JSON.parse(t) as Bar", remaining: 1 }]);
});

void test("partitionAllowlist reports no stale entry when every count is consumed", () => {
  const snippet = "JSON.parse(s) as Foo";
  const findings = [
    { file: "a.ts", line: 1, snippet },
    { file: "a.ts", line: 2, snippet },
  ];
  const { kept, stale } = partitionAllowlist(findings, {
    "a.ts": { [snippet]: { count: 2, reason: "why" } },
  });
  assert.deepEqual(kept, []);
  assert.deepEqual(stale, []);
});

void test("scanBoundaryDecodeCasts fails closed on a stale entry when strict", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const stale = { "apps/compiler-cli/src/commands.ts": { "JSON.parse(x) as Gone": { count: 1 } } };
  assert.throws(
    () => scanBoundaryDecodeCasts(repoRoot, SCOPES.cli, stale, true),
    /stale allowlist entr.*commands\.ts.*JSON\.parse\(x\) as Gone/su,
  );
});

void test("the real tree passes every scope (allowlisted sites excluded)", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  for (const roots of Object.values(SCOPES)) {
    assert.deepEqual(scanBoundaryDecodeCasts(repoRoot, roots), []);
  }
});

void test("the cli scope is load-bearing: every allowlisted site is a real cast", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const raw = scanBoundaryDecodeCasts(repoRoot, SCOPES.cli, {});
  assert.ok(raw.length > 0, "the cli scope must guard at least one site");
  const observed = new Map();
  for (const finding of raw) {
    observed.set(
      `${finding.file}#${finding.snippet}`,
      (observed.get(`${finding.file}#${finding.snippet}`) ?? 0) + 1,
    );
  }
  const allowed = new Map();
  for (const [file, entries] of Object.entries(ALLOWLIST)) {
    for (const [snippet, entry] of Object.entries(entries)) {
      allowed.set(`${file}#${snippet}`, entry.count);
    }
  }
  assert.deepEqual(observed, allowed);
  assert.deepEqual(scanBoundaryDecodeCasts(repoRoot, SCOPES.cli), []);
});
