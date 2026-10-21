// The phase registry. Each phase module registers one `PhaseDescriptor` — its
// declared registry policy (read/writePermissions + rngAllowed), its
// authoritative runtime footprint ("reality", ADR-0036), and its body — and
// MonthExecutor runs every phase by iterating this registry in canonical
// order. The registry is the single dispatch seam: adding or gating a phase
// means adding or swapping one descriptor here, never editing MonthExecutor.
//
// The pipeline also has one pinned, non-phase control node: the interruption
// checkpoint between resolve_carrier_operations and battle_generation. It is
// deliberately NOT a registered phase (interruption.test.ts pins that).
import type { MonthContext } from "./monthContext.js";
import type { PhaseFootprint } from "./phase-resource.js";
import { runInterruptionCheckpoint } from "./interruption.js";
import { aircraftDevelopmentPhase } from "./aircraft.js";
import { constructionProcessingPhase } from "./constructionPhase.js";
import { aiProcurementPhase } from "./aiProcurement.js";
import { battleGenerationPhase, battleResolutionPhase } from "./battlePhases.js";
import { carrierOperationsPhase } from "./carrier-operations.js";
import { aiPlanningPhase, commandCollectionPhase } from "./commandPhases.js";
import { diplomacyPhase } from "./diplomacy.js";
import {
  appropriationPhase,
  maintenancePhase,
  monthlyRevenuePhase,
  obligationPhase,
} from "./economyPhases.js";
import { researchPhase } from "./research.js";
import { closingValidationPhase, openingValidationPhase } from "./validationPhases.js";
import { weatherGenerationPhase } from "./weatherPhase.js";

export interface PhaseDefinition {
  id: string;
  name: string;
  order: number;
  readPermissions: string[];
  writePermissions: string[];
  rngAllowed: boolean;
}

/**
 * Outcomes of running a phase body:
 * - `continue` — the month advances to the next node;
 * - `finish` — the month stops here, with the supplied `success` flag
 *   (opening_validation fails closed with `success: false`; a suspension from
 *   the interruption seam reports `success: true`, R-21).
 */
export type PhaseRunOutcome =
  | { readonly status: "continue" }
  | { readonly status: "finish"; readonly success: boolean };

/** A phase body: performs the phase's authoritative work against `ctx`. */
export interface PhaseRun {
  (ctx: MonthContext): PhaseRunOutcome;
}

/** The unit a phase module registers: the declared policy, the footprint, the body. */
export interface PhaseDescriptor extends PhaseDefinition {
  readonly footprint: PhaseFootprint;
  readonly run: PhaseRun;
}

/**
 * A non-phase pipeline node that gates control flow between two phases. It
 * carries an `order` rank like a phase so the whole pipeline sorts strictly
 * ascending; returning `false` stops the month with `success: true` (the month
 * suspended for an interruption input).
 */
export interface PhaseCheckpoint {
  readonly kind: "checkpoint";
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly run: (ctx: MonthContext) => boolean;
}

export type PhasePipelineNode = PhaseDescriptor | PhaseCheckpoint;

export class PhaseRegistry {
  /**
   * The canonical pipeline in execution order. Declaration order and the
   * monotonic integer `order` ranks are authoritative: reordering moves the
   * month's outcomes, so changes go through golden repinning (ADR-0007).
   */
  static readonly NODES: readonly PhasePipelineNode[] = [
    openingValidationPhase,
    weatherGenerationPhase,
    monthlyRevenuePhase,
    commandCollectionPhase,
    aiPlanningPhase,
    aiProcurementPhase,
    appropriationPhase,
    maintenancePhase,
    obligationPhase,
    constructionProcessingPhase,
    diplomacyPhase,
    researchPhase,
    aircraftDevelopmentPhase,
    carrierOperationsPhase,
    {
      kind: "checkpoint",
      id: "interruption_checkpoint",
      name: "Interruption Checkpoint",
      order: 74,
      run: (ctx) => runInterruptionCheckpoint(ctx),
    },
    battleGenerationPhase,
    battleResolutionPhase,
    closingValidationPhase,
  ];

  /** The seventeen registered phases (the checkpoint above is not a phase). */
  static readonly PHASES: readonly PhaseDescriptor[] = PhaseRegistry.NODES.filter(
    (node): node is PhaseDescriptor => !("kind" in node),
  );

  static get nodes(): readonly PhasePipelineNode[] {
    return PhaseRegistry.NODES;
  }

  static getById(id: string): PhaseDescriptor | undefined {
    return PhaseRegistry.PHASES.find((p) => p["id"] === id);
  }

  static getByOrder(order: number): PhaseDescriptor | undefined {
    return PhaseRegistry.PHASES.find((p) => p["order"] === order);
  }

  static get all(): readonly PhaseDescriptor[] {
    return PhaseRegistry.PHASES;
  }

  static hasAccess(
    phase: PhaseDefinition,
    resource: string,
    accessType: "read" | "write",
  ): boolean {
    const permissions =
      accessType === "read" ? phase["readPermissions"] : phase["writePermissions"];
    return permissions.includes("all") || permissions.includes(resource);
  }
}
