import { unifiedSnapshotHash, type CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { ReplayVerifier, type MonthResult } from "@bluewave/phase-engine";

import type { ReplayCommandEnvelope } from "./format.js";

type VerifierEngineOptions = Parameters<ReplayVerifier["verify"]>[6];

export interface VerifierInput {
  readonly snapshot: CampaignSnapshot;
  readonly commands: readonly ReplayCommandEnvelope[];
  readonly result: MonthResult;
  readonly seed: string;
  readonly engineOptions: VerifierEngineOptions;
}

export function commandLedgerDigest(result: MonthResult): string {
  return result.commandLedger.hash();
}

export function replayVerificationHash(input: VerifierInput): string {
  const outcome = new ReplayVerifier().verify(
    input.snapshot,
    input.commands as CommandEnvelope<CommandBody>[],
    input.result.commandLedger,
    unifiedSnapshotHash(input.result.finalSnapshot),
    input.seed,
    new DiagnosticCollector(),
    input.engineOptions,
  );
  return sha256Hex(
    canonicalSerialize({
      match: outcome.match,
      replayedFinalHash: outcome.replayedFinalHash,
      originalFinalHash: outcome.originalFinalHash,
      replayedCommandLedgerHash: outcome.replayedCommandLedgerHash,
      originalCommandLedgerHash: outcome.originalCommandLedgerHash,
      steps: outcome.steps,
      mismatches: outcome.mismatches,
    }),
  );
}
