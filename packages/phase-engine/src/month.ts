// packages/phase-engine/src/month.ts
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
import type {
  MonthContext,
  MonthExecutorEngineOptions,
  MonthResult,
  StrategicWeatherPhaseOptions,
} from "./monthContext.js";
import { PHASE_ACCESS_DENIED, PHASE_FOOTPRINTS, PhaseGuard } from "./phase-guard.js";
import { resolveResearchPhase } from "./research.js";
import { cloneSnapshot } from "./snapshotClone.js";
import { runClosingValidationPhase, runOpeningValidationPhase } from "./validationPhases.js";
import { runWeatherGenerationPhase } from "./weatherPhase.js";

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
      nextSeq: () => {
        const current = SafeInt(eventSeq);
        eventSeq++;
        return current;
      },
    };

    // Phase 1: opening_validation
    if (!this.assertPhase(phaseGuard, "opening_validation", collector)) {
      return this.finish(ctx, false);
    }
    if (!runOpeningValidationPhase(ctx.currentSnapshot, collector)) {
      return this.finish(ctx, false);
    }

    // Phase 1.5: weather_generation
    if (!this.assertPhase(phaseGuard, "weather_generation", collector)) {
      return this.finish(ctx, false);
    }
    runWeatherGenerationPhase(ctx);

    // Phase 2: monthly_revenue
    if (!this.assertPhase(phaseGuard, "monthly_revenue", collector)) {
      return this.finish(ctx, false);
    }
    runMonthlyRevenuePhase(ctx);

    // Phase 3: command_collection
    if (!this.assertPhase(phaseGuard, "command_collection", collector)) {
      return this.finish(ctx, false);
    }
    runCommandCollectionPhase(ctx);

    // Phase 3.5: ai_planning
    if (!this.assertPhase(phaseGuard, "ai_planning", collector)) {
      return this.finish(ctx, false);
    }
    runAiPlanningPhase(ctx);

    // Phase 3.6: ai_procurement
    if (!this.assertPhase(phaseGuard, "ai_procurement", collector)) {
      return this.finish(ctx, false);
    }
    runAiProcurementPhase(ctx);

    // Phase 4: appropriation
    if (!this.assertPhase(phaseGuard, "appropriation", collector)) {
      return this.finish(ctx, false);
    }
    runAppropriationPhase(ctx);

    // Phase 5: maintenance
    if (!this.assertPhase(phaseGuard, "maintenance", collector)) {
      return this.finish(ctx, false);
    }
    runMaintenancePhase(ctx);

    // Phase 6: obligation
    if (!this.assertPhase(phaseGuard, "obligation", collector)) {
      return this.finish(ctx, false);
    }
    runObligationPhase(ctx);

    // Phase 7: construction_processing
    if (!this.assertPhase(phaseGuard, "construction_processing", collector)) {
      return this.finish(ctx, false);
    }
    runConstructionProcessingPhase(ctx);

    // Phase 8: resolve_diplomacy
    if (!this.assertPhase(phaseGuard, "resolve_diplomacy", collector)) {
      return this.finish(ctx, false);
    }
    ctx.currentSnapshot = resolveDiplomacyPhase(ctx.currentSnapshot, ctx.campaignMonth);

    // Phase 9: resolve_research
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

    // Phase 9.5: battle_generation
    if (!this.assertPhase(phaseGuard, "battle_generation", collector)) {
      return this.finish(ctx, false);
    }
    runBattleGenerationPhase(ctx);

    // Phase 10: battle_resolution
    if (!this.assertPhase(phaseGuard, "battle_resolution", collector)) {
      return this.finish(ctx, false);
    }
    runBattleResolutionPhase(ctx);

    // Phase 11: closing_validation
    if (!this.assertPhase(phaseGuard, "closing_validation", collector)) {
      return this.finish(ctx, false);
    }
    const closingOk = runClosingValidationPhase(ctx.currentSnapshot, collector);
    return this.finish(ctx, closingOk);
  }

  private finish(ctx: MonthContext, success: boolean): MonthResult {
    return {
      finalSnapshot: ctx.currentSnapshot,
      commandLedger: ctx.commandLedger,
      eventLedger: ctx.eventLedger,
      randomLedger: ctx.randomLedger,
      financialLedger: ctx.financialLedger,
      success,
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
