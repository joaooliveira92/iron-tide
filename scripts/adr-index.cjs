#!/usr/bin/env node
// Generate docs/adr/README.md and docs/adr/archive/README.md from the ADR files
// themselves (ADR-0095).
//
// The indexes are build artefacts of the ADR corpus: titles come from each file's
// H1, the Status cell from its `## Status` lead keyword, and the Superseded-by
// cell from its `Superseded by:` line. docs-check fails when a committed index
// differs from this generator's output, so the two cannot drift.
//
// Active vs archived: ARCHIVED below names the records kept as historical
// provenance only. Archived files live under docs/adr/archive/ and are indexed in
// docs/adr/archive/README.md; active ADRs stay in docs/adr/ and are indexed in
// docs/adr/README.md. Every ADR is in exactly one place — a misfiled record (in
// ARCHIVED but still top-level, or vice versa) fails the generator, and therefore
// preflight, rather than landing unlisted.
//
// Curated input: the AREAS map below. Every ADR must be assigned to exactly one
// area; a new ADR without a home makes the generator (and therefore preflight)
// fail loudly rather than land unlisted.
//
// Regenerate: `pnpm adr:index`.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ADR_DIR = path.join(ROOT, "docs/adr");
const ARCHIVE_DIR = path.join(ADR_DIR, "archive");

// Closed vocabulary of index sections, in display order.
const AREAS = [
  {
    name: "Foundations",
    blurb: "Core engine geometry, determinism, persistence, and the compiler pipeline.",
    nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 32, 34, 35, 36, 37, 113, 122, 123, 124, 146],
  },
  {
    name: "Effect adoption",
    blurb:
      "Adopting and vendoring Effect v4: the validator/runtime idiom, the read-only agent reference, and the determinism demotion.",
    nums: [100, 101, 102, 103, 104, 105, 128, 155, 159],
  },
  {
    name: "Campaign & strategy",
    blurb: "Strategic layer: diplomacy, economy, fleet, officers, command screens, and time.",
    nums: [10, 11, 54, 60, 61, 62, 65, 68, 71, 75, 81, 86],
  },
  {
    name: "Combat",
    blurb:
      "Battle generation, tactical resolution, gunnery, torpedoes, mines, air, coastal defense, damage, weather.",
    nums: [
      12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 31, 33, 39, 40, 41, 42, 44, 46, 47, 48,
      49, 50, 51, 52, 53, 56, 72, 73, 93, 94, 97, 98, 112,
    ],
  },
  {
    name: "Ship design & construction",
    blurb: "Ship design, classification, construction, repair, and rebuild.",
    nums: [
      13, 63, 64, 66, 67, 70, 74, 76, 77, 78, 80, 83, 85, 88, 116, 129, 130, 131, 132, 135, 137,
      138, 154, 156, 157, 158, 160, 161, 163,
    ],
  },
  {
    name: "National content",
    blurb: "National naval profiles, the content pipeline, and AI procurement.",
    nums: [89, 90, 91, 92, 108, 109, 110, 111, 114, 117, 119, 143, 144, 145, 147],
  },
  {
    name: "Desktop & UI",
    blurb: "Electron boundary, renderer screens, UX, and presentation.",
    nums: [
      23, 24, 28, 29, 30, 38, 55, 57, 58, 59, 69, 79, 82, 84, 87, 115, 118, 120, 121, 125, 126, 127,
      133, 141, 142, 148, 149, 153, 162,
    ],
  },
  {
    name: "Process & documentation",
    blurb: "Repo process, docs/ADR authority, and release gates.",
    nums: [45, 95, 96, 99, 106, 107, 134, 136, 139, 140, 150, 151, 152, 164, 165],
  },
];

// Records kept as historical provenance only: moved to docs/adr/archive/ and
// listed in docs/adr/archive/README.md instead of the active index. Chosen per
// area by live-reference count (the current wave and governance anchors are
// protected), so the active index stays within each area's readable range while
// every decision is still on disk and searchable.
const ARCHIVED = new Set([
  2, 4, 5, 6, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 27, 28, 30, 31, 33, 34, 35, 39, 40,
  41, 42, 44, 45, 48, 49, 50, 51, 52, 53, 56, 58, 59, 63, 64, 68, 69, 72, 74, 76, 79, 80, 81, 82,
  84, 87, 90, 96, 97, 99, 108, 110, 111, 112, 115, 116, 117, 118, 120, 124, 125, 126, 127, 129, 130,
  131, 137, 138, 142,
]);

const STATUS_OK = new Set(["accepted", "proposed", "deprecated", "superseded"]);
const pad = (n) => String(n).padStart(4, "0");

function parseAdr(file, text) {
  const h1 = text.match(/^# (.*)$/m);
  if (!h1) throw new Error(`${file}: missing H1 title`);
  const sm = text.match(/^## Status\s*\n+([^\n]+)/m);
  if (!sm) throw new Error(`${file}: missing "## Status" section`);
  const kw = (sm[1].trim().match(/^([a-z]+)/i) || [])[1]?.toLowerCase();
  if (!STATUS_OK.has(kw)) throw new Error(`${file}: status "${kw ?? "?"}" is not canonical`);
  const sup = text.match(/^Superseded by:\s*(ADR-\d{4})/m);
  return {
    file,
    title: h1[1].replace(/^ADR-\d{4}:\s*/, ""),
    status: kw,
    supersededBy: sup ? sup[1] : null,
  };
}

function scanDir(dir, location) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^ADR-\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => ({
      n: Number(f.match(/ADR-(\d{4})/)[1]),
      location,
      ...parseAdr(f, fs.readFileSync(path.join(dir, f), "utf8")),
    }));
}

let cache = null;
function load() {
  if (cache) return cache;
  const records = [...scanDir(ADR_DIR, "active"), ...scanDir(ARCHIVE_DIR, "archived")];
  const adrs = new Map(records.map((r) => [r.n, r]));

  // Every ADR sits in exactly the location its ARCHIVED membership implies.
  for (const r of records) {
    const want = ARCHIVED.has(r.n) ? "archived" : "active";
    if (r.location !== want) {
      throw new Error(
        `ADR-${pad(r.n)} is in the ${r.location} set but ARCHIVED says it should be ${want} ` +
          `(move it under docs/adr/archive/ or fix ARCHIVED in scripts/adr-index.cjs)`,
      );
    }
  }

  // The area map must be a partition of the ADR set.
  const assigned = AREAS.flatMap((a) => a.nums);
  const missing = [...adrs.keys()].filter((n) => !assigned.includes(n));
  const extra = assigned.filter((n) => !adrs.has(n));
  if (missing.length || extra.length) {
    throw new Error(
      `scripts/adr-index.cjs AREAS map is not a partition of the ADRs ` +
        `(unassigned: ${missing.map(pad).join(", ") || "none"}; ` +
        `unknown: ${extra.map(pad).join(", ") || "none"})`,
    );
  }

  cache = { adrs, records };
  return cache;
}

function buildIndex() {
  const { adrs, records } = load();
  const archived = records.filter((r) => r.location === "archived");
  const max = Math.max(...adrs.keys());
  const out = [
    "# Architecture decision records",
    "",
    "One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the",
    `highest existing number + 1 (the next number is ADR-${pad(max + 1)}).`,
    "Refresh this table from each file's H1 when one is added or re-titled.",
    "(ADR-0043 was never written; the sequence intentionally continues at 0044.)",
    "See [DESIGN amendments](AMENDMENTS.md) for which ADRs amend which DESIGN doc.",
    "Work an ADR records as deferred is tracked in [DEFERRALS](../DEFERRALS.md).",
    "Older records kept as provenance are listed in [archive/README.md](archive/README.md).",
    "",
    "Rows are grouped by area; the Status and Superseded-by cells mirror each ADR's",
    "own `## Status` / `Superseded by:` lines (`pnpm preflight` fails when either",
    "drifts). Process-only records are kept together under Process & documentation.",
    "",
  ];

  for (const { name, blurb, nums } of AREAS) {
    const rows = nums.filter((n) => !ARCHIVED.has(n));
    out.push(
      `## ${name}`,
      "",
      blurb,
      "",
      "| # | File | Title | Status | Superseded by |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const n of rows) {
      const { file, title, status, supersededBy } = adrs.get(n);
      out.push(
        `| ${pad(n)} | [${file}](${file}) | ${title} | ${status} | ${supersededBy ?? "—"} |`,
      );
    }
    out.push("");
  }

  out.push(
    "## Archive",
    "",
    `${archived.length} records retained for provenance (older or absorbed decisions).`,
    "They stay on disk and searchable, but are not part of the active index; find",
    "them with titles and links in [archive/README.md](archive/README.md).",
    "",
  );

  return out.join("\n");
}

function buildArchiveIndex() {
  const { records } = load();
  const archived = records.filter((r) => r.location === "archived").sort((a, b) => a.n - b.n);
  const out = [
    "# Archived architecture decision records",
    "",
    "Historical ADRs kept for provenance. Each remains the decision of its time, but",
    "is no longer part of the active index; current decisions live in",
    "[../README.md](../README.md). Regenerate both indexes with `pnpm adr:index`.",
    "",
    "| # | File | Title | Status | Superseded by |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const { n, file, title, status, supersededBy } of archived) {
    out.push(`| ${pad(n)} | [${file}](${file}) | ${title} | ${status} | ${supersededBy ?? "—"} |`);
  }
  out.push("");
  return out.join("\n");
}

module.exports = { buildIndex, buildArchiveIndex };

if (require.main === module) {
  const mainTarget = path.join(ADR_DIR, "README.md");
  const archiveTarget = path.join(ARCHIVE_DIR, "README.md");
  fs.writeFileSync(mainTarget, buildIndex());
  fs.writeFileSync(archiveTarget, buildArchiveIndex());
  console.log(
    `adr-index: wrote ${path.relative(ROOT, mainTarget)} and ${path.relative(ROOT, archiveTarget)}`,
  );
}
