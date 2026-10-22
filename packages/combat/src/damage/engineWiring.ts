import { type ShipDamageState, computeDamageStateHash, assertFixedPointDamage } from "./state.js";
import { type PenetrationOutcome, inferArmorZoneType } from "./armorModel.js";
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

export interface GunneryImpact {
  sourceId: string;
  weaponId: string;
  targetShipId: string;
  hitLocation: string;
  penetrationOutcome: PenetrationOutcome;
  splinterIntensity: SplinterIntensity;
  effectiveResistanceUm: number;
  penetrationMargin: number;
  structuralDamage: number;
  flotationDamage: number;
  shipType: string;
  hasCombustible: boolean;
  hasOxygen: boolean;
  hullBreach: boolean;
  hasWaterRoute: boolean;
  hasMagazineInZone: boolean;
  hitZoneType: string;
  catastrophicBreakup: boolean;
  capsizeRisk: boolean;
  designFlotationReserve: number;
  designStabilityScore: number;
}

export interface ShipDamageStateExtended extends ShipDamageState {
  componentStates?: Record<string, string>;
}

export function resolveDamage(
  state: ShipDamageState,
  impacts: GunneryImpact[],
  battleMinute: number,
  substep: number,
  keyedRng?: (stream: string) => number,
): { newState: ShipDamageState; events: DamageEventRecord[] } {
  assertFixedPointDamage(state);

  if (impacts.length === 0) {
    const hash = computeDamageStateHash(state);
    if (state.stateHash === hash) {
      return { newState: state, events: [] };
    }
    return { newState: withDamageStateHash(state), events: [] };
  }

  let currentState = { ...state };
  const events: DamageEventRecord[] = [];

  for (const impact of impacts) {
    const hitLocation = impact.hitLocation;

    const protectionInteraction = {
      effectiveResistanceUm: impact.effectiveResistanceUm,
      penetrationMargin: impact.penetrationMargin,
      outcome: impact.penetrationOutcome,
    };

    const components = buildComponentState(currentState);
    const componentEffects: ComponentDamageResult[] = resolveComponentDamage(
      components,
      hitLocation,
      impact.penetrationOutcome,
      impact.splinterIntensity,
    );

    const sfInput: StructureFlotationInput = {
      structuralDamage: impact.structuralDamage,
      flotationDamage: impact.flotationDamage,
      currentStructuralIntegrity: currentState.structuralIntegrity,
      currentFlotationReserve: currentState.flotationReserve,
    };
    const sfResult: StructureFlotationResult = resolveStructureFlotation(sfInput);

    currentState = {
      ...currentState,
      structuralIntegrity: sfResult.structuralIntegrityAfter,
      flotationReserve: sfResult.flotationReserveAfter,
    };

    let createdFireSources: FireSourceRecord[] = [];
    let createdFloodingSources: FloodingSourceRecord[] = [];

    if (keyedRng) {
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

    let terminalTransition: string | null = null;

    if (currentState.terminalStatus === "NORMAL") {
      if (keyedRng) {
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
        if (currentState.flotationReserve <= 0) {
          terminalTransition = "SINKING";
          currentState = { ...currentState, terminalStatus: "SINKING" };
        }
      }
    }

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

  const newState = withDamageStateHash(currentState);

  return { newState, events };
}

function buildComponentState(state: ShipDamageState): ComponentState[] {
  return state.components.map((id) => ({
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
