import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, CommandLedger } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "./month.js";
import type { MonthExecutorEngineOptions } from "./monthContext.js";

export interface ReplayStepResult {
  stepIndex: number;
  commandId: string;
  expectedHash: string;
  actualHash: string;
  match: boolean;
}

export interface ReplayMismatch {
  stepIndex: number;
  commandId: string;
  expectedHash: string;
  actualHash: string;
  diagnostic: string;
}

export interface ReplayResult {
  match: boolean;
  replayedFinalHash: string;
  originalFinalHash: string;
  replayedCommandLedgerHash: string;
  originalCommandLedgerHash: string;
  steps: ReplayStepResult[];
  mismatches: ReplayMismatch[];
  // The replayed post-execution snapshot (already computed internally to
  // derive replayedFinalHash) — exposed so callers can inspect battle
  // outcomes/generation records without re-running the replay themselves.
  finalSnapshot: CampaignSnapshot;
}

/**
 * The deterministic subset of a snapshot that `ReplayVerifier` hashes (and that
 * any caller computing an expected closing-state hash must use). Exported so
 * external callers — the desktop's replay command, cross-process checks — share
 * one definition instead of copying it and risking divergence.
 */
export function snapshotToHashable(snapshot: CampaignSnapshot): unknown {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  const wars = {
    wars: snapshot.wars.wars.map((w) => ({ ...w })),
    battles: snapshot.wars.battles.map((b) => ({ ...b, manifestHash: b.manifestHash })),
    participantMemberships: snapshot.wars.participantMemberships.map((m) => ({ ...m })),
    blockadeState: snapshot.wars.blockadeState.map((b) => ({ ...b })),
    battleManifests: (snapshot.wars.battleManifests ?? []).map((m) => ({ ...m })),
  };
  return {
    version: snapshot.version,
    turnNumber: snapshot.turnNumber,
    campaignId: snapshot.campaignId,
    // B-6/ADR-0025: canonical start date + current-month per-area weather are
    // part of the authoritative snapshot surface (hash parity with the
    // cross-process child's snapshotToHashable).
    startYear: snapshot.startYear,
    startMonth: snapshot.startMonth,
    strategicWeather: (snapshot.strategicWeather ?? []).map((s) => ({ ...s })),
    slots: snapshot.slots.map((s) => ({ ...s })),
    world: {
      areas: snapshot.world.areas.map((a) => ({ ...a })),
      routes: snapshot.world.routes.map((r) => ({ ...r })),
      ports: snapshot.world.ports.map((p) => ({ ...p })),
    },
    nations,
    wars,
    politics: {
      relations: snapshot.politics.relations.map((r) => ({ ...r })),
      shells: { ...snapshot.politics.shells },
    },
    intelligence: {
      shells: { ...snapshot.intelligence.shells },
    },
    rulesetVersion: snapshot.rulesetVersion,
    compatibilityVersion: snapshot.compatibilityVersion,
  };
}

/** SHA-256 of `snapshotToHashable` — the canonical snapshot hash used by replay. */
export function hashSnapshot(snapshot: CampaignSnapshot): string {
  return sha256Hex(canonicalSerialize(snapshotToHashable(snapshot)));
}

export class ReplayVerifier {
  verify(
    snapshot: CampaignSnapshot,
    commands: CommandEnvelope<CommandBody>[],
    originalCommandLedger: CommandLedger,
    expectedFinalSnapshotHash: string,
    randomSeed: string,
    collector: DiagnosticCollector,
    engineOptions?: MonthExecutorEngineOptions,
  ): ReplayResult {
    const executor = new MonthExecutor();
    // The same engine options the month was executed with (e.g. the ship-building content), or the replay cannot agree.
    const result = executor.execute(
      snapshot,
      commands,
      randomSeed,
      collector,
      undefined,
      engineOptions,
    );

    const replayedFinalHash = hashSnapshot(result.finalSnapshot);

    const originalOutcomes = originalCommandLedger.all;
    const replayedOutcomes = result.commandLedger.all;

    const steps: ReplayStepResult[] = [];
    const mismatches: ReplayMismatch[] = [];

    const maxSteps = Math.max(originalOutcomes.length, replayedOutcomes.length);
    for (let i = 0; i < maxSteps; i++) {
      const original = originalOutcomes[i];
      const replayed = replayedOutcomes[i];

      if (!original || !replayed) {
        const diagnostic = !original
          ? "Original outcome missing at step"
          : "Replayed outcome missing at step";
        mismatches.push({
          stepIndex: i,
          commandId: original?.commandId ?? replayed?.commandId ?? "unknown",
          expectedHash: original?.snapshotHash ?? "missing",
          actualHash: replayed?.snapshotHash ?? "missing",
          diagnostic,
        });
        steps.push({
          stepIndex: i,
          commandId: original?.commandId ?? replayed?.commandId ?? "unknown",
          expectedHash: original?.snapshotHash ?? "missing",
          actualHash: replayed?.snapshotHash ?? "missing",
          match: false,
        });
        continue;
      }

      const match = original.snapshotHash === replayed.snapshotHash;
      steps.push({
        stepIndex: i,
        commandId: original.commandId,
        expectedHash: original.snapshotHash,
        actualHash: replayed.snapshotHash,
        match,
      });

      if (!match) {
        mismatches.push({
          stepIndex: i,
          commandId: original.commandId,
          expectedHash: original.snapshotHash,
          actualHash: replayed.snapshotHash,
          diagnostic: `Snapshot hash mismatch at step ${i} for command ${original.commandId}: expected ${original.snapshotHash}, got ${replayed.snapshotHash}`,
        });
      }
    }

    const finalHashMatch = replayedFinalHash === expectedFinalSnapshotHash;
    if (!finalHashMatch) {
      mismatches.push({
        stepIndex: maxSteps,
        commandId: "final",
        expectedHash: expectedFinalSnapshotHash,
        actualHash: replayedFinalHash,
        diagnostic: `Final snapshot hash mismatch: expected ${expectedFinalSnapshotHash}, got ${replayedFinalHash}`,
      });
    }

    return {
      match: mismatches.length === 0,
      replayedFinalHash,
      originalFinalHash: expectedFinalSnapshotHash,
      replayedCommandLedgerHash: result.commandLedger.hash(),
      originalCommandLedgerHash: originalCommandLedger.hash(),
      steps,
      mismatches,
      finalSnapshot: result.finalSnapshot,
    };
  }
}
