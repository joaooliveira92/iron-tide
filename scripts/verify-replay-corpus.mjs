#!/usr/bin/env node
// Replay corpus gate (ADR-0246, spec #207): re-execute every checked-in replay in
// `golden/replays` through the real engine, each in two fresh processes, and require
// both runs to produce identical output. A divergence prints the first-divergence
// report (month, ledger, entry). This only verifies: it never records or approves a
// replay. Needs `pnpm build` first (it runs the compiled cross-process-test CLI).
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_REPLAY_DIR = resolve(ROOT, "golden", "replays");
const DEFAULT_CLI = resolve(ROOT, "packages/cross-process-test/dist/replay-corpus-cli.js");

function runOnce(cliPath, file) {
  const run = spawnSync(process.execPath, [cliPath, "verify", file], {
    encoding: "utf8",
    timeout: 600000,
  });
  if (run.error !== undefined) throw run.error;
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/**
 * @param {{ replayDir?: string, cliPath?: string }} [options]
 * @returns {{ ok: boolean, verified: string[], report: string }}
 */
export function verifyCorpus({ replayDir = DEFAULT_REPLAY_DIR, cliPath = DEFAULT_CLI } = {}) {
  const files = readdirSync(replayDir)
    .filter((name) => name.endsWith(".replay.json"))
    .sort();
  if (files.length === 0) {
    return { ok: false, verified: [], report: `replay corpus: no replay files in ${replayDir}\n` };
  }
  const verified = [];
  let report = "";
  for (const name of files) {
    const file = resolve(replayDir, name);
    const first = runOnce(cliPath, file);
    const second = runOnce(cliPath, file);
    if (first.status !== 0) {
      report += `replay corpus: ${name} failed verification\n${first.stderr}${first.stdout}`;
    } else if (
      first.status !== second.status ||
      first.stdout !== second.stdout ||
      first.stderr !== second.stderr
    ) {
      report +=
        `replay corpus: ${name} is not repeatable across two fresh processes\n` +
        `run 1 (${String(first.status)}): ${first.stdout}${first.stderr}\n` +
        `run 2 (${String(second.status)}): ${second.stdout}${second.stderr}\n`;
    } else {
      verified.push(name);
    }
  }
  return { ok: report === "", verified, report };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const result = verifyCorpus();
  if (!result.ok) {
    console.error(result.report);
    process.exit(1);
  }
  console.log(
    `replay corpus: ${String(result.verified.length)} replay(s) verified, identical across two fresh processes`,
  );
}
