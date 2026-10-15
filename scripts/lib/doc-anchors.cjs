"use strict";
// GitHub-rendered Markdown anchors, shared by `docs-check.cjs` and its tests.
//
// Scope boundary (deliberate, and covered by scripts/test/doc-anchors.test.mjs):
// ATX headings (`# …`) and explicit `<a id="…">` are recognised; Setext headings
// are NOT (this corpus is all-ATX, and frontmatter uses `---`). Fenced code and
// HTML comments are excluded from both heading and anchor extraction. Heading
// text is slugged after inline Markdown (links, code, emphasis, tags) is removed,
// because GitHub slugs the RENDERED heading.

// Replace fenced code blocks (` ``` ` or `~~~`, indented up to 3 spaces) with
// blank lines, so a sample never registers a heading, anchor, or link. A closing
// fence must repeat the opening character and be at least as long.
function stripFencedCode(text) {
  const lines = text.split("\n");
  let fence = null; // { char, len } while inside a fence
  const out = [];
  for (const line of lines) {
    const m = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
    if (fence === null) {
      if (m) {
        fence = { char: m[2][0], len: m[2].length };
        out.push("");
      } else {
        out.push(line);
      }
      continue;
    }
    if (m && m[2][0] === fence.char && m[2].length >= fence.len) fence = null;
    out.push("");
  }
  return out.join("\n");
}

// Remove HTML comments (which may span lines) so an `<a id>` or link inside one
// registers nothing.
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

// Fenced code and comments removed, for link and anchor scanning.
function sanitizeForScan(text) {
  return stripHtmlComments(stripFencedCode(text));
}

// Strip inline Markdown from a heading so its RENDERED text is slugged. `_` is
// NOT stripped: unlike `*`/`~` it is a common identifier character (`web_fetch`,
// `processEnv`) and GitHub only treats it as an emphasis delimiter around a word.
function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/[*~]/g, "");
}

// GitHub's heading-slug algorithm (from the rendered text): lowercase; drop
// everything but letters, numbers, underscores, spaces, hyphens; spaces → hyphens.
function githubSlug(text) {
  return stripInline(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .replace(/ /g, "-");
}

// Every fragment a document exposes: heading slugs (with GitHub's -1/-2 collision
// suffixes) plus explicit `<a id="…">` anchors in real HTML flow.
function documentAnchors(text) {
  const src = sanitizeForScan(text);
  const anchors = new Set();
  const seen = new Map();
  for (const m of src.matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)) {
    const base = githubSlug(m[1]);
    if (base === "") continue;
    let result = base;
    let bump = seen.get(base) ?? 0;
    while (anchors.has(result)) {
      bump += 1;
      result = `${base}-${bump}`;
    }
    seen.set(base, bump);
    anchors.add(result);
  }
  for (const m of src.matchAll(/<a id="([^"]+)"/g)) anchors.add(m[1]);
  return anchors;
}

module.exports = {
  stripFencedCode,
  stripHtmlComments,
  sanitizeForScan,
  stripInline,
  githubSlug,
  documentAnchors,
};
