import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Result } from "effect";

import {
  FUZZ_CASES,
  checkFuzzCase,
  commandPlanDivergence,
  decodeFuzzManifest,
  fuzzSubsystems,
  formatCommandPlanFailure,
  formatFuzzFailure,
  recordFuzzManifest,
  buildCoverageReport,
  formatCoverageReport,
  formatDivergence,
  recordReplay,
  verifyReplay,
  REPLAY_SCENARIOS,
  type CommandPlan,
} from "./replay-corpus/index.js";

const REPLAY_DIR = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "golden",
  "replays",
);

const FUZZ_MANIFEST = resolve(REPLAY_DIR, "..", "replay-fuzz.json");

const USAGE = `usage:
  replay-corpus record <scenario-id> [--out <file>]   record a scenario into a replay file
  replay-corpus verify <file>                         re-execute a replay file and check it
  replay-corpus coverage                              list the subsystems each scenario exercises
  replay-corpus fuzz record                           re-record golden/replay-fuzz.json (local only)
  replay-corpus fuzz run <seed> <months>              check the fuzz properties for one seed
  replay-corpus fuzz check                            check every fuzz case against the pinned file
  replay-corpus fuzz plan <seed> <json>               replay a shrinking counterexample plan
scenarios: ${REPLAY_SCENARIOS.map((s) => s.id).join(", ")}`;

function fuzz(action: string | undefined, args: readonly string[]): number {
  if (action === "plan") {
    const [seed, planText] = args;
    if (seed === undefined || planText === undefined) {
      process.stderr.write(`${USAGE}\n`);
      return 2;
    }
    let plan: CommandPlan;
    try {
      plan = JSON.parse(planText) as CommandPlan;
    } catch {
      process.stderr.write("fuzz plan: the plan is not valid JSON\n");
      return 2;
    }
    const report = commandPlanDivergence(seed, plan);
    if (report !== undefined) {
      process.stderr.write(formatCommandPlanFailure(seed, plan, report));
      return 1;
    }
    process.stdout.write(`fuzz plan ok: seed ${seed}, ${String(plan.length)} months\n`);
    return 0;
  }
  if (action === "record") {
    if (process.env["CI"] !== undefined) {
      process.stderr.write("refusing to record the fuzz manifest under CI\n");
      return 2;
    }
    writeFileSync(FUZZ_MANIFEST, recordFuzzManifest(FUZZ_CASES), "utf8");
    process.stdout.write(`recorded ${String(FUZZ_CASES.length)} fuzz cases -> ${FUZZ_MANIFEST}\n`);
    return 0;
  }
  const [seed, monthsText] = args;
  const cases =
    action === "run" && seed !== undefined && monthsText !== undefined
      ? [{ seed, months: Number(monthsText) }]
      : action === "check"
        ? FUZZ_CASES
        : undefined;
  if (cases === undefined || cases.some((c) => !Number.isSafeInteger(c.months) || c.months < 1)) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const manifest = decodeFuzzManifest(readFileSync(FUZZ_MANIFEST, "utf8"));
  for (const fuzzCase of cases) {
    const pinned = manifest.cases.find(
      (c) => c.seed === fuzzCase.seed && c.months === fuzzCase.months,
    );
    const outcome = checkFuzzCase(fuzzCase, pinned === undefined ? {} : { pinned });
    if (!outcome.ok) {
      process.stderr.write(formatFuzzFailure(outcome));
      return 1;
    }
    process.stdout.write(`fuzz ok: seed ${fuzzCase.seed}, ${String(fuzzCase.months)} months\n`);
  }
  return 0;
}

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
  if (command === "fuzz") return fuzz(target, rest);
  if (command === "coverage") {
    const report = buildCoverageReport(REPLAY_SCENARIOS);
    process.stdout.write(formatCoverageReport(report));
    const fuzzed = fuzzSubsystems();
    process.stdout.write(`fuzz exercises: ${fuzzed.join(", ")}\n`);
    process.stdout.write(
      `uncovered by replays and fuzz: ${report.uncovered.filter((id) => !fuzzed.includes(id)).join(", ")}\n`,
    );
    return 0;
  }
  if (command === "verify" && target !== undefined) {
    const text = readFileSync(resolve(target), "utf8");
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
