import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { EXIT } from "../sweep-comments-engine.mjs";
import { keepReason, runCli, stripSource } from "../strip-comments.mjs";

const strip = (src, rel = "a.ts") => stripSource(rel, src);

void test("removes line, trailing, block, and doc comments", () => {
  const src = [
    "// header",
    "import x from 'y'; // trailing",
    "",
    "/** doc */",
    "export const a = 1; /* inline */",
    "const b = /* mid */ 2;",
    "",
  ].join("\n");
  const r = strip(src);
  assert.equal(r.status, "stripped");
  assert.equal(r.removed, 5);
  assert.equal(r.out, "import x from 'y';\n\nexport const a = 1;\nconst b = 2;\n");
});

void test("never touches comment-like text inside strings, templates, and regexes", () => {
  const src =
    'const s = "// not"; const t = `/* no */ ${1} // still no`; const r = /\\/\\//; // real\n';
  const r = strip(src);
  assert.equal(r.removed, 1);
  assert.equal(
    r.out,
    'const s = "// not"; const t = `/* no */ ${1} // still no`; const r = /\\/\\//;\n',
  );
});

void test("keeps the comments a tool reads", () => {
  const kept = [
    "// @ts-expect-error reason",
    "// eslint-disable-next-line no-console",
    "/* oxlint-disable foo */",
    "/// <reference types='vite/client' />",
    "/** @license MIT */",
    "/*! banner */",
    "/** @deprecated use b */",
    "/** @vitest-environment jsdom */",
    "// biome-ignore lint: x",
    "// istanbul ignore next",
    "// test-focus-allow-skip: Electron optional outside e2e",
  ];
  for (const text of kept)
    assert.ok(
      keepReason({
        type: text.startsWith("//") ? "Line" : "Block",
        value: text.replace(/^\/\/|^\/\*|\*\/$/g, ""),
      }),
      text,
    );
  const src = `${kept.slice(0, 3).join("\nconst a = 1;\n")}\nconst z = 1;\n// prose\n`;
  const r = strip(src);
  assert.equal(r.removed, 1);
  assert.equal(r.out.includes("prose"), false);
  assert.equal(r.out.includes("@ts-expect-error"), true);
});

void test("a file with only kept comments is clean", () => {
  const r = strip("// @ts-expect-error x\nconst a: number = 's';\n");
  assert.equal(r.status, "clean");
  assert.equal(r.removed, 0);
});

void test("removes a comment-only JSX container whole, and degrades to {} when rendering would change", () => {
  const src = [
    "export const A = () => (",
    "  <div>",
    "    {/* gone */}",
    "    <b />",
    "    hello",
    "    {/* between */}",
    "    world",
    "  </div>",
    ");",
    "",
  ].join("\n");
  const r = strip(src, "a.tsx");
  assert.equal(r.removed, 2);
  assert.equal(r.retained, 0);
  assert.equal(
    r.out,
    [
      "export const A = () => (",
      "  <div>",
      "    <b />",
      "    hello",
      "    {}",
      "    world",
      "  </div>",
      ");",
      "",
    ].join("\n"),
  );
});

void test("a removal that changes meaning is retained, not applied", () => {
  const src = "function f() {\n  return /*\n  */ 42;\n}\n// prose\n";
  const r = strip(src);
  assert.equal(r.retained, 1);
  assert.equal(r.removed, 1);
  assert.equal(r.out, "function f() {\n  return /*\n  */ 42;\n}\n");
});

void test("a block comment between two word tokens keeps them apart", () => {
  assert.equal(strip("const a = typeof/**/x;\n").out, "const a = typeof x;\n");
});

void test("offsets stay correct after non-ASCII text", () => {
  assert.equal(
    strip('const é = "é"; /* après */ const k = 1;\n').out,
    'const é = "é"; const k = 1;\n',
  );
});

void test("blank lines are not doubled and file starts are not left blank", () => {
  assert.equal(
    strip("// a\n\nconst x = 1;\n\n// b\n\nconst y = 2;\n").out,
    "const x = 1;\n\nconst y = 2;\n",
  );
  assert.equal(
    strip("function f() {\n  // only\n  return 1;\n}\n").out,
    "function f() {\n  return 1;\n}\n",
  );
});

void test("CRLF endings and a missing final newline survive", () => {
  assert.equal(
    strip("// c\r\nconst a = 1;\r\n// d\r\nconst b = 2;").out,
    "const a = 1;\r\nconst b = 2;",
  );
  assert.equal(strip("const a = 1;\n// last, no newline").out, "const a = 1;");
});

void test("stripping is idempotent and the second pass removes nothing", () => {
  const once = strip("// a\nconst x = 1; /* b */\n/** c */\nexport const y = 2;\n");
  const twice = strip(once.out);
  assert.equal(twice.removed, 0);
  assert.equal(twice.out, once.out);
});

void test("an unparsable file fails closed", () => {
  const r = strip("const = ;\n// c\n");
  assert.equal(r.status, "unparsable");
  assert.equal(r.out, "const = ;\n// c\n");
});

function makeRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "strip-test-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const snapshot = (root) => {
  const out = {};
  const walk = (d) => {
    for (const n of readdirSync(d).toSorted()) {
      const f = path.join(d, n);
      if (nodeFs.lstatSync(f).isSymbolicLink()) out[path.relative(root, f)] = "link";
      else if (nodeFs.lstatSync(f).isDirectory()) walk(f);
      else out[path.relative(root, f)] = createHash("sha256").update(readFileSync(f)).digest("hex");
    }
  };
  walk(root);
  return out;
};
const run = (root, argv, fs) => {
  const io = { err: "" };
  const code = runCli(argv, {
    repoRoot: root,
    stderr: (s) => (io.err += s),
    ...(fs ? { fs } : {}),
  });
  return { code, ...io };
};
const FILES = {
  "packages/p/src/a.ts": "// a\nexport const a = 1;\n",
  "packages/p/src/b.tsx": "export const B = () => <i />; // b\n",
  "packages/p/src/keep.ts": "// @ts-expect-error x\nexport const k: number = 's';\n",
  "packages/p/dist/skip.ts": "// skip\nexport const s = 1;\n",
  "packages/p/src/generated/g.ts": "// gen\nexport const g = 1;\n",
  "packages/p/src/tool.mjs": "// js comment\nexport const m = 1;\n",
};

void test("dry run reports without writing, deterministically", () => {
  const root = makeRepo(FILES);
  const rep = path.join(tmpdir(), `strip-rep-${String(process.pid)}`);
  try {
    const before = snapshot(root);
    const a = run(root, ["--scope", "packages", "--report", `${rep}-1.json`]);
    const b = run(root, ["--scope", "packages", "--report", `${rep}-2.json`]);
    assert.equal(a.code, EXIT.OK);
    assert.equal(b.code, EXIT.OK);
    assert.deepEqual(snapshot(root), before);
    assert.equal(readFileSync(`${rep}-1.json`, "utf8"), readFileSync(`${rep}-2.json`, "utf8"));
    const report = JSON.parse(readFileSync(`${rep}-1.json`, "utf8"));
    assert.equal(report.totals.files, 3);
    assert.equal(report.totals.removed, 2);
    assert.deepEqual(report.totals.kept, { "ts-directive": 1 });
    assert.match(a.err, /would remove 2 comment\(s\) in 2 of 3 file\(s\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const n of ["1", "2"]) rmSync(`${rep}-${n}.json`, { force: true });
  }
});

void test("--apply strips only .ts and .tsx outside skipped trees, and --check then passes", () => {
  const root = makeRepo(FILES);
  try {
    assert.equal(run(root, ["--scope", "packages", "--check"]).code, EXIT.VALIDATION);
    assert.equal(run(root, ["--scope", "packages", "--apply"]).code, EXIT.OK);
    const read = (rel) => readFileSync(path.join(root, rel), "utf8");
    assert.equal(read("packages/p/src/a.ts"), "export const a = 1;\n");
    assert.equal(read("packages/p/src/b.tsx"), "export const B = () => <i />;\n");
    assert.equal(read("packages/p/src/keep.ts"), FILES["packages/p/src/keep.ts"]);
    for (const untouched of [
      "packages/p/dist/skip.ts",
      "packages/p/src/generated/g.ts",
      "packages/p/src/tool.mjs",
    ])
      assert.equal(read(untouched), FILES[untouched]);
    assert.equal(run(root, ["--scope", "packages", "--check"]).code, EXIT.OK);
    assert.equal(run(root, ["--scope", "packages", "--apply"]).code, EXIT.OK);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("any unparsable file blocks every write", () => {
  const root = makeRepo({ ...FILES, "packages/p/src/bad.ts": "const = ;\n" });
  try {
    const before = snapshot(root);
    const r = run(root, ["--scope", "packages", "--apply"]);
    assert.equal(r.code, EXIT.VALIDATION);
    assert.match(r.err, /unparsable: packages\/p\/src\/bad\.ts/);
    assert.deepEqual(snapshot(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("a failed write rolls the tree back byte-for-byte", () => {
  const root = makeRepo(FILES);
  try {
    const before = snapshot(root);
    let renames = 0;
    const failing = {
      ...nodeFs,
      renameSync: (a, b) => {
        renames += 1;
        if (renames === 2) throw new Error("injected");
        nodeFs.renameSync(a, b);
      },
    };
    assert.equal(run(root, ["--scope", "packages", "--apply"], failing).code, EXIT.IO);
    assert.deepEqual(snapshot(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("CLI misuse is a usage error", () => {
  const root = makeRepo(FILES);
  try {
    assert.equal(run(root, []).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", "packages", "--apply", "--check"]).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", ".."]).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", "packages", "--bogus"]).code, EXIT.USAGE);
    assert.equal(
      run(root, ["--scope", "packages", "--report", "a", "--report", "b"]).code,
      EXIT.USAGE,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
