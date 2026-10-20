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
// Re-baselined corpus: DR-001..DR-011 recorded as ADR-0201..ADR-0211 (see
// .ai/AUTHORITY-INDEX.md). Records referenced below 0201 are unavailable and
// unverified legacy references and are deliberately not indexed here.
const AREAS = [
  {
    name: "Scope & horizon",
    blurb: "The sole 1880 start, the 1939 authored horizon, and the ten-nation roster.",
    nums: [201, 204, 205, 214],
  },
  {
    name: "Values, currency & language",
    blurb:
      "Canonical values and the presentation-only units, currency, and language modes over them.",
    nums: [202, 206, 207, 208, 209, 211, 215, 216, 217, 218, 219, 221],
  },
  {
    name: "Preferences & interfaces",
    blurb: "The versioned preferences domain behind the Options screen.",
    nums: [203],
  },
  {
    name: "Repository authority & re-baselining",
    blurb: "Unavailable-artifact policy and the project authority order.",
    nums: [210],
  },
  {
    name: "Process & documentation",
    blurb: "Concurrent-agent worktree coordination and repository process rules.",
    nums: [220, 227, 234, 236, 237, 238],
  },
  {
    name: "Scenario content & research",
    blurb:
      "Legality, consistency and authored posture of the 1880 scenario's starting content and research state.",
    nums: [212, 213, 228, 229],
  },
  {
    name: "Campaign economy",
    blurb:
      "The monthly appropriation, ledger, research, deficit policy and construction capacity as one model.",
    nums: [230, 240],
  },
  {
    name: "Turns, interruptions & save/resume",
    blurb: "Turn identity and the suspend/resume interruption model.",
    nums: [222, 235],
  },
  {
    name: "Fleet readiness, command & prestige",
    blurb:
      "Readiness and maintenance ruleset constants, the 1880 command structure, and the prestige value path.",
    nums: [223, 224, 225, 226, 239],
  },
  {
    name: "Foreign stations & presence",
    blurb:
      "The authoritative home area and possession ownership behind per-area presence, the foreign-station assignment state, and the colonial-service fitting with its dormant ruleset section.",
    nums: [231, 241, 242],
  },
  {
    name: "Ship design & construction",
    blurb:
      "The ship-designer model, its armour regions, named schemes, and the design draft schema.",
    nums: [232, 233, 243],
  },
];

// Records kept as historical provenance only: moved to docs/adr/archive/ and
// listed in docs/adr/archive/README.md instead of the active index. The
// re-baselined corpus archives nothing, so the set is empty.
const ARCHIVED = new Set([]);

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

  // The area map must be a partition of the ADR set — but an empty corpus is
  // valid (no sprint started, no ADRs written yet). The roster is only enforced
  // once at least one ADR exists, so a fresh checkout with zero ADRs is green.
  const assigned = AREAS.flatMap((a) => a.nums);
  const missing = [...adrs.keys()].filter((n) => !assigned.includes(n));
  const extra = adrs.size > 0 ? assigned.filter((n) => !adrs.has(n)) : [];
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
  const max = adrs.size > 0 ? Math.max(...adrs.keys()) : 0;
  const out = [
    "# Architecture decision records",
    "",
    "One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the",
    `highest existing number + 1 (the next number is ADR-${pad(max + 1)}).`,
    "Refresh this table from each file's H1 when one is added or re-titled.",
    "Records numbered below 0201 are unavailable and unverified legacy references;",
    "see the [authority index](../../.ai/AUTHORITY-INDEX.md).",
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
      const rec = adrs.get(n);
      if (!rec) continue;
      const { file, title, status, supersededBy } = rec;
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
