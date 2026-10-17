// U-5 ticket 06: the unavailable-artifact register and the golden new-baseline
// classification are checked by a test, not merely documented (ADR-0210).
//
// These are structural invariants over two repo artifacts, so no volatile value
// (hash, count, date) is hard-coded: a row is registered and classified, and the
// golden file carries its new-baseline provenance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..", "..");
const AUTHORITY_INDEX = resolve(ROOT, ".ai/AUTHORITY-INDEX.md");
const GOLDEN = resolve(ROOT, "golden/hashes.json");

/** The columns of the unavailable-artifact register table, in order. */
const REGISTER_COLUMNS = [
  "path",
  "citingDocument",
  "investigation",
  "classification",
  "everTracked",
  "purpose",
  "replacementAuthority",
  "reconstructionWork",
  "effectOnLaterSprints",
];

/** Extract the markdown table rows of the named `## ` section. */
function tableRows(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  assert.notEqual(start, -1, `section "## ${heading}" not found`);
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) break;
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$|^:?-+:?$/.test(cell))) continue; // separator
    rows.push(cells);
  }
  return rows;
}

void test("the unavailable-artifact register classifies every entry", () => {
  const markdown = readFileSync(AUTHORITY_INDEX, "utf8");
  const rows = tableRows(markdown, "Unavailable-artifact register");
  assert.ok(rows.length > 0, "the register has no rows (parse failure)");

  const [header, ...entries] = rows;
  assert.deepEqual(
    header.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, "")),
    REGISTER_COLUMNS.map((column) => column.toLowerCase()),
    "the register header changed shape",
  );
  assert.ok(entries.length >= 5, `expected a populated register, found ${entries.length}`);

  for (const entry of entries) {
    const path = entry[0];
    assert.ok(path && path.length > 0, "a register row has no path");
    assert.equal(entry.length, REGISTER_COLUMNS.length, `row "${path}" has the wrong column count`);

    const classification = entry[3].toLowerCase();
    assert.ok(classification.length > 0, `row "${path}" has no classification`);
    assert.ok(
      !/^(?:unknown|unclassified|tbd|none|—|-|n\/a)$/.test(classification),
      `row "${path}" is unclassified ("${entry[3]}")`,
    );
    assert.ok(
      !/recreat|invented|fabricat/.test(classification),
      `row "${path}" claims a recreated classification ("${entry[3]}")`,
    );

    const everTracked = entry[4].toLowerCase();
    assert.ok(
      everTracked === "yes" || everTracked === "no",
      `row "${path}" has an invalid Ever-tracked cell ("${entry[4]}")`,
    );
    assert.ok(entry[6].length > 0, `row "${path}" has no replacement authority`);
  }
});

void test("the register names the golden baseline as a new baseline", () => {
  const markdown = readFileSync(AUTHORITY_INDEX, "utf8");
  const rows = tableRows(markdown, "Unavailable-artifact register");
  const goldenRow = rows.find((entry) => entry[0].includes("golden/hashes.json"));
  assert.ok(goldenRow, "the golden baseline is not registered");
  assert.ok(
    /new baseline/i.test(goldenRow.join(" ")),
    "the golden register row does not state the new-baseline provenance",
  );
});

void test("golden/hashes.json is a successful reference run of valid digests", () => {
  // The new-baseline provenance is recorded in the register row (asserted above);
  // the golden file itself stays hash-only, so its value comparison gate is
  // untouched. This test checks that the file remains a complete, valid baseline.
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.equal(golden.success, true, "golden does not record a successful reference run");
  const hashKeys = Object.keys(golden).filter((key) => key !== "success");
  assert.ok(hashKeys.length > 0, "golden has no hash keys");
  for (const key of hashKeys) {
    assert.match(golden[key], /^[0-9a-f]{64}$/u, `golden.${key} is not a SHA-256 hex digest`);
  }
});
