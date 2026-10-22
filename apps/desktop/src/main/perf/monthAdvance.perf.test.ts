import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { resolveGeneratedContentDir } from "../contentPack.js";

const MONTHS = 12;
const SEED = "perf-tripwire-1880";

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
      expect(result.outcome, `month ${String(m)} must complete`).toBe("completed");
      snapshot = {
        ...result.finalSnapshot,
        turnNumber: SafeInt((result.finalSnapshot.turnNumber as number) + 1),
      };
    }
    const elapsed = performance.now() - started;

    // eslint-disable-next-line no-console
    console.log(
      `month-advance tripwire: ${elapsed.toFixed(1)}ms for ${MONTHS} months ` +
        `(${(elapsed / MONTHS).toFixed(1)}ms/month); ceiling ${CEILING_TOTAL_MS}ms`,
    );
    expect(elapsed).toBeLessThan(CEILING_TOTAL_MS);
  }, 300_000);
});
