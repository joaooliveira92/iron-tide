// Tests for scripts/verify-no-unknown-casts.mjs — the ratchet gate's detection
// boundary. Covers admitted forms, excluded look-alikes, fingerprint grouping,
// line reporting, and the fail-closed parse path.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countUnknownCasts,
  findUnknownCasts,
  isStrictEnvironment,
} from "../verify-no-unknown-casts.mjs";

const count = (file, text) => findUnknownCasts(file, text).length;

void test("admitted: `as unknown`", () => {
  assert.equal(count("a.ts", "const x = y as unknown;"), 1);
});

void test("admitted: angle-bracket `<unknown>`", () => {
  assert.equal(count("a.ts", "const x = <unknown>y;"), 1);
});

void test("admitted: `unknown` member of an asserted union", () => {
  assert.equal(count("a.ts", "const x = y as Foo | unknown;"), 1);
  assert.equal(count("a.ts", "const x = y as unknown | Foo;"), 1);
});

void test("admitted: parenthesized `unknown`", () => {
  assert.equal(count("a.ts", "const x = y as (unknown);"), 1);
});

void test("admitted: nested `as unknown as Foo` counts the inner unknown assertion", () => {
  assert.equal(count("a.ts", "const x = y as unknown as Foo;"), 1);
});

void test("excluded: `as any`, `as const`, and a typed target", () => {
  assert.equal(count("a.ts", "const a = y as any;"), 0);
  assert.equal(count("a.ts", "const b = [1, 2] as const;"), 0);
  assert.equal(count("a.ts", "const c = y as Foo;"), 0);
});

void test("excluded: look-alikes in strings and comments", () => {
  assert.equal(count("a.ts", 'const s = "as unknown";\n'), 0);
  assert.equal(count("a.ts", "// const x = y as unknown;\n"), 0);
  assert.equal(count("a.ts", "/* <unknown>x */\n"), 0);
});

void test("reports the assertion's source line", () => {
  const casts = findUnknownCasts("a.ts", "const a = 1;\nconst b = 2;\nconst c = x as unknown;\n");
  assert.equal(casts.length, 1);
  assert.equal(casts[0].line, 3);
});

void test("grouping: identical assertions share a fingerprint and count twice", () => {
  const casts = findUnknownCasts("a.ts", "const a = p as unknown;\nconst b = q as unknown;\n");
  assert.equal(casts.length, 2);
  assert.equal(casts[0].fingerprint, casts[1].fingerprint);
  const counted = countUnknownCasts(casts);
  assert.deepEqual(counted["a.ts"], { [casts[0].fingerprint]: 2 });
});

void test("grouping order is by code unit, not locale", () => {
  const casts = [
    { file: "b.ts", fingerprint: "b" },
    { file: "A.ts", fingerprint: "a" },
    { file: "a.ts", fingerprint: "a" },
  ];
  assert.deepEqual(Object.keys(countUnknownCasts(casts)), ["A.ts", "a.ts", "b.ts"]);
});

void test("fails closed on a parse error rather than silently reporting zero", () => {
  assert.throws(() => findUnknownCasts("a.ts", "const x = (y as unknown"), /failing closed/u);
});

void test("strict mode is on in CI and off locally", () => {
  assert.equal(isStrictEnvironment({ CI: "true" }), true);
  assert.equal(isStrictEnvironment({ CI: "1" }), true);
  assert.equal(isStrictEnvironment({ CI: "false" }), false);
  assert.equal(isStrictEnvironment({ CI: "0" }), false);
  assert.equal(isStrictEnvironment({}), false);
});
