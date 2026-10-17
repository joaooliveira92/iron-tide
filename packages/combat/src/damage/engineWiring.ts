// DESIGN-41 entry point for damage resolution called from the minute-advance
// simulation. `resolveDamage` takes the current ship damage state + a list of
// gunnery impacts, runs the damage pipeline per impact, and returns the new
// state + collected damage events.
//
// GunneryImpact is the damage-facing slice of the B-3 gunnery GunneryEventRecord —
// what damage resolution needs from a hit. The record carries `outcome: "HIT" |
// "MISS"` and impactInputs (reserved); this type is the slice damage consumes.
//
// Pure/deterministic: no ambient I/O/clock/random except the caller-provided
// keyedRng function for deterministic randomness.

import { type ShipDamageState, computeDamageStateHash, assertFixedPointDamage } from "./state.js";
import { type PenetrationOutcome, type ArmorZoneType } from "./armorModel.js";
import { type SplinterIntensity } from "./componentDamage.js";
import {
  resolveComponentDamage,
  type ComponentDamageResult,
  type ComponentState,
} from "./componentDamage.js";
import {
  resolveStructureFlotation,
  type StructureFlotationResult,
  type StructureFlotationInput,
} from "./structureFlotation.js";
import { createDamageEventRecord, type DamageEventRecord } from "./eventRecord.js";
import { type FireSourceRecord, type FloodingSourceRecord } from "./state.js";
import { withDamageStateHash } from "./state.js";
import {
  evaluateFireCreation,
  evaluateFloodingCreation,
  type FireCreationInput,
  type FloodingCreationInput,
} from "./immediateFireFlooding.js";
import { evaluateMagazineHazard, type MagazineHazardInput } from "./magazineHazard.js";
import { evaluateTerminalSeam, type TerminalInput } from "./terminalSeam.js";

// GunneryImpact — the damage-relevant surface from a gunnery hit (the
// damage-facing slice of the B-3 GunneryEventRecord).

export interface GunneryImpact {
  /** Id of the shooter/firing battery. */
  sourceId: string;
  /** Id of the weapon that caused the impact. */
  weaponId: string;
  /** Id of the target ship. */
  targetShipId: string;
  /** Id of the hit location zone. */
  hitLocation: string;
  /** Penetration outcome from the armor model. */
  penetrationOutcome: PenetrationOutcome;
  /** Splinter intensity at the hit location. */
  splinterIntensity: SplinterIntensity;
  /** Effective resistance encountered (µm). */
  effectiveResistanceUm: number;
  /** Penetration margin (shell pen - effective resistance, µm). */
  penetrationMargin: number;
  /** Structural damage inflicted. */
  structuralDamage: number;
  /** Immediate flotation damage inflicted. */
  flotationDamage: number;
  // ---- INC-5: Fire, flooding, and terminal inputs ----
  /** Ship type for fire risk multiplier (e.g. "ORDINARY", "CARRIER"). */
  shipType: string;
  /** Whether the hit zone contains combustible material. */
  hasCombustible: boolean;
  /** Whether oxygen is available at the hit location. */
  hasOxygen: boolean;
  /** Whether the hit caused a hull breach (full penetration at/below waterline). */
  hullBreach: boolean;
  /** Whether there is an open water route to the sea from the hit compartment. */
  hasWaterRoute: boolean;
  /** Whether the hit zone contains a magazine/ammunition compartment. */
  hasMagazineInZone: boolean;
  /** Type of the hit zone (e.g. "BELT", "DECK", "MAGAZINE"). */
  hitZoneType: string;
  /** Whether the ship has suffered catastrophic structural breakup. */
  catastrophicBreakup: boolean;
  /** Whether the ship is at risk of capsizing. */
  capsizeRisk: boolean;
  /** Design (maximum) flotation reserve for percentage calculations. */
  designFlotationReserve: number;
  /** Design (maximum) stability score in basis points [0, 10_000]. */
  designStabilityScore: number;
}

// ShipDamageState augmentation required by the pipeline

/**
 * Extends ShipDamageState with per-component state tracking that the pipeline
 * needs. In this slice the component state is derived from the component id
 * list; later slices will track per-component damage states explicitly.
 */
export interface ShipDamageStateExtended extends ShipDamageState {
  /** Per-component damage outcomes keyed by component id. */
  componentStates?: Record<string, string>;
}

// resolveDamage — entry point

/**
 * Run damage resolution for a set of gunnery impacts against a ship's current
 * damage state.
 *
 * @param state - The current ShipDamageState.
 * @param impacts - Gunnery impacts to resolve (from B-3 gunnery).
 * @param battleMinute - The current battle minute.
 * @param substep - The current substep.
 * @param keyedRng - Deterministic RNG function keyed by stream name (optional).
 *   Required for fire/flooding creation and magazine hazard stages.
 * @returns The new ship state and collected damage events.
 */
export function resolveDamage(
  state: ShipDamageState,
  impacts: GunneryImpact[],
  battleMinute: number,
  substep: number,
  keyedRng?: (stream: string) => number,
): { newState: ShipDamageState; events: DamageEventRecord[] } {
  // Validate input state
  assertFixedPointDamage(state);

  // No-op path: if no impacts, return state unchanged
  if (impacts.length === 0) {
    // Ensure state hash is current (but return same reference if unchanged)
    const hash = computeDamageStateHash(state);
    if (state.stateHash === hash) {
      return { newState: state, events: [] };
    }
    return { newState: withDamageStateHash(state), events: [] };
  }

  // Accumulator for state mutations through the pipeline
  let currentState = { ...state };
  const events: DamageEventRecord[] = [];

  for (const impact of impacts) {
    // --- Stage 1: HIT_LOCATION (deferred to INC-3, use impact.hitLocation directly) ---
    const hitLocation = impact.hitLocation;

    // --- Stage 2: PROTECTION_INTERACTION (deferred to INC-3, use impact fields) ---
    const protectionInteraction = {
      effectiveResistanceUm: impact.effectiveResistanceUm,
      penetrationMargin: impact.penetrationMargin,
      outcome: impact.penetrationOutcome,
    };

    // --- Stage 3: LOCAL_COMPONENT_DAMAGE ---
    const components = buildComponentState(currentState);
    const componentEffects: ComponentDamageResult[] = resolveComponentDamage(
      components,
      hitLocation,
      impact.penetrationOutcome,
      impact.splinterIntensity,
    );

    // --- Stage 4: STRUCTURE_FLOTATION ---
    const sfInput: StructureFlotationInput = {
      structuralDamage: impact.structuralDamage,
      flotationDamage: impact.flotationDamage,
      currentStructuralIntegrity: currentState.structuralIntegrity,
      currentFlotationReserve: currentState.flotationReserve,
    };
    const sfResult: StructureFlotationResult = resolveStructureFlotation(sfInput);

    // Update current state with structure/flotation effects
    currentState = {
      ...currentState,
      structuralIntegrity: sfResult.structuralIntegrityAfter,
      flotationReserve: sfResult.flotationReserveAfter,
    };

    // --- Stage 5: IMMEDIATE_FIRE_FLOODING (§9) ---
    let createdFireSources: FireSourceRecord[] = [];
    let createdFloodingSources: FloodingSourceRecord[] = [];

    if (keyedRng) {
      // Evaluate fire creation
      const fireInput: FireCreationInput = {
        locationId: hitLocation,
        penetrationOutcome: impact.penetrationOutcome,
        hitZoneType: impact.hitZoneType,
        shipType: impact.shipType,
        hasCombustible: impact.hasCombustible,
        hasOxygen: impact.hasOxygen,
      };
      const fireSource = evaluateFireCreation(fireInput, keyedRng);
      if (fireSource) {
        createdFireSources = [fireSource];
      }

      // Evaluate flooding creation
      const floodInput: FloodingCreationInput = {
        compartmentId: hitLocation,
        penetrationOutcome: impact.penetrationOutcome,
        hullBreach: impact.hullBreach,
        hasWaterRoute: impact.hasWaterRoute,
      };
      const floodingSource = evaluateFloodingCreation(floodInput, keyedRng);
      if (floodingSource) {
        createdFloodingSources = [floodingSource];
      }
    }

    // --- Stage 6: SECONDARY_HAZARD (§10, magazine only) ---
    let secondaryStructuralDamage = 0;
    let secondaryFlotationDamage = 0;

    if (keyedRng) {
      const magInput: MagazineHazardInput = {
        hasMagazineInZone: impact.hasMagazineInZone,
        penetrationOutcome: impact.penetrationOutcome,
        hitZoneType: impact.hitZoneType,
      };
      const magResult = evaluateMagazineHazard(magInput, keyedRng);
      if (magResult.magazineDetonated) {
        secondaryStructuralDamage = magResult.structuralDamage;
        secondaryFlotationDamage = magResult.flotationDamage;

        // Apply secondary damage to state
        currentState = {
          ...currentState,
          structuralIntegrity: Math.max(
            0,
            currentState.structuralIntegrity - secondaryStructuralDamage,
          ),
          flotationReserve: Math.max(0, currentState.flotationReserve - secondaryFlotationDamage),
        };
      }
    }

    // --- Stage 7: STAGE_7_RESERVED (no-op, deferred) ---

    // --- Stage 8: TERMINAL_SEAM (§29-32) ---
    let terminalTransition: string | null = null;

    // Only evaluate terminal seam if RNG was provided (otherwise use basic check)
    if (currentState.terminalStatus === "NORMAL") {
      if (keyedRng) {
        // Compute flotation and stability percentages as bp of design values
        const flotationPct =
          impact.designFlotationReserve > 0
            ? Math.floor((currentState.flotationReserve * 10_000) / impact.designFlotationReserve)
            : 0;
        const stabilityPct =
          impact.designStabilityScore > 0
            ? Math.floor((currentState.stabilityScore * 10_000) / impact.designStabilityScore)
            : 0;

        const terminalInput: TerminalInput = {
          flotationReserveAfter: currentState.flotationReserve,
          structuralIntegrityAfter: currentState.structuralIntegrity,
          progressiveFloodingTotal: currentState.progressiveFloodingTotal,
          catastrophicBreakup: impact.catastrophicBreakup,
          capsizeRisk: impact.capsizeRisk,
          currentTerminalStatus: currentState.terminalStatus,
          flotationPct,
          stabilityPct,
        };

        const terminalResult = evaluateTerminalSeam(terminalInput);

        if (terminalResult.transition === "SINKING") {
          terminalTransition = "SINKING";
          currentState = { ...currentState, terminalStatus: "SINKING" };
        } else if (terminalResult.transition === "FOUNDERED") {
          terminalTransition = "FOUNDERED";
          currentState = { ...currentState, terminalStatus: "FOUNDERED" };
        }
      } else {
        // Fallback basic check when no RNG provided (DESIGN-41 §31: SINKING when flotation=0)
        if (currentState.flotationReserve <= 0) {
          terminalTransition = "SINKING";
          currentState = { ...currentState, terminalStatus: "SINKING" };
        }
      }
    }

    // --- Stage 9: DAMAGE_EVENT_RECORD ---
    const eventRecord = createDamageEventRecord({
      battleMinute,
      substep,
      sourceId: impact.sourceId,
      targetShipId: impact.targetShipId,
      causalWeaponId: impact.weaponId,
      hitLocation,
      protectionInteraction,
      componentEffects,
      structureFlotationEffects: sfResult,
      createdFireSources,
      createdFloodingSources,
      terminalTransition,
    });

    events.push(eventRecord);
  }

  // Finalize state with hash
  const newState = withDamageStateHash(currentState);

  return { newState, events };
}

/**
 * Build component state array from ShipDamageState for the pipeline.
 * Each component gets a default state with locationId derived from its id
 * prefix convention (e.g., "TURRET-1" → location "TURRET-1").
 * In a full implementation, component states would be stored explicitly.
 */
function buildComponentState(state: ShipDamageState): ComponentState[] {
  return state.components.map((id) => ({
    id,
    componentType: inferComponentType(id),
    locationId: inferLocationId(id),
    armorZoneType: inferArmorZoneType(id) as ArmorZoneType | undefined,
  }));
}

/**
 * Infer a component type from its id (convention-based).
 * E.g., "TURRET-1" → "TURRET", "ENGINE-1" → "ENGINE".
 */
function inferComponentType(id: string): string {
  const parts = id.split("-");
  return (parts.length > 0 ? parts[0] : id) ?? id;
}

/**
 * Infer the location id for a component.
 * For turrets, the location is the turret itself (it's both a component and a zone).
 * For other components, we look for a compartment association.
 * Convention: component id prefix matches its zone (e.g., TURRET-1 lives in TURRET-1 zone).
 */
function inferLocationId(id: string): string {
  return id;
}

/**
 * Infer armor zone type from component id.
 * TURRET-* → "TURRET_FACE"
 * ENGINE-* → no armor zone (internal)
 * RUDDER-* → no armor zone (internal)
 * FIRE_DIRECTOR-* → "SUPERSTRUCTURE"
 */
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
      return undefined; // internal component, not exposed
  }
}
