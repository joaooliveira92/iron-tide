// Tests for the report-first mode of scripts/sweep-comments.mjs. The pure
// classifier is asserted directly; the CLI/apply paths run against a throwaway
// repository so no real file is ever touched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  EXIT,
  classifyFile,
  docWords,
  identifierWords,
  restatesName,
  runCli,
} from "../sweep-comments-engine.mjs";
import { sweepSource } from "../sweep-comments.mjs";

const SRC = "packages/combat/src/x.ts";
const only = (src, rule, p = SRC) => classifyFile(p, src, [rule]);
const high = (cs) => cs.filter((c) => c.classification === "HIGH_CONFIDENCE_CANDIDATE");

void test("determinism: a bare ambient-nondeterminism restatement is a candidate", () => {
  const cs = only(
    "// Pure/deterministic: no ambient I/O/clock/random.\nexport const a = 1;\n",
    "determinism-pure-restatement",
  );
  assert.equal(cs.length, 1);
  assert.equal(cs[0].classification, "HIGH_CONFIDENCE_CANDIDATE");
  assert.equal(cs[0].proposedAction, "delete");
});

void test("determinism: keyed-randomness exclusivity is kept", () => {
  const cs = only(
    "// Pure/deterministic: the ONLY randomness is the keyed damage streams.\nexport const a = 1;\n",
    "determinism-pure-restatement",
  );
  assert.equal(cs[0].classification, "AUTO_EXCLUDE");
  assert.equal(high(cs).length, 0);
});

void test("determinism: further claims fail closed even without an excluding word", () => {
  const cs = only(
    "// Pure/deterministic: no I/O, no clock, delegates to the gunnery table.\nexport const a = 1;\n",
    "determinism-pure-restatement",
  );
  assert.notEqual(cs[0].classification, "HIGH_CONFIDENCE_CANDIDATE");
});

void test("determinism: a continuation line is never a candidate", () => {
  const cs = only(
    "// Pure/deterministic: no I/O,\n// no clock.\nexport const a = 1;\n",
    "determinism-pure-restatement",
  );
  assert.equal(high(cs).length, 0);
});

void test("determinism: files the gate does not cover are never candidates", () => {
  const src = "// Pure/deterministic: no ambient I/O/clock/random.\n";
  assert.equal(
    only(src, "determinism-pure-restatement", "packages/combat/test/x.test.ts").length,
    0,
  );
  assert.equal(
    only(src, "determinism-pure-restatement", "packages/persistence/src/x.ts").length,
    0,
  );
});

void test("name doc: exact declaration-name paraphrase is a candidate", () => {
  const cs = only(
    "/** Damage result. */\nexport interface DamageResult {}\n",
    "name-restating-doc",
  );
  assert.equal(cs[0].classification, "HIGH_CONFIDENCE_CANDIDATE");
});

void test("name doc: the same name plus a domain constraint is kept", () => {
  assert.equal(
    only(
      "/** Damage result in metric tons of TNT. */\nexport interface DamageResult {}\n",
      "name-restating-doc",
    ).length,
    0,
  );
  assert.equal(
    only(
      "/** Calculates penetration after obliquity normalization. */\nexport function calculatePenetration() {}\n",
      "name-restating-doc",
    ).length,
    0,
  );
});

void test("name doc: unit-bearing or tagged docs are never candidates", () => {
  assert.equal(
    only("/** @param x the value */\nexport function f(x) {}\n", "name-restating-doc").length,
    0,
  );
  const cs = only(
    "/** Vec3. */\nexport type Vec3 = [number, number, number];\n",
    "name-restating-doc",
  );
  assert.notEqual(cs[0]?.classification, "HIGH_CONFIDENCE_CANDIDATE");
});

void test("name doc normalizations each delete and each have a nearby keep", () => {
  assert.equal(restatesName("Damage result!", "DamageResult"), true); // punctuation
  assert.equal(restatesName("damage RESULT", "DamageResult"), true); // casing
  assert.equal(restatesName("Hull HTTP client", "hullHTTPClient"), true); // identifier splitting
  assert.equal(restatesName("The damage result", "DamageResult"), true); // articles
  assert.equal(restatesName("Calculates penetration", "calculatePenetration"), true); // verb
  assert.equal(restatesName("Damage result summary", "DamageResult"), false);
  assert.equal(restatesName("Penetration", "calculatePenetration"), false);
  assert.equal(restatesName("Computes penetration", "calculatePenetration"), false);
  assert.equal(restatesName("Damage results", "DamageResult"), false);
  assert.deepEqual(identifierWords("hullHTTPClient_v2"), ["hull", "http", "client", "v2"]);
  assert.deepEqual(docWords("The Damage-result."), ["damage", "result"]);
});

void test("scratch phrases are report-only", () => {
  const cs = only(
    "// Actually compute: 9999^5 ... Hmm, this is complex.\nconst x = 1;\n",
    "scratch-reasoning",
  );
  assert.equal(cs[0].classification, "REVIEW_REQUIRED");
  assert.equal(cs[0].proposedAction, "review");
});

void test("traceability and ordering contracts are never high confidence", () => {
  const trace = only(
    "// Pure/deterministic: no I/O (DESIGN-37 §32).\n",
    "determinism-pure-restatement",
  );
  assert.equal(high(trace).length, 0);
  const order = only(
    "// Pure/deterministic: runs after movement but before propulsion.\n",
    "determinism-pure-restatement",
  );
  assert.equal(high(order).length, 0);
});

function makeRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "sweep-test-"));
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
      if (nodeFs.lstatSync(f).isSymbolicLink())
        out[path.relative(root, f)] = `link:${nodeFs.readlinkSync(f)}`;
      else if (nodeFs.lstatSync(f).isDirectory()) walk(f);
      else out[path.relative(root, f)] = createHash("sha256").update(readFileSync(f)).digest("hex");
    }
  };
  walk(root);
  return out;
};
const run = (root, argv, extra = {}) => {
  const io = { out: "", err: "" };
  const code = runCli(argv, {
    repoRoot: root,
    commit: "deadbeef",
    stdout: (s) => (io.out += s),
    stderr: (s) => (io.err += s),
    ...extra,
  });
  return { code, ...io };
};
const GATE = "// Pure/deterministic: no ambient I/O/clock/random.\n";
const FILE = `${GATE}export const a = 1;\n`;

function reviewed(root, report, mutate) {
  const r = JSON.parse(readFileSync(report, "utf8"));
  mutate?.(r);
  writeFileSync(report, `${JSON.stringify(r, null, 2)}\n`);
}
function approveAll(root, report) {
  const r = JSON.parse(readFileSync(report, "utf8"));
  const ids = r.candidates
    .filter((c) => c.classification === "HIGH_CONFIDENCE_CANDIDATE")
    .map((c) => c.candidateId);
  return run(root, [
    "--review",
    report,
    "--decision",
    "APPROVE",
    ...ids.flatMap((i) => ["--id", i]),
  ]);
}

void test("dry run leaves the repository byte-for-byte unchanged and is repeatable", () => {
  const root = makeRepo({ [SRC]: FILE });
  const rep = path.join(tmpdir(), `sweep-rep-${String(process.pid)}`);
  try {
    const before = snapshot(root);
    const a = run(root, [
      "--scope",
      "packages/combat",
      "--format",
      "json",
      "--report",
      `${rep}-1.json`,
    ]);
    const b = run(root, [
      "--scope",
      "packages/combat",
      "--format",
      "json",
      "--report",
      `${rep}-2.json`,
    ]);
    assert.equal(a.code, EXIT.OK);
    assert.deepEqual(snapshot(root), before);
    assert.equal(readFileSync(`${rep}-1.json`, "utf8"), readFileSync(`${rep}-2.json`, "utf8"));
    const parsed = JSON.parse(readFileSync(`${rep}-1.json`, "utf8"));
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.candidates.length, 1);
    assert.deepEqual(parsed.reviews, {});
    assert.equal(b.code, EXIT.OK);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const n of ["1", "2"]) rmSync(`${rep}-${n}.json`, { force: true });
  }
});

void test("CLI misuse fails with usage errors", () => {
  const root = makeRepo({ [SRC]: FILE });
  try {
    assert.equal(run(root, ["--apply"]).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", "packages", "--format", "yaml"]).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", "packages", "--rule", "nope"]).code, EXIT.USAGE);
    assert.equal(run(root, ["--scope", ".."]).code, EXIT.USAGE);
    assert.equal(
      run(root, ["--scope", "packages", "--report", "/tmp/a.json", "--report", "/tmp/b.json"]).code,
      EXIT.USAGE,
    );
    assert.equal(
      run(root, ["--scope", "packages", "--report", path.join(root, SRC)]).code,
      EXIT.USAGE,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("scope cannot escape the repository through a symlink", () => {
  const outside = makeRepo({ "a.ts": GATE });
  const root = makeRepo({ [SRC]: FILE });
  try {
    nodeFs.symlinkSync(outside, path.join(root, "packages", "link"));
    assert.equal(run(root, ["--scope", "packages/link"]).code, EXIT.USAGE);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

function pilot(files = { [SRC]: FILE }) {
  const root = makeRepo(files);
  const report = path.join(root, "..", `sweep-${path.basename(root)}.json`);
  run(root, ["--scope", "packages/combat", "--format", "json", "--report", report]);
  return {
    root,
    report,
    clean: () => (rmSync(root, { recursive: true, force: true }), rmSync(report, { force: true })),
  };
}

void test("an unreviewed high-confidence candidate cannot be applied", () => {
  const { root, report, clean } = pilot();
  try {
    const before = snapshot(root);
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
    assert.deepEqual(snapshot(root), before);
  } finally {
    clean();
  }
});

void test("REJECT and DEFER decisions are not applied", () => {
  for (const decision of ["REJECT", "DEFER"]) {
    const { root, report, clean } = pilot();
    try {
      const id = JSON.parse(readFileSync(report, "utf8")).candidates[0].candidateId;
      run(root, ["--review", report, "--decision", decision, "--id", id]);
      assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
      assert.equal(readFileSync(path.join(root, SRC), "utf8"), FILE);
    } finally {
      clean();
    }
  }
});

void test("AUTO_EXCLUDE and REVIEW_REQUIRED can be neither approved nor applied", () => {
  const { root, report, clean } = pilot({
    [SRC]:
      "// Pure/deterministic: the ONLY randomness is keyed.\nexport const a = 1;\n// Maybe unsure\nexport const b = 2;\n",
  });
  try {
    const r = JSON.parse(readFileSync(report, "utf8"));
    for (const c of r.candidates) {
      assert.equal(
        run(root, ["--review", report, "--decision", "APPROVE", "--id", c.candidateId]).code,
        EXIT.VALIDATION,
      );
      // a hand-edited review must still be refused at apply time
      reviewed(root, report, (x) => (x.reviews[c.candidateId] = { decision: "APPROVE" }));
      assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
      reviewed(root, report, (x) => delete x.reviews[c.candidateId]);
    }
  } finally {
    clean();
  }
});

void test("approved candidates are removed and nothing else changes", () => {
  const { root, report, clean } = pilot({
    [SRC]: `// header\n\n${GATE}\nexport const a = 1;\n${GATE}export const b = 2;\n`,
  });
  try {
    assert.equal(approveAll(root, report).code, EXIT.OK);
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.OK);
    assert.equal(
      readFileSync(path.join(root, SRC), "utf8"),
      "// header\n\nexport const a = 1;\nexport const b = 2;\n",
    );
  } finally {
    clean();
  }
});

void test("CRLF endings and a missing final newline are preserved", () => {
  const crlf = `${GATE.replace("\n", "\r\n")}export const a = 1;\r\nexport const b = 2;`;
  const { root, report, clean } = pilot({ [SRC]: crlf });
  try {
    approveAll(root, report);
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.OK);
    assert.equal(
      readFileSync(path.join(root, SRC), "utf8"),
      "export const a = 1;\r\nexport const b = 2;",
    );
  } finally {
    clean();
  }
});

void test("a shifted line with unchanged context still applies; changed context is rejected", () => {
  const padded = `const p = 1;\nconst q = 2;\nconst r = 3;\nconst s = 4;\n${FILE}`;
  const { root, report, clean } = pilot({ [SRC]: padded });
  try {
    approveAll(root, report);
    writeFileSync(path.join(root, SRC), `// added far above\nconst z = 0;\n${padded}`);
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.OK);
    assert.equal(readFileSync(path.join(root, SRC), "utf8").includes("Pure/deterministic"), false);
  } finally {
    clean();
  }
  const stale = pilot();
  try {
    approveAll(stale.root, stale.report);
    writeFileSync(path.join(stale.root, SRC), `${GATE}export const a = 2;\n`);
    const before = snapshot(stale.root);
    assert.equal(run(stale.root, ["--apply", "--report", stale.report]).code, EXIT.VALIDATION);
    assert.deepEqual(snapshot(stale.root), before);
  } finally {
    stale.clean();
  }
});

void test("one stale candidate prevents every write", () => {
  const B = "packages/combat/src/b.ts";
  const { root, report, clean } = pilot({ [SRC]: FILE, [B]: FILE });
  try {
    approveAll(root, report);
    writeFileSync(path.join(root, B), `${GATE}export const changed = true;\n`);
    const before = snapshot(root);
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
    assert.deepEqual(snapshot(root), before);
  } finally {
    clean();
  }
});

void test("a failed write rolls the worktree back byte-for-byte", () => {
  const B = "packages/combat/src/b.ts";
  const { root, report, clean } = pilot({ [SRC]: FILE, [B]: FILE });
  try {
    approveAll(root, report);
    const before = snapshot(root);
    let renames = 0;
    const failing = {
      ...nodeFs,
      renameSync: (a, b) => {
        if (++renames === 2) throw new Error("injected");
        nodeFs.renameSync(a, b);
      },
    };
    const res = run(root, ["--apply", "--report", report], { fs: failing });
    assert.equal(res.code, EXIT.IO);
    assert.deepEqual(snapshot(root), before);
  } finally {
    clean();
  }
});

void test("unknown schema versions, unknown rules, and duplicates fail closed", () => {
  const { root, report, clean } = pilot();
  try {
    approveAll(root, report);
    const original = readFileSync(report, "utf8");
    for (const mutate of [
      (r) => (r.schemaVersion = 2),
      (r) => (r.candidates[0].rule = "made-up"),
      (r) => r.candidates.push({ ...r.candidates[0] }),
      (r) => (r.candidates[0].path = "../escape.ts"),
      (r) => (r.reviews["sha256:unknown"] = { decision: "APPROVE" }),
    ]) {
      writeFileSync(report, original);
      reviewed(root, report, mutate);
      assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
      assert.equal(readFileSync(path.join(root, SRC), "utf8"), FILE);
    }
  } finally {
    clean();
  }
});

void test("regenerating a report preserves human reviews for surviving candidates", () => {
  const { root, report, clean } = pilot();
  try {
    approveAll(root, report);
    run(root, ["--scope", "packages/combat", "--format", "json", "--report", report]);
    const r = JSON.parse(readFileSync(report, "utf8"));
    assert.equal(Object.values(r.reviews)[0].decision, "APPROVE");
  } finally {
    clean();
  }
});

void test("generated and vendored trees are not scanned", () => {
  const { report, clean } = pilot({
    [SRC]: FILE,
    "packages/combat/src/generated/g.ts": FILE,
    "packages/combat/dist/d.ts": FILE,
  });
  try {
    const r = JSON.parse(readFileSync(report, "utf8"));
    assert.deepEqual(
      r.candidates.map((c) => c.path),
      [SRC],
    );
  } finally {
    clean();
  }
});

void test("legacy sweep behavior is unchanged", () => {
  const { removals } = sweepSource(
    "// packages/w/src/t.ts\nimport x from './x.js';\n// ---- Severity enum ----\nexport const A = 1;\n",
  );
  assert.deepEqual(
    removals.map((r) => r.kind),
    ["HEADER", "RULER"],
  );
});

const SCRIPTS_DIR = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(SCRIPTS_DIR, "..");
const LEGACY_SRC =
  "// packages/w/src/t.ts\nimport x from './x.js';\n// ---- Severity enum ----\nexport const A = 1;\n";

function makeToolRepo() {
  const root = makeRepo({
    "packages/w/src/t.ts": LEGACY_SRC,
    "package.json": readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  });
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "apps"));
  mkdirSync(path.join(root, "scripts", "lib"));
  for (const f of [
    "sweep-comments.mjs",
    "sweep-comments-engine.mjs",
    "assert-runtime-free.mjs",
    "lib/paths.mjs",
  ]) {
    nodeFs.copyFileSync(path.join(SCRIPTS_DIR, f), path.join(root, "scripts", f));
  }
  nodeFs.symlinkSync(
    path.join(REPO_ROOT, "node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  return root;
}
const spawnNode = (root, args) =>
  spawnSync(process.execPath, [path.join(root, "scripts", "sweep-comments.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });

void test("bare invocation keeps the non-writing legacy output", () => {
  const root = makeToolRepo();
  try {
    const before = snapshot(root);
    const r = spawnNode(root, []);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /DRY RUN: files=\d+ total=\d+/);
    assert.doesNotMatch(r.stderr, /APPLIED/);
    assert.match(r.stdout, /^RULER\tpackages\/w\/src\/t\.ts:3\t/m);
    assert.match(r.stdout, /^HEADER\tpackages\/w\/src\/t\.ts:1\t/m);
    assert.deepEqual(snapshot(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("bare --apply exits 2, writes nothing, and explains the reviewed workflow on stderr only", () => {
  const root = makeToolRepo();
  try {
    const before = snapshot(root);
    const r = spawnNode(root, ["--apply"]);
    assert.equal(r.status, EXIT.USAGE);
    assert.deepEqual(snapshot(root), before);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^Error: --apply requires --report <reviewed-report\.json>\./);
    assert.match(r.stderr, /pnpm sweep:comments --scope packages\/combat/);
    assert.match(r.stderr, /pnpm sweep:comments --apply/);
    assert.doesNotMatch(r.stderr, /DRY RUN|APPLIED|"schemaVersion"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("--apply with a report reaches report validation instead of the usage error", () => {
  const root = makeToolRepo();
  const report = path.join(root, "..", `sweep-bad-${path.basename(root)}.json`);
  try {
    writeFileSync(report, "{}\n");
    const r = spawnNode(root, ["--apply", "--report", report]);
    assert.equal(r.status, EXIT.VALIDATION);
    assert.match(r.stderr, /unsupported report schemaVersion/);
    assert.equal(readFileSync(path.join(root, "packages/w/src/t.ts"), "utf8"), LEGACY_SRC);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(report, { force: true });
  }
});

void test("the package script forwards arguments: pnpm sweep:comments --apply", () => {
  const r = spawnSync("pnpm", ["sweep:comments", "--apply"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(r.status, EXIT.USAGE);
  assert.match(r.stderr, /Error: --apply requires --report <reviewed-report\.json>\./);
  const forwarded = spawnSync("pnpm", ["sweep:comments", "--scope", "does-not-exist"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(forwarded.status, EXIT.USAGE);
  assert.match(forwarded.stderr, /--scope does not exist/);
});

void test("a report destination that aliases a scanned source file is refused", () => {
  const root = makeRepo({ [SRC]: FILE });
  try {
    const file = path.join(root, SRC);
    nodeFs.symlinkSync(path.dirname(file), path.join(root, "alias-dir"));
    nodeFs.symlinkSync(file, path.join(root, "alias-file.json"));
    const viaDir = path.join(root, "alias-dir", "x.ts");
    const viaDots = path.join(root, "packages", "..", SRC);
    for (const target of [viaDir, viaDots, path.join(root, "alias-file.json")]) {
      assert.equal(
        run(root, ["--scope", "packages/combat", "--report", target]).code,
        EXIT.USAGE,
        target,
      );
    }
    assert.equal(readFileSync(file, "utf8"), FILE);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("a non-canonical candidate path is rejected at apply time", () => {
  const { root, report, clean } = pilot();
  try {
    approveAll(root, report);
    reviewed(root, report, (r) => (r.candidates[0].path = `./${r.candidates[0].path}`));
    assert.equal(run(root, ["--apply", "--report", report]).code, EXIT.VALIDATION);
    assert.equal(readFileSync(path.join(root, SRC), "utf8"), FILE);
  } finally {
    clean();
  }
});

void test("the entry-point guard behaves the same through canonical, symlinked and relative paths", () => {
  const root = makeToolRepo();
  const link = `${root}-link`;
  try {
    nodeFs.symlinkSync(root, link);
    const direct = spawnNode(root, []);
    const viaLink = spawnSync(
      process.execPath,
      [path.join(link, "scripts", "sweep-comments.mjs")],
      { cwd: link, encoding: "utf8" },
    );
    const relative = spawnSync(process.execPath, [path.join("scripts", "sweep-comments.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    for (const r of [viaLink, relative]) {
      assert.equal(r.status, direct.status);
      assert.equal(r.stdout, direct.stdout);
      assert.equal(r.stderr, direct.stderr);
    }
    assert.match(direct.stderr, /DRY RUN/);
    const missing = spawnSync(
      process.execPath,
      [
        "-e",
        `import(${JSON.stringify(pathToFileURL(path.join(root, "scripts", "sweep-comments.mjs")).href)}).then(() => console.log("imported"))`,
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(missing.status, 0);
    assert.equal(missing.stdout.trim(), "imported");
    assert.doesNotMatch(missing.stderr, /DRY RUN/);
  } finally {
    rmSync(link, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

void test("regeneration refuses to overwrite an unreadable report instead of dropping reviews", () => {
  const { root, report, clean } = pilot();
  try {
    approveAll(root, report);
    const good = readFileSync(report, "utf8");
    for (const bad of ["", "not json", "{}"]) {
      writeFileSync(report, bad);
      const r = run(root, ["--scope", "packages/combat", "--format", "json", "--report", report]);
      assert.equal(r.code, EXIT.VALIDATION);
      assert.match(r.err, /refusing to overwrite/);
      assert.equal(readFileSync(report, "utf8"), bad);
    }
    writeFileSync(report, good);
    assert.equal(
      run(root, ["--scope", "packages/combat", "--format", "json", "--report", report]).code,
      EXIT.OK,
    );
    assert.equal(readFileSync(report, "utf8"), good);
  } finally {
    clean();
  }
});

void test("filesystem faults map to the I/O exit code, not to validation or usage", () => {
  const { root, report, clean } = pilot();
  try {
    approveAll(root, report);
    const denied = Object.assign(new Error("denied"), { code: "EACCES" });
    const faulty = {
      ...nodeFs,
      realpathSync: (p, ...a) => {
        if (String(p).endsWith("x.ts")) throw denied;
        return nodeFs.realpathSync(p, ...a);
      },
    };
    assert.equal(run(root, ["--apply", "--report", report], { fs: faulty }).code, EXIT.IO);
    const scopeFault = {
      ...nodeFs,
      realpathSync: (p, ...a) => {
        if (String(p).endsWith("combat")) throw denied;
        return nodeFs.realpathSync(p, ...a);
      },
    };
    assert.equal(run(root, ["--scope", "packages/combat"], { fs: scopeFault }).code, EXIT.IO);
    assert.equal(readFileSync(path.join(root, SRC), "utf8"), FILE);
  } finally {
    clean();
  }
});
