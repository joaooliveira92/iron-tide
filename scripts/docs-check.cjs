#!/usr/bin/env node
// Documentation hygiene gate (ADR-0095).
//
// Six checks over the canonical docs, cheapest failures first:
//   1. relative markdown links resolve (docs/**, root *.md, .ai/*.md)   -> FAIL
//   2. docs/adr/README.md equals the generated index                     -> FAIL
//   3. every ADR has a valid `## Status` section                         -> FAIL
//   4. `Supersedes:` / `Superseded by:` links resolve and reciprocate    -> FAIL
//   5. deferred work in an ADR Status is listed in docs/DEFERRALS.md     -> FAIL
//   6. AMENDMENTS.md matches every DESIGN doc's `Amended by:` header     -> FAIL
//
// Wired into `pnpm preflight` (and therefore `pnpm dev` / `pnpm check`).
// Standalone: `node scripts/docs-check.cjs`.

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

// ---- 2. ADR index is exactly the generator's output ----
// The index is a build artefact of the ADR corpus (scripts/adr-index.cjs), so a
// drift in titles, status, or supersession shows up here rather than silently.
// Active ADRs live in docs/adr/; archived ones under docs/adr/archive/. Both are
// indexed and both feed every check below (status, supersession, deferrals,
// amendments), so an archived record is still fully validated.
const adrDirs = [
  { dir: "docs/adr", prefix: "" },
  { dir: "docs/adr/archive", prefix: "archive/" },
];
const adrFiles = adrDirs.flatMap(({ dir, prefix }) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => /^ADR-\d{4}-.*\.md$/.test(f))
    .map((f) => ({ f: `${dir}/${f}`, link: `${prefix}${f}`, n: f.match(/ADR-(\d{4})/)[1] }));
});
const adrNums = new Set(adrFiles.map((x) => x.n));
const adrText = new Map(adrFiles.map((x) => [x.n, fs.readFileSync(path.join(root, x.f), "utf8")]));
const readAdr = (n) => adrText.get(n);

// Compare with normalized line endings: the generator emits LF, but a Windows
// checkout (core.autocrlf) can present the committed file with CRLF, which would
// otherwise read as a spurious "stale" index (ADR-0107 cross-OS gate).
const normalizeEol = (s) => s.replace(/\r\n/g, "\n");
try {
  const { buildIndex, buildArchiveIndex } = require("./adr-index.cjs");
  const indexes = [
    { path: path.join(root, "docs/adr/README.md"), expected: buildIndex() },
    { path: path.join(root, "docs/adr/archive/README.md"), expected: buildArchiveIndex() },
  ];
  for (const { path: p, expected } of indexes) {
    const rel = path.relative(root, p);
    if (!fs.existsSync(p)) {
      problems.push(`${rel} is missing (run \`pnpm adr:index\`)`);
    } else if (normalizeEol(fs.readFileSync(p, "utf8")) !== normalizeEol(expected)) {
      problems.push(`${rel} is stale (run \`pnpm adr:index\`)`);
    }
  }
} catch (err) {
  problems.push(`ADR index could not be generated: ${err.message}`);
}

// ---- 3. ADR status sections ----
// Canonical status keyword: the first word of the `## Status` section body.
// The free-text note after it is unconstrained; the lead word is not.
const STATUS_OK = new Set(["accepted", "proposed", "deprecated", "superseded"]);
function adrStatus(text) {
  const m = text.match(/^## Status\s*\n+([^\n]+)/m);
  if (!m) return null;
  const kw = m[1].trim().match(/^([a-z]+)/i);
  return kw ? kw[1].toLowerCase() : null;
}
for (const { n } of adrFiles) {
  const kw = adrStatus(readAdr(n));
  if (kw === null) problems.push(`ADR-${n} has no "## Status" section`);
  else if (!STATUS_OK.has(kw))
    problems.push(`ADR-${n} status "${kw}" is not one of {${[...STATUS_OK].join(", ")}}`);
}

// ---- 4. supersession links resolve and reciprocate ----
const SUPERSEDES_RE = /^Supersedes:\s*(ADR-\d{4})/gm;
const SUPERSEDED_BY_RE = /^Superseded by:\s*(ADR-\d{4})/gm;
for (const { n } of adrFiles) {
  const text = readAdr(n);
  for (const m of text.matchAll(SUPERSEDES_RE)) {
    const target = m[1].slice(4);
    if (!adrNums.has(target)) {
      problems.push(`ADR-${n} has "Supersedes: ${m[1]}" but ${m[1]} does not exist`);
    } else if (!new RegExp(`^Superseded by:\\s*ADR-${n}\\b`, "m").test(readAdr(target))) {
      problems.push(`ADR-${n} supersedes ${m[1]}, which has no matching "Superseded by: ADR-${n}"`);
    }
  }
  for (const m of text.matchAll(SUPERSEDED_BY_RE)) {
    const target = m[1].slice(4);
    if (!adrNums.has(target)) {
      problems.push(`ADR-${n} has "Superseded by: ${m[1]}" but ${m[1]} does not exist`);
    } else if (!new RegExp(`^Supersedes:\\s*ADR-${n}\\b`, "m").test(readAdr(target))) {
      problems.push(
        `ADR-${n} is superseded by ${m[1]}, which has no matching "Supersedes: ADR-${n}"`,
      );
    }
  }
}

// ---- 5. deferred work is listed in the ledger ----
// An ADR whose Status flags a deferral must have a docs/DEFERRALS.md row, so
// mechanics-gated work cannot be recorded as deferred and then silently dropped.
const DEFERRAL_FLAG = /deferr|\bpending\b(?!-)/i;
const deferralsPath = path.join(root, "docs/DEFERRALS.md");
if (!fs.existsSync(deferralsPath)) {
  problems.push("docs/DEFERRALS.md is missing — deferred work has no ledger");
} else {
  const ledger = fs.readFileSync(deferralsPath, "utf8");
  const ledgerAdrs = new Set([...ledger.matchAll(/ADR-(\d{4})/g)].map((m) => m[1]));
  for (const n of ledgerAdrs)
    if (!adrNums.has(n))
      problems.push(`docs/DEFERRALS.md references ADR-${n}, which does not exist`);
  for (const { n } of adrFiles) {
    const body = readAdr(n).match(/^## Status\s*\n+([\s\S]*?)(?=\n## )/m);
    if (body && DEFERRAL_FLAG.test(body[1]) && !ledgerAdrs.has(n))
      problems.push(
        `ADR-${n} records a deferral in its Status but is absent from docs/DEFERRALS.md`,
      );
  }
}

// ---- 6. amendment classification + AMENDMENTS <-> DESIGN header sync ----
const amendPath = path.join(root, "docs/adr/AMENDMENTS.md");
if (!fs.existsSync(amendPath)) {
  problems.push("docs/adr/AMENDMENTS.md is missing — amendment classification cannot be checked");
} else {
  const amend = fs.readFileSync(amendPath, "utf8");
  const classified = new Set([...amend.matchAll(/ADR-(\d{4})/g)].map((m) => m[1]));
  for (const { n } of adrFiles) {
    if (classified.has(n)) continue;
    for (const d of new Set([...readAdr(n).matchAll(/DESIGN-(\d+)/g)].map((m) => m[1]))) {
      problems.push(
        `ADR-${n} references DESIGN-${d} but is classified in neither the Amendments nor ` +
          `the Scope/process section of docs/adr/AMENDMENTS.md`,
      );
      break;
    }
  }

  // AMENDMENTS.md Amendments table vs each DESIGN doc's `Amended by:` header.
  const table = new Map(); // "07" -> Set("0037")
  for (const m of amend.matchAll(/\|\s*`DESIGN-(\d+)`[^|]*\|([^|]*)\|/g)) {
    table.set(m[1].padStart(2, "0"), new Set([...m[2].matchAll(/ADR-(\d{4})/g)].map((x) => x[1])));
  }
  const docs = new Map(); // "07" -> { file, adrs:Set }
  for (const file of LINK_SCOPE.filter((f) => f.startsWith("docs/"))) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const id = text.match(/^> \*\*Stable document ID:\*\*\s*`DESIGN-(\d+)`/m);
    if (!id) continue;
    const amended = text.match(/^> \*\*Amended by:\*\*\s*(.+)$/m);
    if (!amended) continue;
    docs.set(id[1], {
      file,
      adrs: new Set([...amended[1].matchAll(/ADR-(\d{4})/g)].map((x) => x[1])),
    });
  }
  const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  for (const [num, adrs] of table) {
    const doc = docs.get(num);
    if (!doc) problems.push(`AMENDMENTS.md lists DESIGN-${num} but no such DESIGN doc exists`);
    else if (!eqSet(adrs, doc.adrs))
      problems.push(
        `AMENDMENTS.md DESIGN-${num} amenders ${[...adrs].map((a) => "ADR-" + a).join(", ")} ` +
          `!= ${doc.file} "Amended by:" header ${[...doc.adrs].map((a) => "ADR-" + a).join(", ")}`,
      );
  }
  for (const [num, doc] of docs) {
    if (!table.has(num))
      problems.push(
        `${doc.file} has an "Amended by:" header but DESIGN-${num} is not in the AMENDMENTS.md table`,
      );
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
console.log(
  `docs-check: ok (${linkCount} links, ${anchorLinkCount} anchored, ${adrFiles.length} ADRs indexed)`,
);
