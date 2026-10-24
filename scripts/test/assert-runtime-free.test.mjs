// Tests for scripts/assert-runtime-free.mjs — the runtime-free import gate's
// detection boundary (ADR-0100 §2, ADR-0159). Covers admitted runtime-free
// forms, rejected runtime symbols/subpaths, aliases, re-exports, dynamic
// imports, and the fail-closed parse path.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findRuntimeImports,
  RUNTIME_FREE_ROOTS,
  RUNTIME_FREE_SYMBOLS,
  RUNTIME_FREE_TEST_EXEMPTIONS,
  RUNTIME_FREE_TEST_ROOTS,
} from "../assert-runtime-free.mjs";

const count = (text) => findRuntimeImports("a.ts", text).length;

void test("admits the runtime-free subset from `effect`", () => {
  assert.equal(count('import { Data, Schema, Result, Option } from "effect";'), 0);
});

void test("admits aliased and type-only runtime-free imports", () => {
  assert.equal(count('import { Schema as S } from "effect";'), 0);
  assert.equal(count('import type { Schema } from "effect";'), 0);
});

void test("admits runtime-free `effect/<Name>` subpaths", () => {
  assert.equal(count('import { Schema } from "effect/Schema";'), 0);
  assert.equal(count('import { Result } from "effect/Result";'), 0);
});

void test("rejects runtime symbols, however aliased", () => {
  assert.equal(count('import { Effect } from "effect";'), 1);
  assert.equal(count('import { Effect as E } from "effect";'), 1);
  assert.equal(count('import { Layer } from "effect";'), 1);
  assert.equal(count('import { Context } from "effect";'), 1);
  assert.equal(count('import { ManagedRuntime } from "effect";'), 1);
});

void test("rejects a namespace import of `effect`", () => {
  assert.equal(count('import * as Effect from "effect";'), 1);
});

void test("rejects runtime module subpaths and @effect packages", () => {
  assert.equal(count('import { runPromise } from "effect/Effect";'), 1);
  assert.equal(count('import { x } from "effect/unstable/foo";'), 1);
  assert.equal(count('import { describe } from "@effect/vitest";'), 1);
});

void test("rejects re-exports and dynamic imports of the runtime", () => {
  assert.equal(count('export { Effect } from "effect";'), 1);
  assert.equal(count('const m = await import("effect");'), 1);
});

void test("ignores unrelated package imports", () => {
  assert.equal(count('import { SafeInt } from "@bluewave/contracts";'), 0);
});

void test("detects runtime symbols inside a multi-line import", () => {
  assert.equal(count('import {\n  Schema,\n  Effect,\n} from "effect";'), 1);
});

void test("reports the offending source line", () => {
  const findings = findRuntimeImports("a.ts", 'const a = 1;\nimport { Effect } from "effect";\n');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

void test("fails closed on a parse error rather than silently reporting zero", () => {
  assert.throws(
    () => findRuntimeImports("a.ts", "import { Effect } from 'effect"),
    /failing closed/u,
  );
});

void test("the runtime-free policy is an allowlist of data-only symbols", () => {
  for (const symbol of ["Data", "Schema", "Result", "Option", "Predicate", "Equal", "Hash"]) {
    assert.ok(RUNTIME_FREE_SYMBOLS.has(symbol), `expected ${symbol} to be runtime-free`);
  }
  for (const symbol of ["Effect", "Layer", "Context", "ManagedRuntime"]) {
    assert.ok(!RUNTIME_FREE_SYMBOLS.has(symbol), `expected ${symbol} to be runtime`);
  }
});

void test("guards the runtime-free packages but not the runtime app surfaces", () => {
  assert.ok(RUNTIME_FREE_ROOTS.includes("packages/phase-engine/src"));
  assert.ok(RUNTIME_FREE_ROOTS.includes("packages/combat/src"));
  assert.ok(!RUNTIME_FREE_ROOTS.includes("packages/persistence/src"));
  // ADR-0159: the app surfaces adopt the full runtime and are no longer guarded.
  assert.ok(!RUNTIME_FREE_ROOTS.includes("apps/desktop/src/main"));
});

void test("guards the test directory of every runtime-free package except the exemptions", () => {
  assert.ok(RUNTIME_FREE_TEST_ROOTS.includes("packages/combat/test"));
  assert.ok(RUNTIME_FREE_TEST_ROOTS.includes("packages/campaign-engine/test"));
  for (const exempt of RUNTIME_FREE_TEST_EXEMPTIONS) {
    assert.ok(!RUNTIME_FREE_TEST_ROOTS.includes(`${exempt}/test`));
    assert.ok(RUNTIME_FREE_ROOTS.includes(`${exempt}/src`));
  }
  assert.equal(
    RUNTIME_FREE_TEST_ROOTS.length,
    RUNTIME_FREE_ROOTS.length - RUNTIME_FREE_TEST_EXEMPTIONS.length,
  );
});
