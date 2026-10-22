import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { TERMINAL_STATUSES, type TerminalStatus } from "./constants.js";
import { DAMAGE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

interface DamagePackageBase {
  locationId: string;
}

export interface PenetrationPackage extends DamagePackageBase {
  category: "PENETRATION";
  penetrationDepthUm: number;
}

export interface NonPenetrationPackage extends DamagePackageBase {
  category: "NON_PENETRATION";
  impactEnergyUm: number;
}

export interface SplinterPackage extends DamagePackageBase {
  category: "SPLINTER";
  splinterCount: number;
}

export interface FirePackage extends DamagePackageBase {
  category: "FIRE";
  fireIntensityBp: number;
}

export interface FloodingPackage extends DamagePackageBase {
  category: "FLOODING";
  floodingRateKgMin: number;
}

export interface SecondaryHazardPackage extends DamagePackageBase {
  category: "SECONDARY_HAZARD";
  hazardType: string;
}

export interface NoEffectPackage {
  category: "NO_EFFECT";
  reason: string;
}

export type DamagePackage =
  | PenetrationPackage
  | NonPenetrationPackage
  | SplinterPackage
  | FirePackage
  | FloodingPackage
  | SecondaryHazardPackage
  | NoEffectPackage;

export interface FireRecord {
  locationId: string;
  intensityBp: number;
  cause: string;
}

export type FireSourceRecord = FireRecord;

export interface FloodingSourceRecord {
  compartmentId: string;
  rateKgMin: number;
  cause: string;
}

export interface ShipDamageState {
  shipId: string;
  compartments: readonly string[];
  components: readonly string[];
  structuralIntegrity: number;
  flotationReserve: number;
  stabilityScore: number;
  fireRecords: readonly FireRecord[];
  floodingRecords: readonly FloodingSourceRecord[];
  progressiveFloodingTotal: number;
  performanceModifiers: Record<string, number>;
  terminalStatus: TerminalStatus;
  rulesetVersion: string;
  formulaVersion: string;
  stateHash: string;
}

function invariant(s: ShipDamageState, field: string, value: unknown, reason: string): never {
  const message = DAMAGE_STATE_INVARIANT_FAILED;
  throw new BluewaveError(message, {
    code: DAMAGE_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function assertFixedPointDamage(s: ShipDamageState): void {
  if (typeof s.shipId !== "string" || s.shipId.length === 0)
    invariant(s, "shipId", s.shipId, "shipId must be a non-empty string");

  if (!Array.isArray(s.compartments))
    invariant(s, "compartments", s.compartments, "compartments must be an array");
  if (!s.compartments.every((c: unknown) => typeof c === "string" && c.length > 0))
    invariant(s, "compartments", s.compartments, "every compartment must be a non-empty string");

  if (!Array.isArray(s.components))
    invariant(s, "components", s.components, "components must be an array");
  if (!s.components.every((c: unknown) => typeof c === "string" && c.length > 0))
    invariant(s, "components", s.components, "every component must be a non-empty string");

  if (!Number.isInteger(s.structuralIntegrity))
    invariant(s, "structuralIntegrity", s.structuralIntegrity, "integer structural-integrity");
  if (s.structuralIntegrity < 0)
    invariant(
      s,
      "structuralIntegrity",
      s.structuralIntegrity,
      "structuralIntegrity must be non-negative",
    );

  if (!Number.isInteger(s.flotationReserve))
    invariant(s, "flotationReserve", s.flotationReserve, "integer flotation-reserve");
  if (s.flotationReserve < 0)
    invariant(s, "flotationReserve", s.flotationReserve, "flotationReserve must be non-negative");

  if (!Number.isInteger(s.stabilityScore))
    invariant(s, "stabilityScore", s.stabilityScore, "integer stability score");
  if (s.stabilityScore < 0 || s.stabilityScore > 10_000)
    invariant(s, "stabilityScore", s.stabilityScore, "stability score must be [0, 10_000]");

  if (!Array.isArray(s.fireRecords))
    invariant(s, "fireRecords", s.fireRecords, "fireRecords must be an array");
  for (let i = 0; i < s.fireRecords.length; i++) {
    const r = s.fireRecords[i];
    if (typeof r.locationId !== "string" || r.locationId.length === 0)
      invariant(s, `fireRecords[${i}].locationId`, r.locationId, "non-empty location id");
    if (!Number.isInteger(r.intensityBp))
      invariant(s, `fireRecords[${i}].intensityBp`, r.intensityBp, "integer basis points");
    if (r.intensityBp < 0 || r.intensityBp > 10_000)
      invariant(s, `fireRecords[${i}].intensityBp`, r.intensityBp, "intensity must be [0, 10_000]");
    if (typeof r.cause !== "string" || r.cause.length === 0)
      invariant(s, `fireRecords[${i}].cause`, r.cause, "non-empty cause");
  }

  if (!Array.isArray(s.floodingRecords))
    invariant(s, "floodingRecords", s.floodingRecords, "floodingRecords must be an array");
  for (let i = 0; i < s.floodingRecords.length; i++) {
    const r = s.floodingRecords[i];
    if (typeof r.compartmentId !== "string" || r.compartmentId.length === 0)
      invariant(
        s,
        `floodingRecords[${i}].compartmentId`,
        r.compartmentId,
        "non-empty compartment id",
      );
    if (!Number.isInteger(r.rateKgMin))
      invariant(s, `floodingRecords[${i}].rateKgMin`, r.rateKgMin, "integer rate kg/min");
    if (r.rateKgMin < 0)
      invariant(s, `floodingRecords[${i}].rateKgMin`, r.rateKgMin, "rate must be non-negative");
    if (typeof r.cause !== "string" || r.cause.length === 0)
      invariant(s, `floodingRecords[${i}].cause`, r.cause, "non-empty cause");
  }

  if (!Number.isInteger(s.progressiveFloodingTotal))
    invariant(
      s,
      "progressiveFloodingTotal",
      s.progressiveFloodingTotal,
      "integer progressive flooding total",
    );
  if (s.progressiveFloodingTotal < 0)
    invariant(
      s,
      "progressiveFloodingTotal",
      s.progressiveFloodingTotal,
      "progressive flooding total must be non-negative",
    );

  if (typeof s.performanceModifiers !== "object" || s.performanceModifiers === null)
    invariant(
      s,
      "performanceModifiers",
      s.performanceModifiers,
      "performanceModifiers must be a record",
    );
  for (const [key, val] of Object.entries(s.performanceModifiers)) {
    if (!Number.isInteger(val))
      invariant(s, `performanceModifiers[${key}]`, val, "integer modifier value");
  }

  if (!(TERMINAL_STATUSES as readonly string[]).includes(s.terminalStatus))
    invariant(s, "terminalStatus", s.terminalStatus, "terminalStatus must be a canonical status");

  if (typeof s.rulesetVersion !== "string" || s.rulesetVersion.length === 0)
    invariant(s, "rulesetVersion", s.rulesetVersion, "rulesetVersion must be a non-empty string");
  if (typeof s.formulaVersion !== "string" || s.formulaVersion.length === 0)
    invariant(s, "formulaVersion", s.formulaVersion, "formulaVersion must be a non-empty string");
}

export function computeDamageStateHash(s: ShipDamageState): string {
  const surface = {
    shipId: s.shipId,
    compartments: s.compartments,
    components: s.components,
    structuralIntegrity: s.structuralIntegrity,
    flotationReserve: s.flotationReserve,
    stabilityScore: s.stabilityScore,
    fireRecords: s.fireRecords,
    floodingRecords: s.floodingRecords,
    progressiveFloodingTotal: s.progressiveFloodingTotal,
    performanceModifiers: s.performanceModifiers,
    terminalStatus: s.terminalStatus,
    rulesetVersion: s.rulesetVersion,
    formulaVersion: s.formulaVersion,
  };
  return createEnvelope("damage-state", "damage_v1", surface).bodyHash;
}

export function withDamageStateHash(s: Omit<ShipDamageState, "stateHash">): ShipDamageState {
  const full = s as ShipDamageState;
  assertFixedPointDamage(full);
  return { ...full, stateHash: computeDamageStateHash(full) };
}
