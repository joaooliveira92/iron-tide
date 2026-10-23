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
  type MonthResult,
  type StrategicWeatherPhaseOptions,
} from "./monthContext.js";
import { monthPipeline } from "./phases.js";
import type { MonthExecutorEngineOptions, MonthRunState } from "./pipeline.js";
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
    if (snapshot["careerResult"] !== undefined) return this.careerEnded(snapshot);

    const commandLedger = new CommandLedger();
    const eventLedger = new EventLedger();
    const randomLedger = new RandomLedger();
    const financialLedger = new FinancialLedger();

    let eventSeq = 0;
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      snapshot["turnNumber"] as number,
    );

    const state: MonthRunState = {
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

    if (state.playerNationId !== undefined && !snapshot["nations"].has(state.playerNationId)) {
      collector.addError(
        PLAYER_NATION_UNKNOWN,
        `Player nation '${state.playerNationId}' is not a nation of this campaign`,
        { stage: "player_nation", entityId: state.playerNationId },
      );
      return this.finish(state, false);
    }

    return this.finish(state, monthPipeline.run(state, engineOptions?.phaseOverrides));
  }

  private careerEnded(snapshot: CampaignSnapshot): MonthResult {
    return {
      finalSnapshot: snapshot,
      commandLedger: new CommandLedger(),
      eventLedger: new EventLedger(),
      randomLedger: new RandomLedger(),
      financialLedger: new FinancialLedger(),
      success: false,
      outcome: "career_ended",
    };
  }

  private finish(state: MonthRunState, success: boolean): MonthResult {
    const suspended = state.interruption?.suspended ?? trailingInputSuspension(state.interruption);
    return {
      finalSnapshot: state.currentSnapshot,
      commandLedger: state.commandLedger,
      eventLedger: state.eventLedger,
      randomLedger: state.randomLedger,
      financialLedger: state.financialLedger,
      success,
      outcome: suspended !== undefined ? "suspended" : "completed",
      ...(suspended !== undefined ? { suspended } : {}),
    };
  }
}
