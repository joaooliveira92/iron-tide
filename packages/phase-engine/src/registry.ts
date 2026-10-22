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

export type PhaseRunOutcome =
  | { readonly status: "continue" }
  | { readonly status: "finish"; readonly success: boolean };

export interface PhaseRun {
  (ctx: MonthContext): PhaseRunOutcome;
}

export interface PhaseDescriptor extends PhaseDefinition {
  readonly footprint: PhaseFootprint;
  readonly run: PhaseRun;
}

export interface PhaseCheckpoint {
  readonly kind: "checkpoint";
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly run: (ctx: MonthContext) => boolean;
}

export type PhasePipelineNode = PhaseDescriptor | PhaseCheckpoint;

export class PhaseRegistry {
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
