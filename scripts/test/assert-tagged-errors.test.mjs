// Tests for scripts/assert-tagged-errors.mjs — the untagged-error gate over the
// in-process error roots (RULES.md "Errors"). Covers both reachability scopes,
// the compliant shapes (a `_tag` field/accessor, `Data.TaggedError`), the
// fail-closed parse path, and the guarded-root discovery.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { SCOPES, findUntaggedErrors, scanTaggedErrors } from "../assert-tagged-errors.mjs";

const count = (text) => findUntaggedErrors("a.ts", text).length;

void test("rejects a plain Error subclass with no _tag", () => {
  assert.equal(count("class E extends Error {}"), 1);
});

void test("admits a class carrying a _tag field", () => {
  assert.equal(count('class E extends Error { readonly _tag = "E"; }'), 0);
});

void test("admits a class carrying a _tag accessor", () => {
  assert.equal(count('class E extends Error { get _tag() { return "E"; } }'), 0);
});

void test("admits a Data.TaggedError subclass", () => {
  assert.equal(count('class E extends Data.TaggedError("E")<{}> {}'), 0);
});

void test("admits a non-Error base class", () => {
  assert.equal(count("class E extends Base {}"), 0);
});

void test("rejects an untagged globalThis.Error subclass (G4)", () => {
  assert.equal(count("class E extends globalThis.Error {}"), 1);
});

void test("admits a tagged globalThis.Error subclass (G4)", () => {
  assert.equal(count('class E extends globalThis.Error { readonly _tag = "E"; }'), 0);
});

void test("rejects an untagged class extending an imported Error alias (G4)", () => {
  assert.equal(count('import { Error as E } from "./base.js";\nclass C extends E {}'), 1);
});

void test("admits a tagged class extending an imported Error alias (G4)", () => {
  assert.equal(
    count('import { Error as E } from "./base.js";\nclass C extends E { readonly _tag = "C"; }'),
    0,
  );
});

void test("does not treat an unrelated imported alias as Error (G4)", () => {
  assert.equal(count('import { Base as E } from "./base.js";\nclass C extends E {}'), 0);
});

void test("reports the offending source line and name", () => {
  const findings = findUntaggedErrors("a.ts", "const a = 1;\nclass E extends Error {}\n");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].name, "E");
});

void test("counts each untagged class independently", () => {
  assert.equal(count("class A extends Error {}\nclass B extends Error {}"), 2);
});

void test("fails closed on a parse error", () => {
  assert.throws(() => findUntaggedErrors("a.ts", "class E extends Error {"), /failing closed/u);
});

void test("the real tree passes both scopes", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  for (const roots of Object.values(SCOPES)) {
    assert.deepEqual(scanTaggedErrors(repoRoot, roots), []);
  }
});
