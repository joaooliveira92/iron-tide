// Tests for scripts/assert-canonical-serialization.mjs — the canonical-serializer
// gate over the authoritative serialization roots (RULES.md "Determinism").
// Covers the rejected raw `JSON.stringify` (dot and bracket), the permitted
// canonical serializer, the fail-closed parse path, and the guarded roots.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUTHORITATIVE_ROOTS,
  findCanonicalSerialization,
  scanCanonicalSerialization,
} from "../assert-canonical-serialization.mjs";

const count = (text) => findCanonicalSerialization("a.ts", text).length;

void test("rejects raw JSON.stringify", () => {
  assert.equal(count("const s = JSON.stringify(x);"), 1);
  assert.equal(count('const s = JSON["stringify"](x);'), 1);
});

void test("admits the canonical serializer and other codecs", () => {
  assert.equal(count("const s = canonicalSerialize(x);"), 0);
  assert.equal(count("const s = codec.stringify(x);"), 0);
});

void test("counts each call independently", () => {
  assert.equal(count("const a = JSON.stringify(x); const b = JSON.stringify(y);"), 2);
});

void test("reports the offending line", () => {
  const findings = findCanonicalSerialization(
    "a.ts",
    "const a = 1;\nconst s = JSON.stringify(x);\n",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

void test("fails closed on a parse error", () => {
  assert.throws(
    () => findCanonicalSerialization("a.ts", "const s = JSON.stringify("),
    /failing closed/u,
  );
});

void test("guards the authoritative roots and the real tree is clean", () => {
  assert.ok(AUTHORITATIVE_ROOTS.includes("packages/campaign-engine/src"));
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  assert.deepEqual(scanCanonicalSerialization(repoRoot), []);
});
