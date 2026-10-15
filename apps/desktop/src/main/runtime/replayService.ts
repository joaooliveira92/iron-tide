// The deterministic replay/recovery boundary as a service (INC-3b; ADR-0159).
// Wraps `@bluewave/phase-engine`'s `ReplayVerifier`/`hashSnapshot`,
// `@bluewave/persistence`'s `RecoveryManager`, and the desktop's
// player-slot-promotion seam, so the continuity command programs replay,
// hash and recover through the Layer instead of constructing these inline.
// Every method is `Effect<A, never, never>`: the wrapped calls are synchronous
// and pure apart from `RecoveryManager.revert` (a single pointer flip whose
// failure is reported as `false`, exactly as `recoverCampaign` expects).
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

/** Everything one `ReplayVerifier.verify` call needs, gathered by the caller. */
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
    /** Runs one month again and compares its closing hash + per-step ledger. */
    readonly verify: (request: ReplayVerificationRequest) => Effect.Effect<ReplayResult>;
    /** Reverts the package pointer to an earlier save; `false` when it could not. */
    readonly revert: (saveDir: string, saveId: string) => Effect.Effect<boolean>;
    /** The canonical deterministic hash of a snapshot (`ReplayVerifier`'s own subset hash). */
    readonly hash: (snapshot: CampaignSnapshot) => Effect.Effect<string>;
    /** A copy of `snapshot` with the player's slot promoted to index 0. */
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
    revert: (saveDir, saveId) => Effect.sync(() => RecoveryManager.revert(saveDir, saveId)),
    hash: (snapshot) => Effect.sync(() => hashSnapshot(snapshot)),
    promote: (snapshot, slotId) =>
      Effect.sync(() => promotePlayerSlotForExecution(snapshot, slotId)),
  });
}
