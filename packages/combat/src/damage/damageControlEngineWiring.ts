// Step 8.6 resolveDamageControl — called after resolveDamage (step 8.5/9-10).
// Applies per-minute fire resolution, flooding resolution,
// damage-control allocation, and terminal state re-evaluation.
//
// Pure/deterministic: no ambient I/O/clock/random except the caller-provided
// keyedRng function for deterministic randomness when resolving fire spread
// and high-speed loss checks. Integer fixed-point arithmetic only.
//
// P-1 ticket 07 (per-ship damage control): the engine now resolves ONE context
// per ship (a Record<string, DamageControlContext> keyed by ship assetId) and
// writes each ship's stage result back into its OWN damage state via
// `applyDamageControlToState` — flooding progression feeds flotation reserve
// and the §32 terminal seam on that ship alone. The optional `shipId` field
// scopes fire-smoke cloud/record ids so two ships with fires at the same
// compartment (e.g. the canonical COMP-BELT-1) never collide.

import type { FireRecord, FloodingSourceRecord, ShipDamageState } from "./state.js";
import { withDamageStateHash } from "./state.js";
import type { DamageControlResource } from "./damageControlConstants.js";
import {
  allocateDamageControl,
  getEffectivePumping,
  getEffectiveFirefighting,
  getEffectiveRepairReduction,
  type DamageControlAllocation,
} from "./damageControl.js";
import { resolveFireProgression, computeFireSmokeStrength } from "./fireResolution.js";
import { floodedWaterBpFromKg, resolveFloodingProgression } from "./floodingResolution.js";
import { evaluateTerminalSeam } from "./terminalSeam.js";
import { BluewaveError } from "@bluewave/contracts";
import { INVALID_SHIP_DAMAGE_STATE } from "./reasonCodes.js";
import type { SmokeSourceType } from "../smoke/constants.js";
import { createSmokeEventRecord, type SmokeEventRecord } from "../smoke/smokeRecords.js";

// Context and result types

export interface DamageControlContext {
  /** Active fire records for the ship (resolution input, pre-minute). */
  fireRecords: FireRecord[];
  /** Active flooding source records for the ship (resolution input, pre-minute). */
  floodingRecords: FloodingSourceRecord[];
  /** Current accumulated flooded water MASS in integer kilograms (the state's
   *  progressiveFloodingTotal surface — see applyDamageControlToState). The
   *  field name is the pre-existing surface; ADR-0047 decision 4 keeps the
   *  accumulation in kg and converts to bp only at severity evaluation via
   *  `designDisplacementKg`. */
  floodedWaterBp: number;
  /** The ship's DESIGN DISPLACEMENT in integer kilograms (projected-unit /
   *  DamageTargetContext design surface) — the denominator of the
   *  `bp = floor(mass × 10_000 / displacement)` conversion that severity
   *  evaluation and §17 eligibility read (DESIGN-41 §14/§48 v12; ADR-0047 d4).
   *  Required: there is no defaulting to 0 here (DESIGN-41 §1 fail-closed). */
  designDisplacementKg: number;
  /** Canonical ship type string (fire-risk multiplier surface). */
  shipType: string;
  /** Current ship speed in knots (DESIGN-41 §16 speed-pressure band). */
  currentSpeedKt: number;
  /** Damage-control resource pool for the ship. */
  resources: DamageControlResource;
  /** Deterministic keyed RNG, or null for deterministic mode (no spread /
   *  high-speed-loss stochastic checks). */
  keyedRng: ((stream: string) => number) | null;
  /** Optional ship id — scopes fire-smoke cloud/record ids when the stage runs
   *  per ship (P-1 ticket 07). Omit for single-context callers. */
  shipId?: string;
}

export interface DamageControlStageResult {
  fireRecords: FireRecord[];
  floodingRecords: FloodingSourceRecord[];
  /** Next accumulated flooded water MASS in integer kilograms (pre-existing
   *  field name; written straight back to progressiveFloodingTotal). */
  nextFloodedWaterBp: number;
  allocations: DamageControlAllocation[];
  smokeEventRecords: SmokeEventRecord[];
  // fire smoke creates smoke clouds
  highSpeedLoss: boolean;
  /** Net flooding delta this minute (kg/min, >= 0 — DESIGN-41 §18). The
   *  write-back applies it to the ship's flotation reserve. */
  netDeltaKgMin: number;
}

// resolveDamageControl — per-minute damage-control stage

/** Design surface the terminal-seam write-back needs from the projected ship. */
export interface DamageDesignSurface {
  designFlotationReserve: number;
  designStabilityScore: number;
}

/**
 * Fail-closed design guard for the engine's damage-control write-back step
 * (P-1 review F7): the terminal seam needs the ship's design surface (flotation
 * reserve / stability denominators), and the pre-07 engine silently defaulted a
 * missing design to 0 — reading the ship as 0% flotation/stability (instant
 * terminal transition). Reachable battle paths always carry the design
 * (projected per ship), so this only fires on wiring defects — structured
 * INVALID_SHIP_DAMAGE_STATE (DESIGN-41 §1), not a silent 0.
 */
export function requireDamageDesignSurface(
  design: DamageDesignSurface | undefined,
  battleId: string,
  shipId: string,
): DamageDesignSurface {
  if (!design) {
    throw new BluewaveError(INVALID_SHIP_DAMAGE_STATE, {
      code: INVALID_SHIP_DAMAGE_STATE,
      battleId,
      shipId,
      reason:
        "damage-control write-back requires the ship's design surface (flotation reserve / stability score)",
    });
  }
  return design;
}

export function resolveDamageControl(
  context: DamageControlContext,
  battleMinute: number,
  substep: number,
): DamageControlStageResult {
  // Step 1: Allocate damage-control resources to active fire and flooding sources.
  // Unit contract (ADR-0047 decision 4): allocation priority is decided on
  // bp-of-displacement, so the context's kg mass is converted to bp HERE — the
  // PRE-delta site (the mass as it stood at the START of this minute, before
  // resolveFloodingProgression adds the net delta). The second site is
  // floodingResolution.resolveFloodingProgression, which converts the POST-delta
  // mass for §17 severity/eligibility. Both sites go through the shared
  // floodedWaterBpFromKg helper and both feed getFloodingSeverity.
  const floodedWaterBp = floodedWaterBpFromKg(context.floodedWaterBp, context.designDisplacementKg);
  const { allocations } = allocateDamageControl(
    context.resources,
    context.fireRecords,
    context.floodingRecords,
    floodedWaterBp,
  );

  const effectivePumping = getEffectivePumping(allocations);
  const _effectiveFirefighting = getEffectiveFirefighting(allocations);
  const effectiveRepairReduction = getEffectiveRepairReduction(allocations);

  const { fireRecords, newFires } = resolveFireProgression(
    context.fireRecords,
    context.shipType,
    context.keyedRng,
  );

  // Combine existing fires with new fires from spread
  const allFires = [...fireRecords, ...newFires];

  // Step 4: Resolve flooding progression — compute net delta, severity, high-speed check.
  // The effective pumping and repair reduction from damage-control allocation are used here.
  // Accumulation stays in kg; severity is derived from bp-of-displacement inside
  // (ADR-0047 decision 4).
  const progressiveFailureBp = 10_000; // Default: no progressive failure multiplier
  const { nextFloodedWaterBp, highSpeedLoss, netDeltaKgMin } = resolveFloodingProgression(
    context.floodingRecords,
    context.floodedWaterBp,
    context.designDisplacementKg,
    context.currentSpeedKt,
    progressiveFailureBp,
    effectivePumping,
    effectiveRepairReduction,
    context.keyedRng,
  );

  // Step 5: Compute fire smoke (DESIGN-41 §25) from each active fire
  const smokeEventRecords: SmokeEventRecord[] = [];
  for (const fire of allFires) {
    const smokeStrength = computeFireSmokeStrength(fire.intensityBp, context.shipType);
    if (smokeStrength > 0) {
      // For fire smoke, we use a ship-scoped locationId + minute as a synthetic
      // cloud id. The ship prefix keeps two ships' fires at identical
      // compartment ids from colliding (P-1 ticket 07 per-ship resolution).
      const shipPrefix = context.shipId ? `${context.shipId}:` : "";
      const cloudId = `fire-smoke:${shipPrefix}${fire.locationId}:${battleMinute}`;
      smokeEventRecords.push(
        createSmokeEventRecord({
          kind: "FUNNEL_EMISSION",
          battleMinute,
          substep,
          sourceType: "FIRE" as SmokeSourceType,
          sourceId: fire.locationId,
          cloudId,
          position: [0, 0] as readonly [number, number], // Position updated by owning stage
          densityBp: smokeStrength,
          weatherContext: null,
        }),
      );
    }
  }

  return {
    fireRecords: allFires,
    floodingRecords: context.floodingRecords,
    nextFloodedWaterBp,
    allocations,
    smokeEventRecords,
    highSpeedLoss,
    netDeltaKgMin,
  };
}

// Per-ship write-back (P-1 ticket 07)

export interface DamageControlWriteBackInput {
  /** The ship's authoritative current damage state. */
  state: ShipDamageState;
  /** The per-ship stage result from resolveDamageControl. */
  stageResult: DamageControlStageResult;
  /** Design (full) flotation reserve — terminal percentage denominator. */
  designFlotationReserve: number;
  /** Design (full) stability score in bp [0, 10_000] — terminal percentage denominator. */
  designStabilityScore: number;
}

export interface DamageControlWriteBackOutput {
  /** The next authoritative ShipDamageState (with recomputed stateHash) when
   *  anything changed; otherwise the INPUT state object, untouched. */
  state: ShipDamageState;
  /** True when the write-back produced an observable state change. */
  changed: boolean;
}

/**
 * Apply one ship's damage-control stage result to its damage state:
 *
 *   - fireRecords/floodingRecords <- resolved records;
 *   - progressiveFloodingTotal  <- nextFloodedWaterBp (kg-equiv accumulation —
 *     the pre-existing floodedWaterBp unit convention, DESIGN-41 §18 note);
 *   - flotationReserve          <- max(0, reserve - netDeltaKgMin): progressive
 *     flooding weight drains the ship's flotation reserve at the same integer
 *     scale the resolution uses (kg-equiv, floor-at-0);
 *   - terminalStatus            <- evaluateTerminalSeam (§31-32): the reserve
 *     reaching 0 transitions the ship NORMAL -> SINKING (or FOUNDERED when
 *     structure is also gone), which is what makes flooding feed the §32
 *     battle-end decision.
 *
 * The caller contract: `context.floodedWaterBp` MUST equal the input state's
 * `progressiveFloodingTotal` (the auto-resolution builder derives both from the
 * same per-ship state; both surfaces are integer kg — ADR-0047 decision 4).
 * Returns the input state untouched (changed=false) when nothing differs — the
 * engine's strict no-op guarantee for wired-but-quiet minutes. Pure/deterministic:
 * no RNG, I/O, or ambient state.
 */
export function applyDamageControlToState(
  input: DamageControlWriteBackInput,
): DamageControlWriteBackOutput {
  const { state, stageResult, designFlotationReserve, designStabilityScore } = input;

  const flotationReserveAfter = Math.max(0, state.flotationReserve - stageResult.netDeltaKgMin);
  const flotationPct =
    designFlotationReserve > 0
      ? Math.floor((flotationReserveAfter * 10_000) / designFlotationReserve)
      : 0;
  const stabilityPct =
    designStabilityScore > 0
      ? Math.floor((state.stabilityScore * 10_000) / designStabilityScore)
      : 0;
  const terminal = evaluateTerminalSeam({
    flotationReserveAfter,
    structuralIntegrityAfter: state.structuralIntegrity,
    progressiveFloodingTotal: stageResult.nextFloodedWaterBp,
    catastrophicBreakup: false,
    capsizeRisk: false,
    currentTerminalStatus: state.terminalStatus,
    flotationPct,
    stabilityPct,
  });

  const next: ShipDamageState = {
    ...state,
    fireRecords: [...stageResult.fireRecords],
    floodingRecords: [...stageResult.floodingRecords],
    progressiveFloodingTotal: stageResult.nextFloodedWaterBp,
    flotationReserve: flotationReserveAfter,
    terminalStatus: terminal.transition === "NONE" ? state.terminalStatus : terminal.transition,
  };

  const changed =
    next.flotationReserve !== state.flotationReserve ||
    next.progressiveFloodingTotal !== state.progressiveFloodingTotal ||
    next.terminalStatus !== state.terminalStatus ||
    !fireRecordsEqual(state.fireRecords, next.fireRecords) ||
    !floodingRecordsEqual(state.floodingRecords, next.floodingRecords);

  if (!changed) return { state, changed: false };
  return { state: withDamageStateHash(next), changed: true };
}

function fireRecordsEqual(a: readonly FireRecord[], b: readonly FireRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.locationId !== y.locationId || x.intensityBp !== y.intensityBp || x.cause !== y.cause)
      return false;
  }
  return true;
}

function floodingRecordsEqual(
  a: readonly FloodingSourceRecord[],
  b: readonly FloodingSourceRecord[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.compartmentId !== y.compartmentId || x.rateKgMin !== y.rateKgMin || x.cause !== y.cause)
      return false;
  }
  return true;
}
