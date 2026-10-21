import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Result } from "effect";

import {
  formatDivergence,
  recordReplay,
  verifyReplay,
  REPLAY_SCENARIOS,
} from "./replay-corpus/index.js";

const REPLAY_DIR = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "golden",
  "replays",
);

const USAGE = `usage:
  replay-corpus record <scenario-id> [--out <file>]   record a scenario into a replay file
  replay-corpus verify <file>                         re-execute a replay file and check it
scenarios: ${REPLAY_SCENARIOS.map((s) => s.id).join(", ")}`;

function main(argv: readonly string[]): number {
  const [command, target, ...rest] = argv;
  if (command === "record" && target !== undefined) {
    const scenario = REPLAY_SCENARIOS.find((s) => s.id === target);
    if (scenario === undefined) {
      process.stderr.write(`unknown scenario "${target}"\n${USAGE}\n`);
      return 2;
    }
    const outIndex = rest.indexOf("--out");
    const out = resolve(
      outIndex >= 0 && rest[outIndex + 1] !== undefined
        ? (rest[outIndex + 1] as string)
        : resolve(REPLAY_DIR, `${scenario.id}.replay.json`),
    );
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, recordReplay(scenario), "utf8");
    process.stdout.write(`recorded ${scenario.id} -> ${out}\n`);
    return 0;
  }
  if (command === "verify" && target !== undefined) {
    const text = readFileSync(resolve(target), "utf8");
    // Straight-through and save/load/continue must both reproduce the recorded checkpoints.
    for (const [label, options] of [
      ["", {}],
      [" (save/load round trip)", { roundTrip: {} }],
    ] as const) {
      const result = verifyReplay(text, options);
      if (Result.isFailure(result)) {
        process.stderr.write(`rejected: ${result.failure.message}\n`);
        return 2;
      }
      if (!result.success.ok) {
        process.stderr.write(
          `DIVERGED ${target}${label}: ${formatDivergence(result.success.divergence)}`,
        );
        return 1;
      }
      process.stdout.write(`verified ${target}${label}: ${String(result.success.months)} months\n`);
    }
    return 0;
  }
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
