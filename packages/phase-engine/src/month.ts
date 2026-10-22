import { type CampaignSnapshot, campaignMonthId } from "@bluewave/campaign";
import {
  type CommandBody,
  type CommandEnvelope,
  CommandLedger,
  CommandLifecycle,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { RandomLedger } from "@bluewave/random";
import { FinancialLedger } from "./financial-ledger.js";
import { createInterruptionState, trailingInputSuspension } from "./interruption.js";
import {
  PLAYER_NATION_UNKNOWN,
  type MonthContext,
  MonthExecutorEngineOptions,
  MonthResult,
  StrategicWeatherPhaseOptions,
} from "./monthContext.js";
import { PHASE_ACCESS_DENIED, PhaseGuard } from "./phase-guard.js";
import { PhaseRegistry, type PhaseDescriptor } from "./registry.js";
import { cloneSnapshot } from "./snapshotClone.js";

export { PLAYER_NATION_UNKNOWN };
export type { MonthExecutorEngineOptions, MonthResult, StrategicWeatherPhaseOptions };

export class MonthExecutor {
  private lifecycle = new CommandLifecycle();

  execute(
    snapshot: CampaignSnapshot,
    commands: CommandEnvelope<CommandBody>[],
    randomSeed: string,
    collector: DiagnosticCollector,
    options?: StrategicWeatherPhaseOptions,
    engineOptions?: MonthExecutorEngineOptions,
  ): MonthResult {
    const commandLedger = new CommandLedger();
    const eventLedger = new EventLedger();
    const randomLedger = new RandomLedger();
    const financialLedger = new FinancialLedger();
    const phaseGuard = new PhaseGuard(engineOptions?.phaseOverrides);

    let eventSeq = 0;
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      snapshot["turnNumber"] as number,
    );

    const ctx: MonthContext = {
      currentSnapshot: cloneSnapshot(snapshot),
      sourceSnapshot: snapshot,
      slots: snapshot["slots"],
      commands,
      campaignMonth,
      turnNumber: snapshot["turnNumber"],
      randomSeed,
      commandLedger,
      eventLedger,
      randomLedger,
      financialLedger,
      phaseGuard,
      lifecycle: this.lifecycle,
      collector,
      options,
      engineOptions,
      ...(engineOptions?.playerNationId === undefined
        ? {}
        : { playerNationId: engineOptions.playerNationId }),
      ...(engineOptions?.battleOffers === undefined
        ? {}
        : { battleOffers: engineOptions.battleOffers }),
      interruption:
        engineOptions?.interruptions !== undefined
          ? createInterruptionState(engineOptions.interruptions)
          : undefined,
      nextSeq: () => {
        const current = SafeInt(eventSeq);
        eventSeq++;
        return current;
      },
    };

    if (ctx.playerNationId !== undefined && !snapshot["nations"].has(ctx.playerNationId)) {
      collector.addError(
        PLAYER_NATION_UNKNOWN,
        `Player nation '${ctx.playerNationId}' is not a nation of this campaign`,
        { stage: "player_nation", entityId: ctx.playerNationId },
      );
      return this.finish(ctx, false);
    }

    return this.runPhases(ctx);
  }

  private runPhases(ctx: MonthContext): MonthResult {
    for (const node of PhaseRegistry.nodes) {
      if ("kind" in node) {
        if (!node.run(ctx)) {
          return this.finish(ctx, true);
        }
        continue;
      }
      if (!this.assertPhase(ctx.phaseGuard, node, ctx.collector)) {
        return this.finish(ctx, false);
      }
      const outcome = node.run(ctx);
      if (outcome.status === "finish") {
        return this.finish(ctx, outcome.success);
      }
    }
    return this.finish(ctx, true);
  }

  private finish(ctx: MonthContext, success: boolean): MonthResult {
    const suspended = ctx.interruption?.suspended ?? trailingInputSuspension(ctx);
    return {
      finalSnapshot: ctx.currentSnapshot,
      commandLedger: ctx.commandLedger,
      eventLedger: ctx.eventLedger,
      randomLedger: ctx.randomLedger,
      financialLedger: ctx.financialLedger,
      success,
      outcome: suspended !== undefined ? "suspended" : "completed",
      ...(suspended !== undefined ? { suspended } : {}),
    };
  }

  private assertPhase(
    guard: PhaseGuard,
    phase: PhaseDescriptor,
    collector: DiagnosticCollector,
  ): boolean {
    const violations = guard.assert(phase.id, phase.footprint);
    for (const message of violations) {
      collector.addError(PHASE_ACCESS_DENIED, message, { stage: phase.id });
    }
    return violations.length === 0;
  }
}
