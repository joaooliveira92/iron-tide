// DESIGN-41 §3 10-stage damage-resolution pipeline. Each stage is a pure function that
// takes the current ShipDamageState + input packages and produces a DamageEventEffect
// (the effect contributed by that stage). Stages run in exact order; a stage failure
// rolls back the entire transaction, returning DAMAGE_RESOLUTION_FAILED.
//
// INC-5 wiring:
//   Stages 1-2 (HIT_LOCATION, PROTECTION_INTERACTION) — wired INC-3
//   Stage 3 (LOCAL_COMPONENT_DAMAGE), Stage 4 (STRUCTURE_FLOTATION), Stage 9 (DAMAGE_EVENT_RECORD) — wired INC-4
//   Stage 5 (IMMEDIATE_FIRE_FLOODING) — wired INC-5
//   Stage 6 (SECONDARY_HAZARD) — wired INC-5 (magazine hazard only)
//   Stage 8 (TERMINAL_SEAM) — wired INC-5
//   Stages 7, 10 — no-op placeholders (deferred)
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
import { type PenetrationOutcome, type ArmorZoneType } from "./armorModel.js";
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

// Pipeline context — the broader input needed by wired stages beyond state.

/**
 * Per-impact context that stages 1-9 read during a single pipeline run.
 * Filled incrementally as stages execute.
 */
export interface PipelineContext {
  /** Hit location zone id (set by HIT_LOCATION stage). */
  hitLocation: string;
  /** Penetration outcome (set by PROTECTION_INTERACTION stage). */
  penetrationOutcome: PenetrationOutcome;
  /** Splinter intensity at the hit location. */
  splinterIntensity: SplinterIntensity;
  /** Protection interaction record. */
  protectionInteraction: ProtectionInteractionRecord;
  /** Component damage results (set by LOCAL_COMPONENT_DAMAGE). */
  componentEffects: ComponentDamageResult[];
  /** Structure/flotation result (set by STRUCTURE_FLOTATION). */
  structureFlotationResult: StructureFlotationResult | null;
  /** Structural damage input. */
  structuralDamage: number;
  /** Flotation damage input. */
  flotationDamage: number;
  /** Created fire sources (set by IMMEDIATE_FIRE_FLOODING). */
  createdFireSources: FireSourceRecord[];
  /** Created flooding sources (set by IMMEDIATE_FIRE_FLOODING). */
  createdFloodingSources: FloodingSourceRecord[];
  /** Magazine hazard result (set by SECONDARY_HAZARD). */
  magazineHazardResult: MagazineHazardResult | null;
  /** Terminal transition (set by TERMINAL_SEAM). */
  terminalTransition: string | null;
  /** Terminal result (set by TERMINAL_SEAM). */
  terminalResult: TerminalResult | null;
  battleMinute: number;
  substep: number;
  sourceId: string;
  targetShipId: string;
  causalWeaponId: string;
  /** Hit input for HIT_LOCATION stage (optional — falls back to no-op if absent). */
  hitInput?: HitInput;
  /** Protection input for PROTECTION_INTERACTION stage (optional — falls back to no-op if absent). */
  protectionInput?: ProtectionInput;
  // ---- INC-5: Stage 5-6, 8 inputs ----
  /** Keyed RNG function for deterministic randomness (optional — falls back to no-op if absent). */
  keyedRng?: (stream: string) => number;
  /** Fire creation input for IMMEDIATE_FIRE_FLOODING stage (optional — falls back to no-op if absent). */
  fireCreationInput?: FireCreationInput;
  /** Flooding creation input for IMMEDIATE_FIRE_FLOODING stage (optional — falls back to no-op if absent). */
  floodingCreationInput?: FloodingCreationInput;
  /** Magazine hazard input for SECONDARY_HAZARD stage (optional — falls back to no-op if absent). */
  magazineHazardInput?: MagazineHazardInput;
  /** Terminal seam input for TERMINAL_SEAM stage (optional — falls back to no-op if absent). */
  terminalInput?: TerminalInput;
}

// Transaction result

/**
 * Outcome of running a single damage-resolution transaction (all 10 stages).
 */
export interface DamageResolutionTransaction {
  /** Whether the transaction completed successfully. */
  success: boolean;
  /** The state after processing (if success) or the original state (if rolled back). */
  state: ShipDamageState;
  /** The collected effects from each stage if successful, indexed by stage name. */
  stageEffects: Partial<Record<DamagePipelineStage, DamageEventEffect>>;
  /** Error reason if the transaction failed. */
  error?: string;
  /** The damage event record if DAMAGE_EVENT_RECORD stage completed. */
  eventRecord?: DamageEventRecord;
}

// Stage effects

/**
 * The immutable effect contributed by one pipeline stage.
 */
export interface DamageEventEffect {
  /** Whether this stage completed without error. */
  ok: boolean;
  /** Human-readable description of the effect (explanatory, never authoritative). */
  description: string;
  /** Error code if the stage failed. */
  errorCode?: string;
  /** The damage event record produced by DAMAGE_EVENT_RECORD stage. */
  record?: DamageEventRecord;
}

// Stage-runner type — signature expanded to pass pipeline context

/**
 * Stage runner function type. Takes the stage name, current state, stage index,
 * and the accumulated pipeline context, and produces a DamageEventEffect.
 */
export type StageRunner = (
  stage: DamagePipelineStage,
  state: ShipDamageState,
  stageIndex: number,
  context: PipelineContext,
) => DamageEventEffect;

// Default pipeline runner with wired stages 3, 4, 5, 6, 8, and 9.

/**
 * Run a single damage pipeline stage.
 * Stages 1-2 wired in INC-3, stages 3-4 wired in INC-4, stages 5/6/8 wired in INC-5.
 * Stages 7 and 10 are no-op placeholders (deferred).
 *
 * @param stage - The pipeline stage to run.
 * @param state - The current ShipDamageState.
 * @param _stageIndex - The stage index (unused in this slice).
 * @param context - The accumulated pipeline context.
 * @returns A DamageEventEffect for this stage.
 */
export function runDamagePipeline(
  stage: DamagePipelineStage,
  state: ShipDamageState,
  _stageIndex: number,
  context: PipelineContext,
): DamageEventEffect {
  switch (stage) {
    // Stage 1: Hit location — resolve compartment and zone from geometry
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

    // Stage 2: Protection interaction — armor resistance vs projectile
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

    // Stage 3: Local component damage
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

    // Stage 4: Structure and flotation damage
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

    // Stage 5: Immediate fire & flooding creation (DESIGN-41 §9)
    case "IMMEDIATE_FIRE_FLOODING": {
      if (!context.keyedRng) {
        return {
          ok: true,
          description: "empty (no-op) stage (no keyedRng provided)",
        };
      }

      // Fire creation
      if (context.fireCreationInput) {
        const fireSource = evaluateFireCreation(context.fireCreationInput, context.keyedRng);
        if (fireSource) {
          context.createdFireSources = [fireSource];
        }
      }

      // Flooding creation
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

    // Stage 6: Secondary hazard — magazine/ammunition (DESIGN-41 §10)
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

    // Stage 7: Reserved (no-op, deferred to M3)
    case "STAGE_7_RESERVED":
      return {
        ok: true,
        description: "empty (no-op) stage",
      };

    // Stage 8: Terminal seam — SINKING / FOUNDERED detection (DESIGN-41 §29-32)
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

    // Stage 9: Damage event record
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

    // Stage 10: Reserved (no-op, deferred)
    case "STAGE_10_RESERVED":
      return {
        ok: true,
        description: "empty (no-op) stage",
      };
  }
}

/**
 * Run the full 10-stage pipeline in exact order.
 * - If any stage fails, the original state is returned unchanged (rollback) and the
 *   transaction carries success: false + DAMAGE_RESOLUTION_FAILED.
 * - All empty/no-op stages produce a successful empty record (no-skip rule).
 *
 * @param state - The input ShipDamageState
 * @param context - The pipeline context (impact-specific input)
 * @param stageRunner - The stage runner function (defaults to runDamagePipeline)
 * @returns A DamageResolutionTransaction
 */
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
      // Full transaction rollback — return the original state unchanged.
      return {
        success: false,
        state: originalState,
        stageEffects,
        error: effect.errorCode ?? "DAMAGE_RESOLUTION_FAILED",
      };
    }

    // Capture the event record from the DAMAGE_EVENT_RECORD stage
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

/**
 * Build component state array from a list of component ids.
 */
function buildComponentStateFromIds(componentIds: readonly string[]): ComponentState[] {
  return componentIds.map((id) => ({
    id,
    componentType: inferComponentType(id),
    locationId: inferLocationId(id),
    armorZoneType: inferArmorZoneType(id) as ArmorZoneType | undefined,
  }));
}

function inferComponentType(id: string): string {
  const parts = id.split("-");
  return (parts.length > 0 ? parts[0] : id) ?? id;
}

function inferLocationId(id: string): string {
  return id;
}

function inferArmorZoneType(id: string): string | undefined {
  const prefix = id.split("-")[0];
  switch (prefix) {
    case "TURRET":
      return "TURRET_FACE";
    case "BARBETTE":
      return "BARBETTE";
    case "CONNING":
      return "CONNING_TOWER";
    case "AA":
    case "DIRECTOR":
    case "RANGEFINDER":
      return "SUPERSTRUCTURE";
    default:
      return undefined;
  }
}

// ---- Re-export for backwards compatibility with existing test imports ----
// The previous simple StageRunner (without context) is kept as a wrapper for
// backward-compatible no-op usage.
export type SimpleStageRunner = (
  stage: DamagePipelineStage,
  state: ShipDamageState,
  stageIndex: number,
) => DamageEventEffect;

/**
 * Wrap a SimpleStageRunner into a StageRunner by ignoring context.
 * Used for backward compatibility with non-wired stage runners.
 */
export function wrapSimpleRunner(simple: SimpleStageRunner): StageRunner {
  return (stage, state, stageIndex, _context) => simple(stage, state, stageIndex);
}
