import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const adrIndex = require("../adr-index.cjs");
const repo = resolve(import.meta.dirname, "../..");

void test("one ADR assigned to two areas is reported with both area names", () => {
  const areas = [
    { name: "Process & documentation", nums: [220, 278] },
    { name: "Turns, interruptions & save/resume", nums: [278, 305] },
  ];
  assert.deepEqual(adrIndex.duplicateAreaAssignments(areas), [
    [278, ["Process & documentation", "Turns, interruptions & save/resume"]],
  ]);
});

void test("the committed area map gives every ADR exactly one area", () => {
  assert.deepEqual(adrIndex.duplicateAreaAssignments(adrIndex.AREAS), []);
});

void test("the generated index renders each ADR once", () => {
  const index = readFileSync(join(repo, "docs/adr/README.md"), "utf8");
  const rows = [...index.matchAll(/^\| (\d{4}) \|/gm)].map((m) => m[1]);
  assert.equal(new Set(rows).size, rows.length);
});
