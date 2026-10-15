// Tests for scripts/lib/doc-anchors.cjs — the Markdown anchor rules shared with
// docs-check.cjs. Covers every admitted/excluded form that changes the detection
// boundary (per scripts/AGENTS-style discipline: an untested gate is unproven).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  stripFencedCode,
  stripHtmlComments,
  stripInline,
  githubSlug,
  documentAnchors,
} = require("../lib/doc-anchors.cjs");

void test("githubSlug follows GitHub's rendered-heading algorithm", () => {
  assert.equal(githubSlug("Document Contract"), "document-contract");
  assert.equal(githubSlug("Showcase: web_fetch"), "showcase-web_fetch");
  assert.equal(githubSlug("Numeric & Temporal"), "numeric--temporal");
  assert.equal(githubSlug("A.B / C"), "ab--c");
});

void test("stripInline reduces links, code, emphasis, and tags to rendered text", () => {
  assert.equal(stripInline("**bold** and `code`"), "bold and code");
  assert.equal(stripInline("see [the docs](../x.md)"), "see the docs");
  assert.equal(stripInline("![alt](img.png)"), "alt");
  assert.equal(stripInline("plain <em>text</em>"), "plain text");
});

void test("documentAnchors recognises ATX headings and explicit <a id>", () => {
  const anchors = documentAnchors('# Title\n\n## Sub Section\n\n<a id="custom"></a>\n');
  assert.ok(anchors.has("title"));
  assert.ok(anchors.has("sub-section"));
  assert.ok(anchors.has("custom"));
});

void test("documentAnchors suffixes heading collisions GitHub-style", () => {
  const anchors = documentAnchors("# Repeat\n# Repeat\n# Repeat\n");
  assert.deepEqual(
    [...anchors].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    ["repeat", "repeat-1", "repeat-2"],
  );
});

void test("documentAnchors ignores headings and <a id> inside fenced code", () => {
  const anchors = documentAnchors('# Real\n\n```md\n# Not A Heading\n<a id="fake">\n```\n');
  assert.deepEqual([...anchors], ["real"]);
});

void test("documentAnchors ignores tildes fences and an indented fence", () => {
  assert.deepEqual([...documentAnchors("# Real\n~~~\n# Nope\n~~~\n")], ["real"]);
  assert.deepEqual([...documentAnchors("# Real\n  ```\n# Nope\n  ```\n")], ["real"]);
});

void test("documentAnchors ignores content inside HTML comments", () => {
  const anchors = documentAnchors('# Real\n<!-- <a id="fake"> -->\n');
  assert.deepEqual([...anchors], ["real"]);
});

void test("stripFencedCode requires the closing fence to repeat the opening char", () => {
  // A shorter backtick run does not close a longer opening fence.
  const out = stripFencedCode("# A\n````\n```\n# B\n````\n# C\n");
  assert.ok(!out.includes("# B"), "inner content stays blanked until the matching fence");
  assert.ok(out.includes("# C"), "a heading after the closing fence survives");
});

void test("stripHtmlComments removes multi-line comments", () => {
  assert.equal(stripHtmlComments("a <!-- x\ny --> b"), "a  b");
});
