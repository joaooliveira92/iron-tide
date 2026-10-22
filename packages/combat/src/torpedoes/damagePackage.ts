import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import type { ShipDamageState, FloodingSourceRecord } from "../damage/state.js";
import { withDamageStateHash, assertFixedPointDamage } from "../damage/state.js";
import {
  resolveStructureFlotation,
  type StructureFlotationResult,
} from "../damage/structureFlotation.js";
import { evaluateTerminalSeam, type TerminalResult } from "../damage/terminalSeam.js";
import { applyTurretDamage, type TurretComponent } from "../damage/turretStates.js";
import { torpedoPolicyId } from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import { computeBaseWarheadFlotationDamage, computeTorpedoFlotationDamage } from "./flotation.js";
import {
  computeBaseBreachRateKgMin,
  computeTorpedoFloodingRateKgMin,
  resolveTorpedoFloodingCreation,
} from "./flooding.js";
import { evaluateTorpedoMachineryDamage, type TorpedoMachineryEffect } from "./machinery.js";
import {
  evaluateTorpedoSystemShock,
  type TorpedoSystemShockResult,
  type SystemShockCandidate,
} from "./systemShock.js";
import {
  computeUnderwaterTubeSevereFloodingBp,
  resolveUnderwaterTubeHitHazard,
  type TorpedoTubeHazardResult,
} from "./tubeHazard.js";
import type { FloodingIsolationState, TorpedoPropulsionType } from "./constants.js";
import type { TorpedoImpactZone, TorpedoTargetProtectionLevel } from "./detonation.js";
import type { TorpedoTubeProtectionLevel } from "./tubeHazard.js";
import type { ComponentOutcome } from "../damage/componentDamage.js";
import {
  TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M,
  TORPEDO_SEAWATER_DENSITY_KG_PER_M3,
  TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ,
} from "./damageConstants.js";
import type { TorpedoChainReactionResult } from "./chainReaction.js";

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

export type TorpedoImpactSide = "PORT" | "STARBOARD";
export type TorpedoDamageControlAccessibility = "ACCESSIBLE" | "RESTRICTED" | "INACCESSIBLE";

export interface TorpedoDamagePackage {
  packageId: string;
  battleMinute: number;
  substep: number;
  torpedoTrackId: string;
  targetShipId: string;
  targetContactId: string;
  impactZone: TorpedoImpactZone;
  impactSide: TorpedoImpactSide;
  longitudinalPositionM: number;
  warheadExplosiveEquivalentMassKg: number;
  detonationDepthM: number;
  protectionLevel: TorpedoTargetProtectionLevel;
  hullBreachAreaM2: number;
  immediateFloodingKg: number;
  progressiveFloodingRateKgMin: number;
  machinery: TorpedoMachineryPackageField;
  nearbySystemShock: TorpedoShockPackageField;
  fireProbabilityBp: number;
  crewCasualties: number;
  structuralDamage: number;
  flotationDamage: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  packageHash: string;
}

export interface TorpedoMachineryPackageField {
  severity: string;
  affectedComponents: readonly string[];
  componentOutcome: ComponentOutcome;
}

export interface TorpedoShockPackageField {
  affectedSystemId: string | null;
  componentOutcome: "DESTROYED" | null;
}

export type TorpedoDamagePackageBody = Omit<TorpedoDamagePackage, "packageHash">;

export function computeTorpedoDamagePackageHash(body: TorpedoDamagePackageBody): string {
  return createEnvelope("torpedo-damage-package", torpedoPolicyId, body).bodyHash;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== null && typeof v === "object") deepFreeze(v);
    }
  }
  return value;
}

export function assertTorpedoDamagePackageSurface(p: TorpedoDamagePackage): void {
  if (typeof p !== "object" || p === null)
    invariant("package", p, "a torpedo damage package is required");
  if (typeof p.packageId !== "string" || p.packageId.length === 0)
    invariant("packageId", p.packageId, "package id must be a non-empty string");
  if (!isInt(p.battleMinute) || p.battleMinute < 0)
    invariant("battleMinute", p.battleMinute, "battle minute must be a non-negative integer");
  if (!isInt(p.substep) || p.substep < 1)
    invariant("substep", p.substep, "substep must be a positive integer");
  if (typeof p.torpedoTrackId !== "string" || p.torpedoTrackId.length === 0)
    invariant("torpedoTrackId", p.torpedoTrackId, "torpedoTrackId must be non-empty");
  if (typeof p.targetShipId !== "string" || p.targetShipId.length === 0)
    invariant("targetShipId", p.targetShipId, "targetShipId must be non-empty");
  if (typeof p.targetContactId !== "string" || p.targetContactId.length === 0)
    invariant("targetContactId", p.targetContactId, "targetContactId must be non-empty");
  if (
    !(
      ["EXTREMITY", "MACHINERY", "MAGAZINE", "TUBE_BAY", "CENTRAL", "BREACHED"] as readonly string[]
    ).includes(p.impactZone)
  )
    invariant("impactZone", p.impactZone, "impact zone must be a canonical §17 zone");
  if (!(p.impactSide === "PORT" || p.impactSide === "STARBOARD"))
    invariant("impactSide", p.impactSide, "impact side must be PORT or STARBOARD");
  if (!isInt(p.longitudinalPositionM) || p.longitudinalPositionM < 0)
    invariant(
      "longitudinalPositionM",
      p.longitudinalPositionM,
      "longitudinal position must be a non-negative integer",
    );
  if (!isInt(p.warheadExplosiveEquivalentMassKg) || p.warheadExplosiveEquivalentMassKg <= 0)
    invariant(
      "warheadExplosiveEquivalentMassKg",
      p.warheadExplosiveEquivalentMassKg,
      "warhead explosive-equivalent mass must be a positive integer kg",
    );
  if (!isInt(p.detonationDepthM) || p.detonationDepthM < 0)
    invariant(
      "detonationDepthM",
      p.detonationDepthM,
      "detonation depth must be a non-negative integer",
    );
  if (
    !(["NONE", "WEAK", "STANDARD", "STRONG", "ADVANCED"] as readonly string[]).includes(
      p.protectionLevel,
    )
  )
    invariant("protectionLevel", p.protectionLevel, "protection level must be canonical");
  if (!isInt(p.hullBreachAreaM2) || p.hullBreachAreaM2 < 0)
    invariant(
      "hullBreachAreaM2",
      p.hullBreachAreaM2,
      "hull-breach area must be a non-negative integer",
    );
  if (!isInt(p.immediateFloodingKg) || p.immediateFloodingKg < 0)
    invariant(
      "immediateFloodingKg",
      p.immediateFloodingKg,
      "immediate flooding must be a non-negative integer",
    );
  if (!isInt(p.progressiveFloodingRateKgMin) || p.progressiveFloodingRateKgMin < 0)
    invariant(
      "progressiveFloodingRateKgMin",
      p.progressiveFloodingRateKgMin,
      "progressive flooding rate must be a non-negative integer kg/min",
    );
  if (typeof p.machinery !== "object" || p.machinery === null)
    invariant("machinery", p.machinery, "machinery package is required");
  if (typeof p.nearbySystemShock !== "object" || p.nearbySystemShock === null)
    invariant("nearbySystemShock", p.nearbySystemShock, "system shock package is required");
  if (!isInt(p.fireProbabilityBp) || p.fireProbabilityBp < 0 || p.fireProbabilityBp > 10_000)
    invariant(
      "fireProbabilityBp",
      p.fireProbabilityBp,
      "fire probability must be an integer bp [0, 10_000]",
    );
  if (!isInt(p.crewCasualties) || p.crewCasualties < 0)
    invariant("crewCasualties", p.crewCasualties, "crew casualties must be a non-negative integer");
  if (!isInt(p.structuralDamage) || p.structuralDamage < 0)
    invariant(
      "structuralDamage",
      p.structuralDamage,
      "structural damage must be a non-negative integer",
    );
  if (!isInt(p.flotationDamage) || p.flotationDamage < 0)
    invariant(
      "flotationDamage",
      p.flotationDamage,
      "flotation damage must be a non-negative integer",
    );
  if (
    !(
      p.damageControlAccessibility === "ACCESSIBLE" ||
      p.damageControlAccessibility === "RESTRICTED" ||
      p.damageControlAccessibility === "INACCESSIBLE"
    )
  )
    invariant(
      "damageControlAccessibility",
      p.damageControlAccessibility,
      "damage-control accessibility must be a closed value",
    );
}

export function assertAuthoritativeTorpedoDamagePackage(p: TorpedoDamagePackage): void {
  assertTorpedoDamagePackageSurface(p);
  if (typeof p.packageHash !== "string" || p.packageHash.length === 0)
    invariant("packageHash", p.packageHash, "packageHash must be a non-empty string");
}

export function verifyTorpedoDamagePackageHash(p: TorpedoDamagePackage): boolean {
  const { packageHash: _ignored, ...body } = p;
  return computeTorpedoDamagePackageHash(body) === p.packageHash;
}

export interface TorpedoDamagePackageInput {
  battleId: string;
  battleMinute: number;
  substep: number;
  torpedoTrackId: string;
  targetShipId: string;
  targetContactId: string;
  impactZone: TorpedoImpactZone;
  impactSide: TorpedoImpactSide;
  longitudinalPositionM: number;
  warheadExplosiveEquivalentMassKg: number;
  detonationDepthM: number;
  protectionLevel: TorpedoTargetProtectionLevel;
  hullBreachAreaM2: number;
  isolationState: FloodingIsolationState;
  machinery: TorpedoMachineryPackageField;
  nearbySystemShock: TorpedoShockPackageField;
  fireProbabilityBp: number;
  crewCasualties: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  flotationDamageOverride?: number;
}

export function createTorpedoDamagePackage(input: TorpedoDamagePackageInput): TorpedoDamagePackage {
  if (
    typeof input.battleId !== "string" ||
    input.battleId.length === 0 ||
    !isInt(input.battleMinute) ||
    input.battleMinute < 0 ||
    !isInt(input.substep) ||
    input.substep < 1 ||
    typeof input.torpedoTrackId !== "string" ||
    input.torpedoTrackId.length === 0
  )
    invariant("identity", input, "package identity inputs must be well-formed");

  const base = computeBaseWarheadFlotationDamage(input.warheadExplosiveEquivalentMassKg);
  const flotationDamage =
    input.flotationDamageOverride ??
    computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: base,
      protectionLevel: input.protectionLevel,
      impactZone: input.impactZone,
    });
  const progressiveFloodingRateKgMin = computeTorpedoFloodingRateKgMin({
    baseBreachRateKgMin: computeBaseBreachRateKgMin(input.hullBreachAreaM2),
    isolationState: input.isolationState,
  });
  const immediateFloodingKg = Math.floor(
    input.hullBreachAreaM2 *
      Math.max(input.detonationDepthM, TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M) *
      TORPEDO_SEAWATER_DENSITY_KG_PER_M3,
  );

  const body: TorpedoDamagePackageBody = {
    packageId: `${input.battleId}:${input.battleMinute}:${input.substep}:torpedo-damage:${input.torpedoTrackId}`,
    battleMinute: input.battleMinute,
    substep: input.substep,
    torpedoTrackId: input.torpedoTrackId,
    targetShipId: input.targetShipId,
    targetContactId: input.targetContactId,
    impactZone: input.impactZone,
    impactSide: input.impactSide,
    longitudinalPositionM: input.longitudinalPositionM,
    warheadExplosiveEquivalentMassKg: input.warheadExplosiveEquivalentMassKg,
    detonationDepthM: input.detonationDepthM,
    protectionLevel: input.protectionLevel,
    hullBreachAreaM2: input.hullBreachAreaM2,
    immediateFloodingKg,
    progressiveFloodingRateKgMin,
    machinery: input.machinery,
    nearbySystemShock: input.nearbySystemShock,
    fireProbabilityBp: input.fireProbabilityBp,
    crewCasualties: input.crewCasualties,
    structuralDamage: Math.floor(
      input.warheadExplosiveEquivalentMassKg * TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ,
    ),
    flotationDamage,
    damageControlAccessibility: input.damageControlAccessibility,
  };
  assertTorpedoDamagePackageSurface(body as TorpedoDamagePackage);
  const packageHash = computeTorpedoDamagePackageHash(body);
  return deepFreeze({ ...body, packageHash });
}

export function battleIdFromPackage(packageId: string): string {
  const separator = packageId.indexOf(":");
  if (separator <= 0) invariant("packageId", packageId, "packageId must embed the battle id");
  return packageId.slice(0, separator);
}

export interface TorpedoDamageApplicationInput {
  state: ShipDamageState;
  pkg: TorpedoDamagePackage;
  flooding: readonly {
    compartmentId: string;
    baseBreachRateKgMin: number;
    seaPressureMultiplierBp?: number;
    hullDamageMultiplierBp?: number;
    compartmentMultiplierBp?: number;
    isolationState?: FloodingIsolationState;
    isolationMultiplierBp?: number;
  }[];
  machinery?: { zone: TorpedoImpactZone; machineryComponents: readonly string[] };
  shockCandidates?: readonly SystemShockCandidate[];
  turretComponents?: readonly TurretComponent[];
  tubeHazard?: {
    launcherId: string;
    propulsionType: TorpedoPropulsionType;
    loadedCount: number;
    loadedChecks: readonly { tubeIndex: number; torpedoModelId: string }[];
    isolationState: FloodingIsolationState;
    protectionLevel: TorpedoTubeProtectionLevel;
    crewAtRisk: number;
    shockCandidates?: readonly SystemShockCandidate[];
    targetCompartmentId: string;
  };
  designFlotationReserve: number;
  designStabilityScore: number;
  keyedRng: (stream: string) => number;
  precomputedEffect?: {
    machinery: TorpedoMachineryEffect | null;
    systemShock: TorpedoSystemShockResult | null;
  };
}

export interface TorpedoDamageEventRecord {
  battleMinute: number;
  substep: number;
  packageId: string;
  torpedoTrackId: string;
  targetShipId: string;
  structuralDamage: number;
  flotationDamage: number;
  createdFloodingSources: readonly FloodingSourceRecord[];
  machineryReasonCode: string | null;
  shockReasonCode: string | null;
  tubeHazardReasonCode: string | null;
  terminalTransition: string | null;
  recordHash: string;
}

export type TorpedoDamageEventRecordBody = Omit<TorpedoDamageEventRecord, "recordHash">;

export function computeTorpedoDamageEventHash(body: TorpedoDamageEventRecordBody): string {
  return createEnvelope("torpedo-damage-event", torpedoPolicyId, body).bodyHash;
}

export interface TorpedoDamageApplicationResult {
  newState: ShipDamageState;
  structureFlotation: StructureFlotationResult;
  createdFloodingSources: readonly FloodingSourceRecord[];
  machineryEffect: TorpedoMachineryEffect | null;
  systemShockResult: TorpedoSystemShockResult | null;
  appliedTurrets: readonly TurretComponent[];
  tubeHazardResult: TorpedoTubeHazardResult | null;
  terminalResult: TerminalResult;
  eventRecord: TorpedoDamageEventRecord;
}
export function applyTorpedoDamagePackage(
  o: TorpedoDamageApplicationInput,
): TorpedoDamageApplicationResult {
  assertFixedPointDamage(o.state);
  assertAuthoritativeTorpedoDamagePackage(o.pkg);
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");
  if (!isInt(o.designFlotationReserve) || o.designFlotationReserve <= 0)
    invariant("designFlotationReserve", o.designFlotationReserve, "must be a positive integer");
  if (
    !isInt(o.designStabilityScore) ||
    o.designStabilityScore <= 0 ||
    o.designStabilityScore > 10_000
  )
    invariant(
      "designStabilityScore",
      o.designStabilityScore,
      "must be a positive integer bp [1, 10_000]",
    );
  if (!Array.isArray(o.flooding))
    invariant("flooding", o.flooding, "flooding compartments must be an array");

  const structureFlotation = resolveStructureFlotation({
    structuralDamage: o.pkg.structuralDamage,
    flotationDamage: o.pkg.flotationDamage,
    currentStructuralIntegrity: o.state.structuralIntegrity,
    currentFlotationReserve: o.state.flotationReserve,
  });

  const createdFloodingSources = resolveTorpedoFloodingCreation({ compartments: o.flooding });

  const machineryEffect =
    o.precomputedEffect?.machinery !== undefined
      ? o.precomputedEffect.machinery
      : o.machinery !== undefined
        ? evaluateTorpedoMachineryDamage({
            battleId: battleIdFromPackage(o.pkg.packageId),
            impactMinute: o.pkg.battleMinute,
            impactSubstep: o.pkg.substep,
            torpedoTrackId: o.pkg.torpedoTrackId,
            zone: o.machinery.zone,
            machineryComponents: o.machinery.machineryComponents,
            keyedRng: o.keyedRng,
          })
        : null;

  const systemShockResult =
    o.precomputedEffect?.systemShock !== undefined
      ? o.precomputedEffect.systemShock
      : o.shockCandidates !== undefined
        ? evaluateTorpedoSystemShock({
            battleId: battleIdFromPackage(o.pkg.packageId),
            impactMinute: o.pkg.battleMinute,
            impactSubstep: o.pkg.substep,
            entityId: o.pkg.torpedoTrackId,
            candidates: o.shockCandidates,
            keyedRng: o.keyedRng,
          })
        : null;
  const appliedTurrets =
    o.turretComponents !== undefined
      ? Object.freeze(
          o.turretComponents.map((t) =>
            systemShockResult?.affectedSystem?.stableSystemId === t.id
              ? applyTurretDamage(t, "DESTROYED")
              : t,
          ),
        )
      : Object.freeze([]);

  let tubeHazardResult: TorpedoTubeHazardResult | null = null;
  let severeImmediateFloodingKg = 0;
  let floodingRecords: readonly FloodingSourceRecord[] = [
    ...o.state.floodingRecords,
    ...createdFloodingSources,
  ];
  if (o.tubeHazard !== undefined) {
    const severeFloodingProbabilityBp = computeUnderwaterTubeSevereFloodingBp({
      loadedCount: o.tubeHazard.loadedCount,
      propulsionType: o.tubeHazard.propulsionType,
      isolationState: o.tubeHazard.isolationState,
      protectionLevel: o.tubeHazard.protectionLevel,
    });
    tubeHazardResult = resolveUnderwaterTubeHitHazard({
      battleId: battleIdFromPackage(o.pkg.packageId),
      impactMinute: o.pkg.battleMinute,
      impactSubstep: o.pkg.substep,
      torpedoTrackId: o.pkg.torpedoTrackId,
      launcherId: o.tubeHazard.launcherId,
      severeFloodingProbabilityBp,
      loadedTubeCount: o.tubeHazard.loadedCount,
      loadedChecks: o.tubeHazard.loadedChecks,
      baseProgressiveRateKgMin: o.pkg.progressiveFloodingRateKgMin,
      remainingFlotationReserve: structureFlotation.flotationReserveAfter,
      crewAtRisk: o.tubeHazard.crewAtRisk,
      shockCandidates: o.tubeHazard.shockCandidates ?? [],
      keyedRng: o.keyedRng,
      targetCompartmentId: o.tubeHazard.targetCompartmentId,
    });
    if (tubeHazardResult.severe) {
      floodingRecords = [...floodingRecords, tubeHazardResult.extraFloodingSource!];
      severeImmediateFloodingKg = tubeHazardResult.immediateAdditionalFloodingKg;
    }
  }

  const finalFlotationReserveAfter = Math.max(
    0,
    structureFlotation.flotationReserveAfter - severeImmediateFloodingKg,
  );

  const flotationPct =
    finalFlotationReserveAfter > 0
      ? Math.floor((finalFlotationReserveAfter * 10_000) / o.designFlotationReserve)
      : 0;
  const stabilityPct =
    o.state.stabilityScore > 0
      ? Math.floor((o.state.stabilityScore * 10_000) / o.designStabilityScore)
      : 0;
  const terminalResult = evaluateTerminalSeam({
    flotationReserveAfter: finalFlotationReserveAfter,
    structuralIntegrityAfter: structureFlotation.structuralIntegrityAfter,
    progressiveFloodingTotal: o.state.progressiveFloodingTotal,
    catastrophicBreakup: false,
    capsizeRisk: false,
    currentTerminalStatus: o.state.terminalStatus,
    flotationPct,
    stabilityPct,
  });
  const terminalTransition =
    terminalResult.transition === "NONE" ? null : terminalResult.transition;

  const assembled = withDamageStateHash({
    ...o.state,
    structuralIntegrity: structureFlotation.structuralIntegrityAfter,
    flotationReserve: finalFlotationReserveAfter,
    floodingRecords,
    progressiveFloodingTotal: o.state.progressiveFloodingTotal,
    terminalStatus: terminalTransition === null ? o.state.terminalStatus : terminalTransition,
  });
  const newState = deepFreeze(assembled);

  const eventBody: TorpedoDamageEventRecordBody = {
    battleMinute: o.pkg.battleMinute,
    substep: o.pkg.substep,
    packageId: o.pkg.packageId,
    torpedoTrackId: o.pkg.torpedoTrackId,
    targetShipId: o.pkg.targetShipId,
    structuralDamage: o.pkg.structuralDamage,
    flotationDamage: o.pkg.flotationDamage,
    createdFloodingSources,
    machineryReasonCode: machineryEffect?.reasonCode ?? null,
    shockReasonCode: systemShockResult?.reasonCode ?? null,
    tubeHazardReasonCode: tubeHazardResult?.reasonCode ?? null,
    terminalTransition,
  };
  const eventRecord = deepFreeze({
    ...eventBody,
    recordHash: computeTorpedoDamageEventHash(eventBody),
  });

  return Object.freeze({
    newState,
    structureFlotation,
    createdFloodingSources,
    machineryEffect,
    systemShockResult,
    appliedTurrets,
    tubeHazardResult,
    terminalResult,
    eventRecord,
  });
}

export function composeTorpedoChainReactionPackage(o: {
  chain: TorpedoChainReactionResult;
  packageInput: Omit<TorpedoDamagePackageInput, "warheadExplosiveEquivalentMassKg">;
}): TorpedoDamagePackage {
  if (
    !isInt(o.chain.totalConsumedWarheadEquivalentMassKg) ||
    o.chain.totalConsumedWarheadEquivalentMassKg <= 0
  )
    invariant(
      "chain.totalConsumedWarheadEquivalentMassKg",
      o.chain.totalConsumedWarheadEquivalentMassKg,
      "a detonated chain must consume a positive warhead-equivalent mass",
    );
  return createTorpedoDamagePackage({
    ...o.packageInput,
    warheadExplosiveEquivalentMassKg: o.chain.totalConsumedWarheadEquivalentMassKg,
  });
}

export function applyTorpedoChainReactionPackage(o: {
  chain: TorpedoChainReactionResult;
  packageContext: Omit<TorpedoDamagePackageInput, "warheadExplosiveEquivalentMassKg">;
  state: ShipDamageState;
  flooding: TorpedoDamageApplicationInput["flooding"];
  machinery?: TorpedoDamageApplicationInput["machinery"];
  shockCandidates?: TorpedoDamageApplicationInput["shockCandidates"];
  turretComponents?: TorpedoDamageApplicationInput["turretComponents"];
  designFlotationReserve: number;
  designStabilityScore: number;
  keyedRng: (stream: string) => number;
}): TorpedoDamageApplicationResult {
  const explosionPkg = composeTorpedoChainReactionPackage({
    chain: o.chain,
    packageInput: o.packageContext,
  });
  return applyTorpedoDamagePackage({
    state: o.state,
    pkg: explosionPkg,
    flooding: o.flooding,
    machinery: o.machinery,
    shockCandidates: o.shockCandidates,
    turretComponents: o.turretComponents,
    designFlotationReserve: o.designFlotationReserve,
    designStabilityScore: o.designStabilityScore,
    keyedRng: o.keyedRng,
  });
}
