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

export function computeBaseBreachRateKgMin(hullBreachAreaM2: number): number {
  if (!isInt(hullBreachAreaM2) || hullBreachAreaM2 < 0)
    invariant(
      "hullBreachAreaM2",
      hullBreachAreaM2,
      "hull-breach area must be a non-negative integer m²",
    );
  return Math.floor(hullBreachAreaM2 * TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2);
}

export function computeTorpedoFloodingRateKgMin(o: {
  baseBreachRateKgMin: number;
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
  const raw = Number(numerator / denominator);
  return Math.max(0, raw);
}

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
    if (rateKgMin <= 0) continue;
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
