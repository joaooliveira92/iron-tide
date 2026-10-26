import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, CommandLedger } from "@bluewave/commands";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { RecoveryManager } from "@bluewave/persistence";
import {
  hashSnapshot,
  type MonthExecutorEngineOptions,
  type ReplayResult,
  ReplayVerifier,
} from "@bluewave/phase-engine";
import { Context, Effect, Layer } from "effect";
import { promotePlayerSlotForExecution } from "../commands/commitMonth/snapshot.js";

export interface ReplayVerificationRequest {
  readonly snapshot: CampaignSnapshot;
  readonly commands: readonly CommandEnvelope<CommandBody>[];
  readonly originalCommandLedger: CommandLedger;
  readonly expectedFinalSnapshotHash: string;
  readonly randomSeed: string;
  readonly collector: DiagnosticCollector;
  readonly engineOptions?: MonthExecutorEngineOptions;
}

export class ReplayService extends Context.Service<
  ReplayService,
  {
    readonly verify: (request: ReplayVerificationRequest) => Effect.Effect<ReplayResult>;
    readonly revert: (saveDir: string, saveId: string) => Effect.Effect<boolean>;
    readonly hash: (snapshot: CampaignSnapshot) => Effect.Effect<string>;
    readonly promote: (
      snapshot: CampaignSnapshot,
      slotId: string,
    ) => Effect.Effect<CampaignSnapshot>;
  }
>()("bluewave/desktop/ReplayService") {}

export function replayServiceLayer(): Layer.Layer<ReplayService> {
  return Layer.succeed(ReplayService, {
    verify: (request) =>
      Effect.sync(() =>
        new ReplayVerifier().verify(
          request.snapshot,
          [...request.commands],
          request.originalCommandLedger,
          request.expectedFinalSnapshotHash,
          request.randomSeed,
          request.collector,
          request.engineOptions,
        ),
      ),
    revert: (saveDir, saveId) =>
      RecoveryManager.revertEffect(saveDir, saveId).pipe(
        Effect.match({ onFailure: () => false, onSuccess: () => true }),
      ),
    hash: (snapshot) => Effect.sync(() => hashSnapshot(snapshot)),
    promote: (snapshot, slotId) =>
      Effect.sync(() => promotePlayerSlotForExecution(snapshot, slotId)),
  });
}
