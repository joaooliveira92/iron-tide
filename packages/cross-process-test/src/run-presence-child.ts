// S-5 05 (#79, spec #73 R15): cross-process determinism child for the month-end presence step. Compiles the production
// pack, runs one strategic month twice - once with the presence section dormant and once with a FIXTURE-CLASS section -
// and prints the hashes and the typed shortfall events as JSON for byte-for-byte comparison across two clean processes.
//
// EVERY RULESET NUMBER BELOW IS FIXTURE-CLASS: it exercises the mechanics and never reaches the production pack.
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const FIXTURE_PRESENCE = {
  requiredTonsPerPossessionWeight: 1_000,
  noPortValueWeight: 3,
  crampedOrShortRangeCountBp: 5_000,
};

function run(): void {
  try {
    const { state } = compileProductionCampaign();
    const execute = (withSection: boolean) =>
      new MonthExecutor().execute(
        state.snapshot,
        [],
        "presence-cross-process-seed",
        new DiagnosticCollector(),
        undefined,
        withSection ? { presence: FIXTURE_PRESENCE } : undefined,
      );
    const dormant = execute(false);
    const configured = execute(true);
    const shortfalls = configured.eventLedger.all
      .filter((e) => e.body.kind === "PresenceShortfall")
      .map((e) => e.body);
    const output = {
      dormantSnapshotHash: sha256Hex(canonicalSerialize(dormant.finalSnapshot)),
      dormantEventLedgerHash: dormant.eventLedger.hash(),
      dormantShortfallCount: dormant.eventLedger.all.filter(
        (e) => e.body.kind === "PresenceShortfall",
      ).length,
      configuredSnapshotHash: sha256Hex(canonicalSerialize(configured.finalSnapshot)),
      configuredEventLedgerHash: configured.eventLedger.hash(),
      shortfalls,
      success: dormant.success && configured.success,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
  }
}

run();
