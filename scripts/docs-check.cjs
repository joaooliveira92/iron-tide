#!/usr/bin/env node
// Documentation hygiene gate: relative markdown links and anchors must resolve.
//
// Wired into `pnpm preflight`. Standalone: `node scripts/docs-check.cjs`.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const problems = [];
const warnings = [];

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function tracked(pattern) {
  return git(["ls-files", pattern]).split("\n").filter(Boolean);
}

// ---- 1. relative link integrity ----
// git pathspecs are recursive for `*.md`, so filter to the canonical scope:
// docs/**, the root markdown files, .ai/*.md, and every authored folder README
// (the repo map's entry points). Read-only subtrees (vendor/, repos/) are
// excluded. A relative target must exist; a `#fragment` onto a Markdown target
// (a same-file `#anchor` included) must name a real GitHub heading slug or
// explicit `<a id>`. Scheme-qualified, protocol-relative, and root-absolute
// targets are excluded; fenced code and HTML comments are not scanned.
const LINK_SCOPE = tracked("*.md").filter(
  (f) =>
    f.startsWith("docs/") ||
    !f.includes("/") ||
    /^\.ai\/[^/]+\.md$/.test(f) ||
    (/(^|\/)README\.md$/.test(f) && !f.startsWith("vendor/") && !f.startsWith("repos/")),
);

const { sanitizeForScan, documentAnchors } = require("./lib/doc-anchors.cjs");

const anchorCache = new Map();
function anchorsFor(absPath) {
  let anchors = anchorCache.get(absPath);
  if (!anchors) {
    anchors = documentAnchors(fs.readFileSync(absPath, "utf8"));
    anchorCache.set(absPath, anchors);
  }
  return anchors;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed escape names no real path/anchor
  }
}

const LINK_RE = /\]\(([^)]+)\)/g;
let linkCount = 0;
let anchorLinkCount = 0;
for (const file of LINK_SCOPE) {
  const abs = path.join(root, file);
  const dir = path.dirname(abs);
  const text = sanitizeForScan(fs.readFileSync(abs, "utf8"));
  for (const m of text.matchAll(LINK_RE)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("<") || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("/")) {
      continue;
    }
    const hashIdx = raw.indexOf("#");
    const target = (hashIdx === -1 ? raw : raw.slice(0, hashIdx)).trim();
    const fragment =
      hashIdx === -1 ? null : safeDecode(raw.slice(hashIdx + 1).replace(/\?.*$/, ""));
    const sameFile = target === "";
    if (!target.endsWith(".md") && !sameFile) continue;
    linkCount++;
    const resolved = sameFile ? abs : path.resolve(dir, safeDecode(target));
    if (!fs.existsSync(resolved)) {
      problems.push(`broken link: ${file} -> ${m[1]}`);
      continue;
    }
    if (fragment !== null && resolved.endsWith(".md")) {
      anchorLinkCount++;
      if (!anchorsFor(resolved).has(fragment)) {
        problems.push(
          `broken anchor: ${file} -> ${m[1]} (no heading "#${fragment}" in ` +
            `${path.relative(root, resolved)})`,
        );
      }
    }
  }
}

if (warnings.length) {
  console.warn("docs-check: warnings");
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (problems.length) {
  console.error("docs-check: FAILED\n");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`docs-check: ok (${linkCount} links, ${anchorLinkCount} anchored)`);
