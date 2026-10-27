"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY = "repository";
const CONTENT = "content";
const SCOPE_DIR = "docs/adr/by-scope";
const REF = /ADR-(\d{4})/g;

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => entry.name)
    .sort();
}

function scopeUniverse(root) {
  return [
    ...listDirs(path.join(root, "packages")),
    ...listDirs(path.join(root, "apps")),
    CONTENT,
    REPOSITORY,
  ];
}

function governingDoc(scope) {
  if (scope === REPOSITORY) return "AGENTS.md";
  if (scope === CONTENT) return "content/AGENTS.md";
  return null;
}

function governingDocPath(root, scope) {
  const fixed = governingDoc(scope);
  if (fixed) return fixed;
  return fs.existsSync(path.join(root, "apps", scope)) &&
    !fs.existsSync(path.join(root, "packages", scope))
    ? `apps/${scope}/AGENTS.md`
    : `packages/${scope}/AGENTS.md`;
}

function scopePage(scope) {
  return `${SCOPE_DIR}/${scope}.md`;
}

function refs(text) {
  return [...text.matchAll(REF)].map((m) => m[1]);
}

const LABELS = ["Supersedes", "Superseded by", "Amends", "Amended by"];

function sentenceHead(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "." && depth === 0 && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      return text.slice(0, i);
    }
  }
  return text;
}

function lineRefs(text, label) {
  const found = [];
  const split = new RegExp(`\\.\\s+(?=(?:${LABELS.join("|")}):)`);
  for (const line of text.split("\n")) {
    for (const piece of line.split(split)) {
      if (piece.startsWith(`${label}:`)) {
        found.push(...refs(sentenceHead(piece.slice(label.length + 1))));
      }
    }
  }
  return found;
}

function parseRecord(file, location, text) {
  const title = (text.match(/^# (.*)$/m) || [])[1] ?? file;
  const status = ((text.match(/^## Status\s*\n+([^\n]+)/m) || [])[1] ?? "").trim();
  const appliesLine = (text.match(/^Applies to:\s*(.*)$/m) || [])[1];
  const rule = (text.match(/^Rule:\s*(.*)$/m) || [])[1];
  return {
    file,
    location,
    number: file.slice(4, 8),
    title: title.replace(/^ADR-\d{4}:\s*/, ""),
    status: (status.match(/^([a-z]+)/i) || [])[1]?.toLowerCase() ?? "",
    appliesTo: appliesLine === undefined ? null : appliesLine.split(",").map((s) => s.trim()),
    rule: rule ?? null,
    supersedes: lineRefs(text, "Supersedes"),
    supersededBy: lineRefs(text, "Superseded by"),
    amends: lineRefs(text, "Amends"),
    amendedBy: lineRefs(text, "Amended by"),
  };
}

function loadRecords(root) {
  const read = (dir, location) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => /^ADR-\d{4}-.*\.md$/.test(f))
          .sort()
          .map((f) => parseRecord(f, location, fs.readFileSync(path.join(dir, f), "utf8")))
      : [];
  return [
    ...read(path.join(root, "docs/adr"), "active"),
    ...read(path.join(root, "docs/adr/archive"), "archived"),
  ];
}

function loadGoverningDocs(root, universe) {
  const docs = new Map();
  for (const scope of universe) {
    const rel = governingDocPath(root, scope);
    const abs = path.join(root, rel);
    docs.set(scope, { rel, text: fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null });
  }
  return docs;
}

function isCurrent(record) {
  return record.location === "active" && record.status !== "superseded";
}

function byNumber(records) {
  const map = new Map();
  for (const r of records) map.set(r.number, [...(map.get(r.number) ?? []), r]);
  return map;
}

function validateRecords(records, universe) {
  const problems = [];
  const numbers = byNumber(records);
  const known = new Set(universe);
  for (const [number, group] of numbers) {
    if (group.length > 1) {
      problems.push(
        `ADR-${number} is used by ${group.length} files: ${group.map((r) => r.file).join(", ")}`,
      );
    }
  }
  for (const r of records) {
    const id = r.file;
    if (r.appliesTo === null) {
      problems.push(`${id}: missing "Applies to:" line`);
      continue;
    }
    if (r.appliesTo.some((s) => s === "")) problems.push(`${id}: empty entry in "Applies to:"`);
    for (const scope of r.appliesTo) {
      if (scope !== "" && !known.has(scope)) {
        problems.push(`${id}: unknown scope "${scope}" in "Applies to:"`);
      }
    }
    if (r.appliesTo.includes(REPOSITORY) && r.appliesTo.length > 1) {
      problems.push(`${id}: "repository" must stand alone in "Applies to:"`);
    }
    if (new Set(r.appliesTo).size !== r.appliesTo.length) {
      problems.push(`${id}: duplicate scope in "Applies to:"`);
    }
    if (r.status === "superseded" && r.rule !== null) {
      problems.push(`${id}: superseded record must not carry a "Rule:" line`);
    }
    if (r.status === "superseded" && r.supersededBy.length === 0) {
      problems.push(`${id}: superseded but has no "Superseded by:" reference`);
    }
    if (r.status !== "superseded" && r.supersededBy.length > 0) {
      problems.push(`${id}: has "Superseded by:" but status is "${r.status}"`);
    }
    const relations = [
      ["Supersedes", r.supersedes, "supersededBy"],
      ["Superseded by", r.supersededBy, "supersedes"],
      ["Amends", r.amends, "amendedBy"],
      ["Amended by", r.amendedBy, "amends"],
    ];
    for (const [label, targets, inverse] of relations) {
      for (const target of targets) {
        const group = numbers.get(target);
        if (!group) {
          problems.push(`${id}: "${label}: ADR-${target}" does not exist`);
        } else if (group.length > 1) {
          problems.push(`${id}: "${label}: ADR-${target}" is ambiguous (duplicate number)`);
        } else if (!group[0][inverse].includes(r.number)) {
          problems.push(`${id}: "${label}: ADR-${target}" is not reciprocated by ${group[0].file}`);
        }
      }
    }
  }
  return problems;
}

function validateGoverningDocs(root, records, docs, exemptScopes) {
  const problems = [];
  const numbers = byNumber(records);
  for (const [scope, { rel, text }] of docs) {
    const mapped = records.filter((r) => r.appliesTo?.includes(scope));
    if (text === null) {
      if (mapped.length === 0 && exemptScopes.has(scope)) continue;
      problems.push(
        `${rel}: missing, but ${mapped.length} ADR(s) apply to "${scope}"` +
          (mapped.length === 0 ? " (list it as exempt if none ever will)" : ""),
      );
      continue;
    }
    if (exemptScopes.has(scope) && mapped.length === 0) continue;
    const link = path.posix.relative(path.posix.dirname(rel), scopePage(scope));
    if (!text.includes(`](${link})`)) {
      problems.push(`${rel}: must link its generated ADR index (${link})`);
    }
    for (const line of text.split("\n")) {
      for (const number of new Set(refs(line))) {
        const group = numbers.get(number);
        if (!group) {
          problems.push(`${rel}: cites ADR-${number}, which does not exist`);
          continue;
        }
        for (const r of group) {
          if (
            scope !== REPOSITORY &&
            r.appliesTo &&
            !r.appliesTo.includes(scope) &&
            !r.appliesTo.includes(REPOSITORY)
          ) {
            problems.push(`${rel}: cites ${r.file}, whose "Applies to:" omits "${scope}"`);
          }
          if (r.location === "archived" || r.status === "superseded") {
            const replacements = r.supersededBy;
            if (replacements.length === 0 || !replacements.every((n) => refs(line).includes(n))) {
              problems.push(
                `${rel}: cites ${r.status === "superseded" ? "superseded" : "archived"} ${r.file} without its replacement on the same line`,
              );
            }
          }
        }
      }
    }
  }
  return problems;
}

function rowFor(record, byNum) {
  const rule = record.rule ?? record.title;
  const amended = record.amendedBy.map((n) => `ADR-${n}`);
  const note = amended.length ? ` (amended by ${amended.join(", ")})` : "";
  const amends = record.amends.length
    ? ` Amends ${record.amends.map((n) => `ADR-${n}`).join(", ")}.`
    : "";
  void byNum;
  return `- [ADR-${record.number}](../${record.file}) ${rule}${note}.${amends}`.replace(
    /\.\.$/,
    ".",
  );
}

function buildScopePage(scope, records) {
  const mapped = records.filter((r) => r.appliesTo?.includes(scope));
  const current = mapped.filter(isCurrent);
  const superseded = mapped.filter((r) => !isCurrent(r));
  const out = [
    `# ADRs governing ${scope}`,
    "",
    "Generated by `pnpm adr:index`; edit the ADRs, not this page. Each line is the",
    "ADR's `Rule:` line when it has one, otherwise its title. Open the ADR for context",
    "and for the exact boundaries of the rule.",
    "",
  ];
  if (scope !== REPOSITORY) {
    out.push(`Repository-wide ADRs apply here too: [${REPOSITORY}.md](${REPOSITORY}.md).`, "");
  }
  out.push("## Current", "");
  if (current.length === 0) out.push("None.");
  for (const r of current) out.push(rowFor(r));
  out.push("");
  if (superseded.length) {
    out.push("## Superseded (do not follow)", "");
    for (const r of superseded) {
      const by = r.supersededBy.map((n) => `ADR-${n}`).join(", ");
      out.push(`- [ADR-${r.number}](../${r.file}) ${r.title}. Follow ${by || "its replacement"}.`);
    }
    out.push("");
  }
  return out.join("\n");
}

function buildScopePages(root) {
  const records = loadRecords(root);
  const pages = new Map();
  for (const scope of scopeUniverse(root)) {
    pages.set(scopePage(scope), buildScopePage(scope, records));
  }
  return pages;
}

function validateScopePages(root, records) {
  const problems = [];
  const expected = buildScopePages(root);
  for (const [rel, text] of expected) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) problems.push(`${rel} is missing (run \`pnpm adr:index\`)`);
    else if (fs.readFileSync(abs, "utf8") !== text)
      problems.push(`${rel} is stale (run \`pnpm adr:index\`)`);
  }
  const dir = path.join(root, SCOPE_DIR);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!expected.has(`${SCOPE_DIR}/${f}`))
        problems.push(`${SCOPE_DIR}/${f} has no matching scope (delete it)`);
    }
  }
  void records;
  return problems;
}

function verify(root, exemptScopes) {
  const universe = scopeUniverse(root);
  const records = loadRecords(root);
  const docs = loadGoverningDocs(root, universe);
  return [
    ...validateRecords(records, universe),
    ...validateGoverningDocs(root, records, docs, exemptScopes),
    ...validateScopePages(root, records),
  ];
}

function writeScopePages(root) {
  const pages = buildScopePages(root);
  const dir = path.join(root, SCOPE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  for (const [rel, text] of pages) fs.writeFileSync(path.join(root, rel), text);
  return [...pages.keys()];
}

module.exports = {
  buildScopePage,
  buildScopePages,
  governingDocPath,
  loadGoverningDocs,
  loadRecords,
  parseRecord,
  scopePage,
  scopeUniverse,
  validateGoverningDocs,
  validateRecords,
  verify,
  writeScopePages,
};
