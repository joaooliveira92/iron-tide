// MonthExecutor: the strategic month pipeline orchestrator. It owns the phase
// registry guard, the shared run context, and the canonical phase order; each
// phase body lives in its own focused module.
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
import { resolveAircraftDevelopment } from "./aircraft.js";
import { runBattleGenerationPhase, runBattleResolutionPhase } from "./battlePhases.js";
import { resolveCarrierOperations } from "./carrier-operations.js";
import { runAiPlanningPhase, runCommandCollectionPhase } from "./commandPhases.js";
import { runAiProcurementPhase } from "./aiProcurement.js";
import { runConstructionProcessingPhase } from "./constructionPhase.js";
import { resolveDiplomacyPhase } from "./diplomacy.js";
import {
  runAppropriationPhase,
  runMaintenancePhase,
  runMonthlyRevenuePhase,
  runObligationPhase,
} from "./economyPhases.js";
import { FinancialLedger } from "./financial-ledger.js";
import {
  createInterruptionState,
  runInterruptionCheckpoint,
  trailingInputSuspension,
} from "./interruption.js";
import {
  PLAYER_NATION_UNKNOWN,
  type MonthContext,
  MonthExecutorEngineOptions,
  MonthResult,
  StrategicWeatherPhaseOptions,
} from "./monthContext.js";
import { PHASE_ACCESS_DENIED, PHASE_FOOTPRINTS, PhaseGuard } from "./phase-guard.js";
import { runBaseLimitStep } from "./baseLimits.js";
import { runForeignStationDeploymentStep } from "./foreignStationDeployment.js";
import { runPresenceMeasurementStep } from "./presenceMeasurement.js";
import { resolveResearchPhase } from "./research.js";
import { cloneSnapshot } from "./snapshotClone.js";
import { runClosingValidationPhase, runOpeningValidationPhase } from "./validationPhases.js";
import { runWeatherGenerationPhase } from "./weatherPhase.js";

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

    if (!this.assertPhase(phaseGuard, "opening_validation", collector)) {
      return this.finish(ctx, false);
    }
    if (!runOpeningValidationPhase(ctx.currentSnapshot, collector)) {
      return this.finish(ctx, false);
    }

    if (!this.assertPhase(phaseGuard, "weather_generation", collector)) {
      return this.finish(ctx, false);
    }
    runWeatherGenerationPhase(ctx);

    if (!this.assertPhase(phaseGuard, "monthly_revenue", collector)) {
      return this.finish(ctx, false);
    }
    runMonthlyRevenuePhase(ctx);

    if (!this.assertPhase(phaseGuard, "command_collection", collector)) {
      return this.finish(ctx, false);
    }
    runCommandCollectionPhase(ctx);

    if (!this.assertPhase(phaseGuard, "ai_planning", collector)) {
      return this.finish(ctx, false);
    }
    runAiPlanningPhase(ctx);

    if (!this.assertPhase(phaseGuard, "ai_procurement", collector)) {
      return this.finish(ctx, false);
    }
    runAiProcurementPhase(ctx);

    if (!this.assertPhase(phaseGuard, "appropriation", collector)) {
      return this.finish(ctx, false);
    }
    runAppropriationPhase(ctx);

    if (!this.assertPhase(phaseGuard, "maintenance", collector)) {
      return this.finish(ctx, false);
    }
    runMaintenancePhase(ctx);

    if (!this.assertPhase(phaseGuard, "obligation", collector)) {
      return this.finish(ctx, false);
    }
    runObligationPhase(ctx);

    if (!this.assertPhase(phaseGuard, "construction_processing", collector)) {
      return this.finish(ctx, false);
    }
    runConstructionProcessingPhase(ctx);

    if (!this.assertPhase(phaseGuard, "resolve_diplomacy", collector)) {
      return this.finish(ctx, false);
    }
    ctx.currentSnapshot = resolveDiplomacyPhase(ctx.currentSnapshot, ctx.campaignMonth);

    if (!this.assertPhase(phaseGuard, "resolve_research", collector)) {
      return this.finish(ctx, false);
    }
    ctx.currentSnapshot = resolveResearchPhase(
      ctx.currentSnapshot,
      randomSeed,
      ctx.turnNumber,
      randomLedger,
      eventLedger,
      financialLedger,
      collector,
      ctx.nextSeq,
      campaignMonth,
    );

    // Phase 7.2: resolve_aircraft_development (after resolve_research, before
    // battle_generation). D-1: per-nation aircraft development pipeline
    // (DESIGN-43 §§4-12). Strict no-op when no nation has aviation tech.
    if (!this.assertPhase(phaseGuard, "resolve_aircraft_development", collector)) {
      return this.finish(ctx, false);
    }
    const aircraftRng = phaseGuard.rng("resolve_aircraft_development", randomSeed);
    if (aircraftRng) {
      const result = resolveAircraftDevelopment({
        snapshot: ctx.currentSnapshot,
        campaignMonth,
        rngStream: aircraftRng.stream("aircraft/development"),
      });
      ctx.currentSnapshot = result.snapshot;
    }

    // Phase 7.3: resolve_carrier_operations (after resolve_aircraft_development,
    // before battle_generation). D-2: per-nation carrier operations pipeline
    // (DESIGN-44). Strict no-op when no nation has carrier-capable ships.
    if (!this.assertPhase(phaseGuard, "resolve_carrier_operations", collector)) {
      return this.finish(ctx, false);
    }
    const carrierRng = phaseGuard.rng("resolve_carrier_operations", randomSeed);
    if (carrierRng) {
      const result = resolveCarrierOperations({
        snapshot: ctx.currentSnapshot,
        campaignMonth,
        rngStream: carrierRng.stream("carrier/operations"),
      });
      ctx.currentSnapshot = result.snapshot;
    }

    // Additive decision checkpoint: consume any pending decisions in
    // deterministic (phase, subject) order before battles resolve. A no-op when
    // no interruption channel was supplied (byte-identical to today).
    if (!runInterruptionCheckpoint(ctx)) {
      return this.finish(ctx, true);
    }

    if (!this.assertPhase(phaseGuard, "battle_generation", collector)) {
      return this.finish(ctx, false);
    }
    runBattleGenerationPhase(ctx);

    if (!this.assertPhase(phaseGuard, "battle_resolution", collector)) {
      return this.finish(ctx, false);
    }
    runBattleResolutionPhase(ctx);
    if (ctx.interruption?.suspended !== undefined) {
      return this.finish(ctx, true);
    }

    // S-5 month-end step (spec #73 R5/R6): presence is measured after movement and battle resolution, so it is part of the
    // battle_resolution footprint. Dormant (a strict no-op) unless the pack authors the presence ruleset section.
    runForeignStationDeploymentStep(ctx, runPresenceMeasurementStep(ctx));
    // S-5 08 (spec #73 R10): base limits are checked last, so battles this month saw the full fleet. Dormant without the block.
    runBaseLimitStep(ctx);

    if (!this.assertPhase(phaseGuard, "closing_validation", collector)) {
      return this.finish(ctx, false);
    }
    const closingOk = runClosingValidationPhase(ctx.currentSnapshot, collector);
    return this.finish(ctx, closingOk);
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

  /**
   * ADR-0036: enforce the phase registry contract at runtime. Asserts the
   * phase's authoritative footprint against its registry-declared
   * read/writePermissions + rngAllowed. On any violation, records a stable
   * PHASE_ACCESS_DENIED diagnostic and returns false — the caller fails the
   * phase closed (the phase body does not run).
   */
  private assertPhase(guard: PhaseGuard, phaseId: string, collector: DiagnosticCollector): boolean {
    const footprint = PHASE_FOOTPRINTS[phaseId];
    const violations =
      footprint === undefined
        ? [`phase "${phaseId}" has no registered runtime footprint`]
        : guard.assert(phaseId, footprint);
    for (const message of violations) {
      collector.addError(PHASE_ACCESS_DENIED, message, { stage: phaseId });
    }
    return violations.length === 0;
  }
}
