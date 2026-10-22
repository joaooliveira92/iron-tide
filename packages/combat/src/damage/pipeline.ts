import { isBluewaveError } from "@bluewave/contracts";
import { type ShipDamageState, type FireSourceRecord, type FloodingSourceRecord } from "./state.js";
import { DAMAGE_PIPELINE_STAGES, type DamagePipelineStage } from "./constants.js";
import {
  type ComponentState,
  type ComponentDamageResult,
  resolveComponentDamage,
  type SplinterIntensity,
} from "./componentDamage.js";
import {
  type StructureFlotationResult,
  type StructureFlotationInput,
  resolveStructureFlotation,
} from "./structureFlotation.js";
import {
  type DamageEventRecord,
  type ProtectionInteractionRecord,
  createDamageEventRecord,
} from "./eventRecord.js";
import { type PenetrationOutcome, inferArmorZoneType } from "./armorModel.js";
import { resolveHitLocation, type HitInput } from "./hitLocation.js";
import { resolveProtectionInteraction, type ProtectionInput } from "./protectionInteraction.js";
import {
  evaluateFireCreation,
  evaluateFloodingCreation,
  type FireCreationInput,
  type FloodingCreationInput,
} from "./immediateFireFlooding.js";
import {
  evaluateMagazineHazard,
  type MagazineHazardInput,
  type MagazineHazardResult,
} from "./magazineHazard.js";
import { evaluateTerminalSeam, type TerminalInput, type TerminalResult } from "./terminalSeam.js";

export interface PipelineContext {
  hitLocation: string;
  penetrationOutcome: PenetrationOutcome;
  splinterIntensity: SplinterIntensity;
  protectionInteraction: ProtectionInteractionRecord;
  componentEffects: ComponentDamageResult[];
  structureFlotationResult: StructureFlotationResult | null;
  structuralDamage: number;
  flotationDamage: number;
  createdFireSources: FireSourceRecord[];
  createdFloodingSources: FloodingSourceRecord[];
  magazineHazardResult: MagazineHazardResult | null;
  terminalTransition: string | null;
  terminalResult: TerminalResult | null;
  battleMinute: number;
  substep: number;
  sourceId: string;
  targetShipId: string;
  causalWeaponId: string;
  hitInput?: HitInput;
  protectionInput?: ProtectionInput;
  keyedRng?: (stream: string) => number;
  fireCreationInput?: FireCreationInput;
  floodingCreationInput?: FloodingCreationInput;
  magazineHazardInput?: MagazineHazardInput;
  terminalInput?: TerminalInput;
}

export interface DamageResolutionTransaction {
  success: boolean;
  state: ShipDamageState;
  stageEffects: Partial<Record<DamagePipelineStage, DamageEventEffect>>;
  error?: string;
  eventRecord?: DamageEventRecord;
}

export interface DamageEventEffect {
  ok: boolean;
  description: string;
  errorCode?: string;
  record?: DamageEventRecord;
}

export type StageRunner = (
  stage: DamagePipelineStage,
  state: ShipDamageState,
  stageIndex: number,
  context: PipelineContext,
) => DamageEventEffect;

export function runDamagePipeline(
  stage: DamagePipelineStage,
  state: ShipDamageState,
  _stageIndex: number,
  context: PipelineContext,
): DamageEventEffect {
  switch (stage) {
    case "HIT_LOCATION": {
      if (!context.hitInput) {
        return {
          ok: true,
          description: "empty (no-op) stage",
        };
      }
      try {
        const hitResult = resolveHitLocation(context.hitInput);
        context.hitLocation = hitResult.hitZoneId;
        return {
          ok: true,
          description: `hit resolved: compartment=${hitResult.primaryCompartmentId}, zone=${hitResult.hitZoneId} (${hitResult.hitZoneType})`,
        };
      } catch (e) {
        if (isBluewaveError(e)) {
          return { ok: false, description: e.message, errorCode: e.message };
        }
        throw e;
      }
    }

    case "PROTECTION_INTERACTION": {
      if (!context.protectionInput) {
        return {
          ok: true,
          description: "empty (no-op) stage",
        };
      }
      try {
        const protResult = resolveProtectionInteraction(context.protectionInput);
        context.penetrationOutcome = protResult.outcome;
        context.protectionInteraction = {
          effectiveResistanceUm: protResult.effectiveResistanceUm,
          penetrationMargin: protResult.penetrationMargin,
          outcome: protResult.outcome,
        };
        return {
          ok: true,
          description: `protection resolved: outcome=${protResult.outcome}, margin=${protResult.penetrationMargin}µm`,
        };
      } catch (e) {
        if (isBluewaveError(e)) {
          return { ok: false, description: e.message, errorCode: e.message };
        }
        throw e;
      }
    }

    case "LOCAL_COMPONENT_DAMAGE": {
      const components = buildComponentStateFromIds(state.components);
      const componentEffects = resolveComponentDamage(
        components,
        context.hitLocation,
        context.penetrationOutcome,
        context.splinterIntensity,
      );
      context.componentEffects = componentEffects;
      return {
        ok: true,
        description: `component damage resolved: ${componentEffects.length} components affected`,
      };
    }

    case "STRUCTURE_FLOTATION": {
      const sfInput: StructureFlotationInput = {
        structuralDamage: context.structuralDamage,
        flotationDamage: context.flotationDamage,
        currentStructuralIntegrity: state.structuralIntegrity,
        currentFlotationReserve: state.flotationReserve,
      };
      const sfResult = resolveStructureFlotation(sfInput);
      context.structureFlotationResult = sfResult;
      return {
        ok: true,
        description: `structure/flotation: structural=${sfResult.structuralIntegrityAfter}, flotation=${sfResult.flotationReserveAfter}`,
      };
    }

    case "IMMEDIATE_FIRE_FLOODING": {
      if (!context.keyedRng) {
        return {
          ok: true,
          description: "empty (no-op) stage (no keyedRng provided)",
        };
      }

      if (context.fireCreationInput) {
        const fireSource = evaluateFireCreation(context.fireCreationInput, context.keyedRng);
        if (fireSource) {
          context.createdFireSources = [fireSource];
        }
      }

      if (context.floodingCreationInput) {
        const floodingSource = evaluateFloodingCreation(
          context.floodingCreationInput,
          context.keyedRng,
        );
        if (floodingSource) {
          context.createdFloodingSources = [floodingSource];
        }
      }

      const fireDesc =
        context.createdFireSources.length > 0
          ? `fire created at ${context.createdFireSources[0]!.locationId}`
          : "no fire";
      const floodDesc =
        context.createdFloodingSources.length > 0
          ? `flooding created at ${context.createdFloodingSources[0]!.compartmentId}`
          : "no flooding";

      return {
        ok: true,
        description: `immediate fire/flooding: ${fireDesc}, ${floodDesc}`,
      };
    }

    case "SECONDARY_HAZARD": {
      if (!context.keyedRng) {
        return {
          ok: true,
          description: "empty (no-op) stage (no keyedRng provided)",
        };
      }

      if (!context.magazineHazardInput) {
        return {
          ok: true,
          description: "empty (no-op) stage (no magazineHazardInput provided)",
        };
      }

      const hazardResult = evaluateMagazineHazard(context.magazineHazardInput, context.keyedRng);
      context.magazineHazardResult = hazardResult;

      if (hazardResult.magazineDetonated) {
        return {
          ok: true,
          description: `magazine detonated: structural=${hazardResult.structuralDamage}, flotation=${hazardResult.flotationDamage}`,
        };
      }

      return {
        ok: true,
        description: "no secondary hazard",
      };
    }

    case "STAGE_7_RESERVED":
      return {
        ok: true,
        description: "empty (no-op) stage",
      };

    case "TERMINAL_SEAM": {
      if (!context.terminalInput) {
        return {
          ok: true,
          description: "empty (no-op) stage (no terminalInput provided)",
        };
      }

      const terminalResult = evaluateTerminalSeam(context.terminalInput);
      context.terminalResult = terminalResult;

      if (terminalResult.transition === "SINKING") {
        context.terminalTransition = "SINKING";
        return {
          ok: true,
          description: `terminal transition: SINKING (duration=${terminalResult.sinkingDurationMinutes}min)`,
        };
      }

      if (terminalResult.transition === "FOUNDERED") {
        context.terminalTransition = "FOUNDERED";
        return {
          ok: true,
          description: "terminal transition: FOUNDERED",
        };
      }

      return {
        ok: true,
        description: "no terminal transition",
      };
    }

    case "DAMAGE_EVENT_RECORD": {
      const sfResult = context.structureFlotationResult ?? {
        structuralIntegrityAfter: state.structuralIntegrity,
        flotationReserveAfter: state.flotationReserve,
        uncappedStructuralDamage: 0,
        uncappedFlotationDamage: 0,
      };

      const eventRecord = createDamageEventRecord({
        battleMinute: context.battleMinute,
        substep: context.substep,
        sourceId: context.sourceId,
        targetShipId: context.targetShipId,
        causalWeaponId: context.causalWeaponId,
        hitLocation: context.hitLocation,
        protectionInteraction: context.protectionInteraction,
        componentEffects: context.componentEffects,
        structureFlotationEffects: sfResult,
        createdFireSources: context.createdFireSources,
        createdFloodingSources: context.createdFloodingSources,
        terminalTransition: context.terminalTransition,
      });

      return {
        ok: true,
        description: "damage event record created",
        record: eventRecord,
      };
    }

    case "STAGE_10_RESERVED":
      return {
        ok: true,
        description: "empty (no-op) stage",
      };
  }
}

export function orchestrateDamagePipeline(
  state: ShipDamageState,
  context: PipelineContext,
  stageRunner: StageRunner = runDamagePipeline,
): DamageResolutionTransaction {
  const stageEffects: Partial<Record<DamagePipelineStage, DamageEventEffect>> = {};
  const originalState = state;
  let lastEventRecord: DamageEventRecord | undefined;

  for (const stage of DAMAGE_PIPELINE_STAGES) {
    const effect = stageRunner(stage, state, DAMAGE_PIPELINE_STAGES.indexOf(stage), context);

    if (!effect.ok) {
      return {
        success: false,
        state: originalState,
        stageEffects,
        error: effect.errorCode ?? "DAMAGE_RESOLUTION_FAILED",
      };
    }

    if (stage === "DAMAGE_EVENT_RECORD" && effect.record) {
      lastEventRecord = effect.record;
    }

    stageEffects[stage] = effect;
  }

  return {
    success: true,
    state,
    stageEffects,
    eventRecord: lastEventRecord,
  };
}

function buildComponentStateFromIds(componentIds: readonly string[]): ComponentState[] {
  return componentIds.map((id) => ({
    id,
    componentType: inferComponentType(id),
    locationId: inferLocationId(id),
    armorZoneType: inferArmorZoneType(id),
  }));
}

function inferComponentType(id: string): string {
  const parts = id.split("-");
  return (parts.length > 0 ? parts[0] : id) ?? id;
}

function inferLocationId(id: string): string {
  return id;
}

export type SimpleStageRunner = (
  stage: DamagePipelineStage,
  state: ShipDamageState,
  stageIndex: number,
) => DamageEventEffect;

export function wrapSimpleRunner(simple: SimpleStageRunner): StageRunner {
  return (stage, state, stageIndex, _context) => simple(stage, state, stageIndex);
}
