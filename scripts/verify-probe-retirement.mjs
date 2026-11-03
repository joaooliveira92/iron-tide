#!/usr/bin/env node
// Legacy probe retirement criterion. Every probe pinned in
// `golden/hashes.json` is classified in `golden/probe-retirement.json`: either it cites the
// replay-corpus mutation test that catches the same class of break (the probe is then
// retire-eligible), or it states why none does yet (the probe is retained). This check only
// reports eligibility; it never removes a probe. Retiring one is a separate reviewed change.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * @param {{ golden: Record<string, unknown>, register: { probes: Record<string, any> }, read: (file: string) => string | undefined }} input
 * @returns {{ ok: boolean, eligible: string[], retained: string[], problems: string[] }}
 */
export function evaluateRetirement({ golden, register, read }) {
  const pinned = Object.keys(golden).filter((key) => key.endsWith("Hash"));
  const problems = [];
  const eligible = [];
  const retained = [];
  for (const probe of pinned) {
    const entry = register.probes[probe];
    if (entry === undefined) {
      problems.push(`${probe}: pinned in golden/hashes.json but not classified`);
    } else if (entry.mutation === null) {
      if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
        problems.push(`${probe}: an unmapped probe must state a reason`);
      }
      retained.push(probe);
    } else {
      const text = read(entry.mutation.file);
      if (text === undefined) {
        problems.push(`${probe}: mutation file ${entry.mutation.file} not found`);
      } else if (!text.includes(`"${entry.mutation.test}"`)) {
        problems.push(
          `${probe}: mutation test "${entry.mutation.test}" not found in ${entry.mutation.file}`,
        );
      } else {
        eligible.push(probe);
      }
    }
  }
  for (const probe of Object.keys(register.probes)) {
    if (!pinned.includes(probe))
      problems.push(`${probe}: classified but not pinned in golden/hashes.json`);
  }
  return { ok: problems.length === 0, eligible, retained, problems };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const json = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
  const read = (file) => {
    try {
      return readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      return undefined;
    }
  };
  const result = evaluateRetirement({
    golden: json("golden/hashes.json"),
    register: json("golden/probe-retirement.json"),
    read,
  });
  for (const problem of result.problems) console.error(`probe retirement: ${problem}`);
  console.log(`probe retirement: eligible [${result.eligible.join(", ")}]`);
  console.log(`probe retirement: retained [${result.retained.join(", ")}]`);
  process.exit(result.ok ? 0 : 1);
}
