import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  parseArguments,
  parseSections,
  renderList,
  renderSection,
  run,
  selectSections,
  SprintError,
} from "../sprint-show.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SAMPLE = [
  "# Plan",
  "",
  "intro",
  "",
  "## Frontier",
  "",
  "frontier body",
  "more frontier",
  "",
  "### Slice A",
  "",
  "slice body",
  "",
  "## Decisions",
  "",
  "decision body",
  "",
  "```md",
  "## Not a heading",
  "```",
  "",
].join("\n");

void test("sprint:show parses headings and ignores fenced blocks", () => {
  const sections = parseSections(SAMPLE);
  assert.deepEqual(
    sections.map((section) => [section.level, section.title, section.lineCount]),
    [
      [1, "Plan", 21],
      [2, "Frontier", 9],
      [3, "Slice A", 4],
      [2, "Decisions", 8],
    ],
  );
});

void test("sprint:show selects exact, prefix and containing titles", () => {
  const sections = parseSections(SAMPLE);
  assert.equal(selectSections(sections, "frontier").length, 1);
  assert.equal(selectSections(sections, "Front").length, 1);
  assert.equal(selectSections(sections, "## Frontier").length, 1);
  assert.equal(selectSections(sections, "decisions").length, 1);
});

void test("sprint:show reports ambiguous and unknown selectors", () => {
  const sections = parseSections(SAMPLE);
  assert.equal(selectSections(sections, "not a heading").length, 0);
  assert.equal(selectSections(sections, "s").length, 1);
  assert.equal(selectSections(sections, "e").length, 3);
});

void test("sprint:show caps a section and points at the rest", () => {
  const sections = parseSections(SAMPLE);
  const frontier = sections.find((section) => section.title === "Frontier");
  const rendered = renderSection(SAMPLE, frontier, 3);
  assert.match(rendered, /## Frontier/u);
  assert.match(rendered, /6 more lines; rerun with --max-lines/u);
});

void test("sprint:show lists the outline", () => {
  const rendered = renderList(parseSections(SAMPLE));
  assert.match(rendered, /^Plan \(21 lines\)/u);
  assert.match(rendered, /^  Frontier \(9 lines\)/mu);
});

void test("sprint:show parses its arguments", () => {
  assert.deepEqual(parseArguments(["--list"]), { list: true, maxLines: 120 });
  assert.deepEqual(parseArguments(["Phase", "0"]), {
    list: false,
    selector: "Phase 0",
    maxLines: 120,
  });
  assert.throws(
    () => parseArguments([]),
    (error) => error instanceof SprintError && error.code === 2,
  );
  assert.throws(
    () => parseArguments(["Frontier", "--max-lines", "0"]),
    (error) => error instanceof SprintError && error.code === 2,
  );
});

void test("sprint:show works on the real sprint plan", () => {
  assert.equal(run(["--list"], ROOT), 0);
  assert.equal(run(["Frontier"], ROOT), 0);
  assert.equal(run(["definitely-not-a-section"], ROOT), 4);
  assert.equal(run(["Phase"], ROOT), 3);
});

void test("sprint:show reports a missing plan", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-sprint-"));
  try {
    assert.equal(run(["--list"], dir), 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
