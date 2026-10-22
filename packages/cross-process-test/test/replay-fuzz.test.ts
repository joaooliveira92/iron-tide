import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { MonthResult } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import {
  FUZZ_CASES,
  checkFuzzCase,
  decodeFuzzManifest,
  formatFuzzFailure,
  recordFuzzManifest,
  runFuzzCase,
  type FuzzCase,
} from "../src/replay-corpus/index.js";

const MANIFEST = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../golden/replay-fuzz.json",
);

const SMALL: FuzzCase = { seed: "fuzz-test-a", months: 3 };

describe("seeded fuzz generation", () => {
  const run = runFuzzCase(SMALL);

  it("is reproducible from the seed alone", () => {
    expect(runFuzzCase(SMALL)).toEqual(run);
  });

  it("depends on the seed", () => {
    expect(runFuzzCase({ ...SMALL, seed: "fuzz-test-b" }).digest).not.toBe(run.digest);
  });

  it("issues commands the engine accepts and rejects none of its own", () => {
    expect(run.commandsIssued).toBeGreaterThan(0);
    expect(run.commandsAccepted).toBe(run.commandsIssued);
    expect(run.subsystems).toContain("command_collection");
  });
});

describe("fuzz properties", () => {
  it("passes repeatability and save/load round-trip on an unmodified engine", () => {
    expect(checkFuzzCase(SMALL)).toEqual({ ok: true, digest: runFuzzCase(SMALL).digest });
  });

  it("fails repeatability with the seed, month and ledger of the first difference", () => {
    const fault = {
      month: 2,
      afterExecute: (result: MonthResult) => {
        result.randomLedger.record({
          streamId: "mutation",
          entityKey: "mutation",
          phase: "mutation",
          rulesetVersion: "0.1.0",
          inputHash: "0".repeat(64),
          draw: 1,
          outcome: "mutation",
          reasonCode: "MUTATION",
        });
      },
    };
    const outcome = checkFuzzCase(SMALL, { secondRun: fault });
    expect(outcome).toMatchObject({
      ok: false,
      seed: SMALL.seed,
      property: "repeatability",
      divergence: { month: 2, where: "random" },
    });
    if (outcome.ok) return;
    const text = formatFuzzFailure(outcome);
    expect(text).toContain(`seed ${SMALL.seed}`);
    expect(text).toContain("replay:fuzz run");
    expect(text).not.toContain("\r");
    expect(
      checkFuzzCase({ seed: outcome.seed, months: outcome.months }, { secondRun: fault }),
    ).toEqual(outcome);
  });

  it("fails the round trip when persistence loses data", () => {
    const outcome = checkFuzzCase(SMALL, {
      roundTrip: {
        lossy: (snapshot, month) =>
          month === 1 ? { ...snapshot, version: `${snapshot.version}x` } : snapshot,
      },
    });
    expect(outcome).toMatchObject({
      ok: false,
      seed: SMALL.seed,
      property: "roundtrip",
      divergence: { month: 1 },
    });
  });
});

describe("pinned fuzz corpus (cross-OS equality)", () => {
  const text = readFileSync(MANIFEST, "utf8");
  const manifest = decodeFuzzManifest(text);

  it("has a bounded, deterministic budget", () => {
    expect(FUZZ_CASES.length).toBeLessThanOrEqual(8);
    expect(FUZZ_CASES.reduce((sum, c) => sum + c.months, 0)).toBeLessThanOrEqual(32);
    expect(new Set(FUZZ_CASES.map((c) => c.seed)).size).toBe(FUZZ_CASES.length);
  });

  it("is exactly what the local record tool writes", () => {
    expect(text).toBe(recordFuzzManifest(FUZZ_CASES));
  });

  it.each(FUZZ_CASES.map((c) => [c.seed, c] as const))(
    "reproduces the pinned digest for %s on this OS",
    (_seed, fuzzCase) => {
      const entry = manifest.cases.find((c) => c.seed === fuzzCase.seed);
      expect(entry).toBeDefined();
      const outcome = checkFuzzCase(fuzzCase, { pinned: entry });
      if (!outcome.ok) throw new Error(formatFuzzFailure(outcome));
      expect(outcome.ok).toBe(true);
    },
  );

  it("reports a stale pin as a pinned-property failure naming the month", () => {
    const entry = manifest.cases[0];
    if (entry === undefined) throw new Error("empty manifest");
    const stale = {
      ...entry,
      monthDigests: entry.monthDigests.map((d, i) => (i === 1 ? "0".repeat(64) : d)),
    };
    const fuzzCase = FUZZ_CASES[0] as FuzzCase;
    expect(checkFuzzCase(fuzzCase, { pinned: stale })).toMatchObject({
      ok: false,
      property: "pinned",
      seed: fuzzCase.seed,
      divergence: { month: 2 },
    });
  });
});
