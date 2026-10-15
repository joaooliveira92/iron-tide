//packages/combat/src/torpedoes/flooding.ts
// DESIGN-40 §18 progressive-flooding CREATION (INC-6, AC-16). A damaging
// underwater hit creates zero or more FloodingSource records; each source
// carries the computed torpedo rate:
//   floodingRateKgMin = floor(baseBreachRate * seaPressureMultiplierBp *
//     hullDamageMultiplierBp * compartmentMultiplierBp * isolationMultiplierBp
//     / 10_000^4)
// with the shipped isolation multipliers INTACT 5_000 / DEGRADED 10_000 /
// FAILED 15_000. The baseBreachRate is derived from the hull-breach area with
// the authored BALANCE TARGET rate constant (damageConstants.ts);
// sea-pressure / hull-damage / compartment multipliers are caller-supplied
// integer bp values (neutral 10_000 when the layout layer has no deeper model
// — never a silent skip). A computed rate of 0 kg/min creates NO source (a
// sealed/tiny breach contributes nothing). Per-minute RESOLUTION (ticking the
// source against the ship) is C-5's increment — this module is creation-only,
// exactly as the seam verdict records.
//
// The §21 severe tube-hit extra source is also created here: ONE additional
// source at the shipped rate multiplier 15_000 bp over the ongoing progressive
// rate, cause UNDERWATER_TUBE_SEVERE_FLOODING (owned by the tube-hazard
// slice).
//
// The created records re-enter the B-4 state surface unchanged (the
// FloodingSourceRecord shape from damage/state.ts — same-package import, no
// re-implementation). Pure/deterministic: no I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import type { FloodingSourceRecord } from "../damage/state.js";
import {
  TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2,
  TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP,
  TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP,
  TORPEDO_FLOODING_SCALE_EXPONENT,
  TORPEDO_TUBE_EXTRA_SOURCE_RATE_MULTIPLIER_BP,
} from "./damageConstants.js";
import { TORPEDO_BASIS_POINTS_PER_UNIT } from "./constants.js";
import {
  TORPEDO_PROGRESSIVE_FLOODING_CREATED,
  TORPEDO_STATE_INVARIANT_FAILED,
  UNDERWATER_TUBE_SEVERE_FLOODING,
} from "./reasonCodes.js";
import { FLOODING_ISOLATION_STATES, type FloodingIsolationState } from "./constants.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

// AC-16: the §18 baseBreachRate from the hull-breach area (integer m²) — the
// authored breach-rate constant; an area of 0 m² yields a 0 base rate (hence
// no source is created downstream).
export function computeBaseBreachRateKgMin(hullBreachAreaM2: number): number {
  if (!isInt(hullBreachAreaM2) || hullBreachAreaM2 < 0)
    invariant(
      "hullBreachAreaM2",
      hullBreachAreaM2,
      "hull-breach area must be a non-negative integer m²",
    );
  return Math.floor(hullBreachAreaM2 * TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2);
}

// AC-16: the exact §18 rate formula. Isolation may be passed as the canonical
// state (the shipped table is authoritative) or as a raw integer bp; the three
// untabled factors default to the neutral 10_000 bp (callers supply refined
// values).
export function computeTorpedoFloodingRateKgMin(o: {
  baseBreachRateKgMin: number; // integer, non-negative
  seaPressureMultiplierBp?: number;
  hullDamageMultiplierBp?: number;
  compartmentMultiplierBp?: number;
  isolationState?: FloodingIsolationState;
  isolationMultiplierBp?: number;
}): number {
  if (!isInt(o.baseBreachRateKgMin) || o.baseBreachRateKgMin < 0)
    invariant(
      "baseBreachRateKgMin",
      o.baseBreachRateKgMin,
      "base breach rate must be a non-negative integer kg/min",
    );
  if (
    o.isolationState !== undefined &&
    !(FLOODING_ISOLATION_STATES as readonly string[]).includes(o.isolationState)
  )
    invariant("isolationState", o.isolationState, "isolation must be a canonical §18 state");
  const sea = o.seaPressureMultiplierBp ?? TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP;
  const hull = o.hullDamageMultiplierBp ?? TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP;
  const comp = o.compartmentMultiplierBp ?? TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP;
  const isol =
    o.isolationMultiplierBp ??
    (o.isolationState !== undefined
      ? TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP[o.isolationState]
      : invariant(
          "isolationMultiplierBp",
          undefined,
          "either the isolation state or the raw multiplier is required",
        ));
  for (const [field, v] of [
    ["seaPressureMultiplierBp", sea],
    ["hullDamageMultiplierBp", hull],
    ["compartmentMultiplierBp", comp],
    ["isolationMultiplierBp", isol],
  ] as const) {
    if (!isInt(v) || v < 0 || v > 100_000)
      invariant(field, v, "an integer basis-point multiplier within [0, 100_000] is required");
  }

  const numerator =
    BigInt(o.baseBreachRateKgMin) * BigInt(sea) * BigInt(hull) * BigInt(comp) * BigInt(isol);
  const denominator =
    BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** BigInt(TORPEDO_FLOODING_SCALE_EXPONENT);
  const raw = Number(numerator / denominator); // bigint division floors
  return Math.max(0, raw);
}

// AC-16: creation — zero or more FloodingSource records, one per compartment
// input, each carrying the computed §18 rate and the cause
// TORPEDO_PROGRESSIVE_FLOODING_CREATED. A compartment whose computed rate is
// 0 contributes NO source. The result is an immutable (frozen) list in the
// caller's compartment order (§28 source ordering is the engine's INC-7
// seam). Creation-only: nothing ticks the source forward.
export function resolveTorpedoFloodingCreation(o: {
  compartments: readonly {
    compartmentId: string;
    baseBreachRateKgMin: number;
    seaPressureMultiplierBp?: number;
    hullDamageMultiplierBp?: number;
    compartmentMultiplierBp?: number;
    isolationState?: FloodingIsolationState;
    isolationMultiplierBp?: number;
  }[];
}): readonly FloodingSourceRecord[] {
  if (!Array.isArray(o.compartments))
    invariant("compartments", o.compartments, "compartments must be an array");
  const sources: FloodingSourceRecord[] = [];
  for (const c of o.compartments) {
    if (typeof c.compartmentId !== "string" || c.compartmentId.length === 0)
      invariant("compartmentId", c.compartmentId, "compartment id must be a non-empty string");
    const rateKgMin = computeTorpedoFloodingRateKgMin({
      baseBreachRateKgMin: c.baseBreachRateKgMin,
      seaPressureMultiplierBp: c.seaPressureMultiplierBp,
      hullDamageMultiplierBp: c.hullDamageMultiplierBp,
      compartmentMultiplierBp: c.compartmentMultiplierBp,
      isolationState: c.isolationState,
      isolationMultiplierBp: c.isolationMultiplierBp,
    });
    if (rateKgMin <= 0) continue; // no source for a sealed/zero-rate breach
    sources.push(
      Object.freeze({
        compartmentId: c.compartmentId,
        rateKgMin,
        cause: TORPEDO_PROGRESSIVE_FLOODING_CREATED,
      }),
    );
  }
  return Object.freeze(sources);
}

// §21 severe-tube-flood extra source — creation-only: ONE additional source at
// the shipped rate multiplier (15_000 bp) over the ongoing progressive rate,
// carrying the AZ code UNDERWATER_TUBE_SEVERE_FLOODING.
export function createSevereTubeFloodingSource(o: {
  compartmentId: string;
  baseProgressiveRateKgMin: number;
}): FloodingSourceRecord {
  if (typeof o.compartmentId !== "string" || o.compartmentId.length === 0)
    invariant("compartmentId", o.compartmentId, "compartment id must be a non-empty string");
  if (!isInt(o.baseProgressiveRateKgMin) || o.baseProgressiveRateKgMin < 0)
    invariant(
      "baseProgressiveRateKgMin",
      o.baseProgressiveRateKgMin,
      "base progressive rate must be a non-negative integer kg/min",
    );
  const rateKgMin = Math.floor(
    (o.baseProgressiveRateKgMin * TORPEDO_TUBE_EXTRA_SOURCE_RATE_MULTIPLIER_BP) /
      TORPEDO_BASIS_POINTS_PER_UNIT,
  );
  return Object.freeze({
    compartmentId: o.compartmentId,
    rateKgMin,
    cause: UNDERWATER_TUBE_SEVERE_FLOODING,
  });
}
