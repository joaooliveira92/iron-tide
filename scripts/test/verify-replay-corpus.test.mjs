// Tests for scripts/verify-replay-corpus.mjs: the corpus gate runs every replay in
// two fresh processes, requires identical output, and surfaces a first-divergence
// report on failure. The child is a stub CLI so the test needs no engine build.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { verifyCorpus } from "../verify-replay-corpus.mjs";

function fixture(cliSource, replays = ["a.replay.json"]) {
  const dir = mkdtempSync(join(tmpdir(), "replay-corpus-"));
  const cli = join(dir, "cli.mjs");
  writeFileSync(cli, cliSource);
  const replayDir = join(dir, "replays");
  return { cli, replayDir, replays, dir };
}

async function setup(cliSource, replays) {
  const f = fixture(cliSource, replays);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(f.replayDir);
  for (const r of f.replays) writeFileSync(join(f.replayDir, r), "{}");
  return f;
}

const OK = `console.log("verified " + process.argv[3].split(/[\\\\/]/).pop() + ": 12 months");`;

void test("passes when every replay verifies identically in two fresh processes", async () => {
  const f = await setup(OK, ["b.replay.json", "a.replay.json"]);
  const result = verifyCorpus({ replayDir: f.replayDir, cliPath: f.cli });
  assert.equal(result.ok, true);
  assert.deepEqual(result.verified, ["a.replay.json", "b.replay.json"]);
});

void test("prints the first-divergence report when a replay diverges", async () => {
  const f = await setup(
    `console.error("DIVERGED x: month 3 ledger event entry 7"); process.exit(1);`,
  );
  const result = verifyCorpus({ replayDir: f.replayDir, cliPath: f.cli });
  assert.equal(result.ok, false);
  assert.match(result.report, /DIVERGED x: month 3 ledger event entry 7/u);
});

void test("fails when two fresh processes disagree", async () => {
  const f = await setup(
    `import { appendFileSync, existsSync } from "node:fs";
     const flag = process.argv[1] + ".seen";
     const seen = existsSync(flag); appendFileSync(flag, "x");
     console.log(seen ? "second" : "first");`,
  );
  const result = verifyCorpus({ replayDir: f.replayDir, cliPath: f.cli });
  assert.equal(result.ok, false);
  assert.match(result.report, /not repeatable/u);
});

void test("fails closed on an empty corpus", async () => {
  const f = await setup(OK, []);
  const result = verifyCorpus({ replayDir: f.replayDir, cliPath: f.cli });
  assert.equal(result.ok, false);
  assert.match(result.report, /no replay files/u);
});
