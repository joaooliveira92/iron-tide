#!/usr/bin/env node
import { execFileSync } from "node:child_process";

import { isEntryPoint } from "./lib/paths.mjs";

export const REPO = "joaooliveira92/iron-tide";
export const INDEX_SLUG = "research-index";
export const KINDS = ["index", "values", "engineering", "process"];
export const STATUSES = ["active", "reference", "superseded"];
export const HEADER_WINDOW = 12;

const TITLE = /^([a-z0-9][a-z0-9-]*): (\S.*)$/u;
const HEADER_LINE = /^> \*\*Kind:\*\* (\S+) · \*\*Status:\*\* (\S+) · \*\*Refs:\*\* (.*)$/u;
const TLDR_LINE = /^> \*\*TL;DR:\*\* (\S.*)$/u;
const USAGE = "usage: pnpm research:index [--check | --write]";

export function parseNote(discussion) {
  const labels = (discussion.labels?.nodes ?? []).map((label) => label.name);
  const title = TITLE.exec(discussion.title);
  const head = discussion.body.split("\n").slice(0, HEADER_WINDOW);
  const header = head.map((line) => HEADER_LINE.exec(line)).find((match) => match !== null);
  const tldr = head.map((line) => TLDR_LINE.exec(line)).find((match) => match !== null);
  return {
    number: discussion.number,
    title: discussion.title,
    slug: title === null ? null : title[1],
    topic: title === null ? null : title[2],
    kind: header === undefined ? null : header[1],
    status: header === undefined ? null : header[2],
    refs: header === undefined ? null : header[3],
    tldr: tldr === undefined ? null : tldr[1],
    labels,
    body: discussion.body,
  };
}

export function validateNote(note) {
  const problems = [];
  const fail = (code, detail) => problems.push({ number: note.number, code, detail });
  if (note.slug === null) fail("bad-title", `title must be "<slug>: <topic>": ${note.title}`);
  if (note.kind === null) {
    fail("missing-header", "first lines need the Kind/Status/Refs and TL;DR block");
    return problems;
  }
  if (!KINDS.includes(note.kind)) fail("bad-kind", `${note.kind} not in ${KINDS.join("|")}`);
  if (!STATUSES.includes(note.status)) {
    fail("bad-status", `${note.status} not in ${STATUSES.join("|")}`);
  }
  if (note.tldr === null) fail("missing-tldr", "TL;DR line required");
  for (const label of [`research:${note.kind}`, `status:${note.status}`]) {
    if (!note.labels.includes(label)) fail("missing-label", `label ${label}`);
  }
  return problems;
}

export function validateNotes(notes) {
  const problems = notes.flatMap(validateNote);
  const seen = new Map();
  for (const note of notes) {
    if (note.slug === null) continue;
    if (seen.has(note.slug)) {
      problems.push({
        number: note.number,
        code: "duplicate-slug",
        detail: `${note.slug} also on #${seen.get(note.slug)}`,
      });
    }
    seen.set(note.slug, note.number);
  }
  if (!seen.has(INDEX_SLUG)) {
    problems.push({ number: 0, code: "missing-index", detail: `no note slugged ${INDEX_SLUG}` });
  }
  return problems;
}

const cell = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (note) => `[${note.slug}](https://github.com/${REPO}/discussions/${note.number})`;

const KIND_HEADING = {
  values: "Values: sources behind game numbers",
  engineering: "Engineering: decisions and inventories",
  process: "Process: agent and delivery audits",
};

export function renderIndex(notes) {
  const rows = (kind) =>
    notes
      .filter((note) => note.kind === kind && note.slug !== INDEX_SLUG)
      .toSorted((a, b) => a.slug.localeCompare(b.slug))
      .map(
        (note) =>
          `| ${link(note)} | ${note.status} | ${cell(note.tldr ?? "")} | ${cell(note.refs ?? "")} |`,
      );
  const sections = ["values", "engineering", "process"].flatMap((kind) => {
    const body = rows(kind);
    if (body.length === 0) return [];
    return [
      `## ${KIND_HEADING[kind]}`,
      "",
      "| Note | Status | TL;DR | Refs |",
      "| --- | --- | --- | --- |",
      ...body,
      "",
    ];
  });
  return [
    "# Research notes index",
    "",
    "> **Kind:** index · **Status:** active · **Refs:** none",
    "> **TL;DR:** Generated list of every Research note. Do not edit by hand; run `pnpm research:index --write`.",
    "",
    "Research notes and working documentation live here, not in the repository. Canonical authority stays local: `README.md`, `RULES.md`, `.ai/ENGINEERING-CONTRACT.md`, agent instructions, and generated gate artifacts.",
    "",
    "## Note contract",
    "",
    "- Title: `<slug>: <topic>`. The slug is the stable handle; grep for it.",
    "- First lines: `> **Kind:** values|engineering|process · **Status:** active|reference|superseded · **Refs:** #n, #m` then `> **TL;DR:** <one or two sentences>`.",
    "- Labels: `research:<kind>` and `status:<status>`, matching the header.",
    "- `active` means a decision or candidate values are still in play. `reference` is settled provenance. `superseded` names its successor in Refs.",
    '- Create: `gh discussion create --category Research --title "<slug>: <topic>" --body-file <note>`, then run `pnpm research:index --write`.',
    "",
    ...sections,
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

export function indexDrift(notes) {
  const index = notes.find((note) => note.slug === INDEX_SLUG);
  if (index === undefined) return [];
  return renderIndex(notes).trimEnd() === index.body.trimEnd()
    ? []
    : [{ number: index.number, code: "index-drift", detail: "run pnpm research:index --write" }];
}

const LIST_QUERY = `query($cursor:String){repository(owner:"joaooliveira92",name:"iron-tide"){discussions(first:100,after:$cursor){pageInfo{hasNextPage endCursor}nodes{id number title body category{name} labels(first:10){nodes{name}}}}}}`;

export function defaultFetch(run = execFileSync) {
  const nodes = [];
  let cursor = null;
  for (;;) {
    const args = ["api", "graphql", "-f", `query=${LIST_QUERY}`];
    if (cursor !== null) args.push("-f", `cursor=${cursor}`);
    const page = JSON.parse(run("gh", args, { encoding: "utf8" })).data.repository.discussions;
    nodes.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return nodes.filter((node) => node.category.name === "Research");
}

export function defaultWrite(discussion, body, run = execFileSync) {
  run(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      "query=mutation($id:ID!,$b:String!){updateDiscussion(input:{discussionId:$id,body:$b}){discussion{number}}}",
      "-f",
      `id=${discussion.id}`,
      "-f",
      `b=${body}`,
    ],
    { encoding: "utf8" },
  );
}

export function main(argv, { fetch = defaultFetch, write = defaultWrite, out = console.log } = {}) {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  if (
    argv.length !== flags.length ||
    flags.length > 1 ||
    flags.some((f) => !["--check", "--write"].includes(f))
  ) {
    console.error(USAGE);
    return 1;
  }
  const raw = fetch();
  const notes = raw.map(parseNote);
  const problems = validateNotes(notes);
  const mode = flags[0] ?? null;
  if (mode === "--write") {
    const hard = problems.filter((problem) => problem.code !== "missing-label");
    if (hard.length > 0) {
      for (const problem of hard) out(`#${problem.number} ${problem.code}: ${problem.detail}`);
      return 1;
    }
    const index = raw.find((node) => parseNote(node).slug === INDEX_SLUG);
    const body = renderIndex(notes);
    if (body.trimEnd() === index.body.trimEnd()) {
      out(`#${index.number} already current`);
      return 0;
    }
    write(index, body);
    out(`#${index.number} updated (${notes.length - 1} notes)`);
    return 0;
  }
  const all = [...problems, ...indexDrift(notes)];
  if (mode === "--check") {
    for (const problem of all) out(`#${problem.number} ${problem.code}: ${problem.detail}`);
    return all.length === 0 ? 0 : 1;
  }
  out(renderIndex(notes));
  return 0;
}

if (isEntryPoint(import.meta.url)) process.exitCode = main(process.argv.slice(2));
