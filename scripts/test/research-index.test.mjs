import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INDEX_SLUG,
  indexDrift,
  main,
  parseNote,
  renderIndex,
  validateNote,
  validateNotes,
} from "../research-index.mjs";

const header = (kind, status, tldr = "Short summary.") =>
  `# Heading\n\n> **Kind:** ${kind} · **Status:** ${status} · **Refs:** #1, #2\n> **TL;DR:** ${tldr}\n\nBody`;

const discussion = (number, slug, kind, status, extra = {}) => ({
  id: `D_${number}`,
  number,
  title: `${slug}: topic ${number}`,
  body: header(kind, status),
  labels: { nodes: [`research:${kind}`, `status:${status}`].map((name) => ({ name })) },
  ...extra,
});

const indexOf = (notes) => {
  const parsed = notes.map(parseNote);
  return {
    ...discussion(1, INDEX_SLUG, "index", "active"),
    body: renderIndex([...parsed, parseNote(discussion(1, INDEX_SLUG, "index", "active"))]),
  };
};

void test("a well-formed note parses and validates", () => {
  const note = parseNote(discussion(10, "alpha", "values", "reference"));
  assert.equal(note.slug, "alpha");
  assert.equal(note.kind, "values");
  assert.equal(note.refs, "#1, #2");
  assert.deepEqual(validateNote(note), []);
});

void test("a prose title is rejected", () => {
  const note = parseNote(discussion(11, "alpha", "values", "reference", { title: "Alpha notes" }));
  assert.deepEqual(
    validateNote(note).map((p) => p.code),
    ["bad-title"],
  );
});

void test("a missing header, unknown kind, missing TL;DR and missing label are each reported", () => {
  const bare = parseNote(discussion(12, "beta", "values", "reference", { body: "no header" }));
  assert.deepEqual(
    validateNote(bare).map((p) => p.code),
    ["missing-header"],
  );
  const odd = parseNote(
    discussion(13, "gamma", "weird", "reference", {
      body: "> **Kind:** weird · **Status:** reference · **Refs:** none\n",
      labels: { nodes: [] },
    }),
  );
  assert.deepEqual(
    validateNote(odd).map((p) => p.code),
    ["bad-kind", "missing-tldr", "missing-label", "missing-label"],
  );
});

void test("the header must sit within the first lines", () => {
  const late = parseNote(
    discussion(14, "delta", "values", "reference", {
      body: `${"filler\n".repeat(20)}> **Kind:** values · **Status:** reference · **Refs:** none\n> **TL;DR:** late\n`,
    }),
  );
  assert.deepEqual(
    validateNote(late).map((p) => p.code),
    ["missing-header"],
  );
});

void test("duplicate slugs and a missing index are reported", () => {
  const notes = [
    parseNote(discussion(20, "same", "values", "reference")),
    parseNote(discussion(21, "same", "values", "reference")),
  ];
  assert.deepEqual(
    validateNotes(notes).map((p) => p.code),
    ["duplicate-slug", "missing-index"],
  );
});

void test("the rendered index groups by kind, links by number and escapes pipes", () => {
  const notes = [
    parseNote(
      discussion(30, "zeta", "engineering", "active", {
        body: header("engineering", "active", "a | b"),
      }),
    ),
    parseNote(discussion(31, "alpha", "values", "reference")),
    parseNote(discussion(1, INDEX_SLUG, "index", "active")),
  ];
  const text = renderIndex(notes);
  assert.ok(text.includes("## Values: sources behind game numbers"));
  assert.ok(text.includes("## Engineering: decisions and inventories"));
  assert.ok(!text.includes("## Process"));
  assert.ok(text.includes("[alpha](https://github.com/joaooliveira92/iron-tide/discussions/31)"));
  assert.ok(text.includes("a \\| b"));
  assert.ok(text.indexOf("Values") < text.indexOf("Engineering"));
});

void test("drift is reported until the index body matches the render", () => {
  const raw = [discussion(40, "alpha", "values", "reference")];
  const stale = [...raw, discussion(1, INDEX_SLUG, "index", "active")];
  assert.deepEqual(
    indexDrift(stale.map(parseNote)).map((p) => p.code),
    ["index-drift"],
  );
  const fresh = [...raw, indexOf(raw)];
  assert.deepEqual(indexDrift(fresh.map(parseNote)), []);
});

void test("--check exits non-zero on drift and zero when current", () => {
  const raw = [discussion(50, "alpha", "values", "reference")];
  const lines = [];
  const stale = main(["--check"], {
    fetch: () => [...raw, discussion(1, INDEX_SLUG, "index", "active")],
    out: (line) => lines.push(line),
  });
  assert.equal(stale, 1);
  assert.ok(lines.some((line) => line.includes("index-drift")));
  assert.equal(main(["--check"], { fetch: () => [...raw, indexOf(raw)], out: () => {} }), 0);
});

void test("--write updates only the index and is idempotent", () => {
  const raw = [discussion(60, "alpha", "values", "reference")];
  const writes = [];
  const store = [...raw, discussion(1, INDEX_SLUG, "index", "active")];
  const run = () =>
    main(["--write"], {
      fetch: () => store,
      write: (target, body) => {
        writes.push(target.number);
        store[store.length - 1] = { ...target, body };
      },
      out: () => {},
    });
  assert.equal(run(), 0);
  assert.equal(run(), 0);
  assert.deepEqual(writes, [1]);
});

void test("--write refuses to publish while a note is malformed", () => {
  const store = [
    discussion(70, "alpha", "values", "reference", { title: "prose title" }),
    discussion(1, INDEX_SLUG, "index", "active"),
  ];
  let wrote = false;
  const code = main(["--write"], {
    fetch: () => store,
    write: () => {
      wrote = true;
    },
    out: () => {},
  });
  assert.equal(code, 1);
  assert.equal(wrote, false);
});

void test("unknown flags print usage and fail", () => {
  assert.equal(main(["--bogus"], { fetch: () => [], out: () => {} }), 1);
});
