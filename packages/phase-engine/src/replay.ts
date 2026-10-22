import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, CommandLedger } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "./month.js";
import type { MonthExecutorEngineOptions } from "./pipeline.js";

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
  finalSnapshot: CampaignSnapshot;
}

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
