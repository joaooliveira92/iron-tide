// Performance tripwire (release-readiness ticket 01): the month-advance path a
// player feels must not regress silently. A deterministic fixed-seed run over
// the production 1880 pack, asserting a generous wall-clock ceiling — the point
// is catching order-of-magnitude regressions, never micro-tuning.
//
// Gated behind BLUEWAVE_PERF=1 so it does not add timing flake to the default
// suite; quality.yml runs it as a dedicated step on the built content artifact.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { resolveGeneratedContentDir } from "../contentPack.js";

/** Months advanced per run: enough to be representative, short enough to gate. */
const MONTHS = 12;
const SEED = "perf-tripwire-1880";

// Baseline recorded 2026-10-12 on the reference dev machine (warm, Node 24):
// 1071ms for the 12-month loop (~89ms/month). The ceiling is 3x the baseline so
// a genuinely slower CI runner still passes while an order-of-magnitude
// regression fails. Re-measure and raise deliberately (with a ticket note) if
// the engine grows.
const BASELINE_TOTAL_MS = 1100;
const CEILING_TOTAL_MS = BASELINE_TOTAL_MS * 3;

describe.skipIf(process.env.BLUEWAVE_PERF !== "1")("month-advance performance tripwire", () => {
  it(`advances ${MONTHS} months over the 1880 production pack under ${CEILING_TOTAL_MS}ms`, () => {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      new AbortController().signal,
      collector,
    );
    expect(output, "the production content artifact must compile").toBeDefined();
    if (!output) return;

    let snapshot = output.state.snapshot;
    const started = performance.now();
    for (let m = 0; m < MONTHS; m++) {
      const result = new MonthExecutor().execute(
        snapshot,
        [],
        `${SEED}:month:${String(m)}`,
        new DiagnosticCollector(),
      );
      expect(result.success, `month ${String(m)} must advance`).toBe(true);
      snapshot = {
        ...result.finalSnapshot,
        turnNumber: SafeInt((result.finalSnapshot.turnNumber as number) + 1),
      };
    }
    const elapsed = performance.now() - started;

    // Tripwire diagnostic, not application logging: emit the measured timing so a
    // perf regression is visible in CI output.
    // eslint-disable-next-line no-console
    console.log(
      `month-advance tripwire: ${elapsed.toFixed(1)}ms for ${MONTHS} months ` +
        `(${(elapsed / MONTHS).toFixed(1)}ms/month); ceiling ${CEILING_TOTAL_MS}ms`,
    );
    expect(elapsed).toBeLessThan(CEILING_TOTAL_MS);
  }, 300_000);
});
