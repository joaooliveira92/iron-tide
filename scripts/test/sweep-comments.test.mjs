// Tests for scripts/sweep-comments.mjs — the deterministic comment-sweep lever.
// The classifier is pure, so these assert the three removal classes and the
// deliberate keeps without touching the filesystem.
import assert from "node:assert/strict";
import { test } from "node:test";

import { safeLabel, sweepSource } from "../sweep-comments.mjs";

void test("safeLabel removes short token-free noun labels only", () => {
  assert.equal(safeLabel("Severity enum"), true);
  assert.equal(safeLabel("canonical ids"), true);
  assert.equal(safeLabel("RNG draw"), true);
  assert.equal(safeLabel(""), false);
  assert.equal(safeLabel("kg -> bp of displacement (DESIGN-41 §14)"), false);
  assert.equal(safeLabel("Fresh game (reads shipped content)"), false);
  assert.equal(safeLabel("Stage 3: the slot's bounds"), false);
  assert.equal(safeLabel("legacy-compatibility drift"), false);
  assert.equal(safeLabel("one two three four five"), false);
});

void test("sweepSource drops self-path headers, rulers, and JSX narration", () => {
  const src = [
    "// packages/widget/src/thing.ts",
    "import x from './x.js';",
    "",
    "// ---- Severity enum ----",
    "export const A = 1;",
    "",
    "// ---- kg -> bp (DESIGN-41 §14) ----",
    "export const B = 2;",
    "",
    "function View() {",
    "  return (",
    "    <div>",
    "      {/* Scrim */}",
    "      <span />",
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");

  const { removals, out } = sweepSource(src);
  assert.deepEqual(
    removals.map((r) => r.kind),
    ["HEADER", "RULER", "JSX"],
  );
  assert.ok(!out.includes("packages/widget/src/thing.ts"));
  assert.ok(!out.includes("Severity enum"));
  assert.ok(!out.includes("Scrim"));
  // The token-bearing ruler is kept.
  assert.ok(out.includes("// ---- kg -> bp (DESIGN-41 §14) ----"));
});

void test("sweepSource keeps a suffixed self-path header as a plain comment", () => {
  const { removals, out } = sweepSource(
    "// packages/campaign/src/x.ts - DESIGN-03 §3 + §8\nexport const A = 1;\n",
  );
  assert.equal(removals[0].kind, "HEADER-TRIM");
  assert.ok(out.startsWith("// DESIGN-03 §3 + §8\n"));
});

void test("sweepSource is idempotent", () => {
  const src = "// packages/x/src/y.ts\n// ---- helpers ----\nexport const A = 1;\n";
  const once = sweepSource(src).out;
  assert.equal(sweepSource(once).out, once);
});
