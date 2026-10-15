//packages/combat/src/torpedoes/damagePackage.ts
// DESIGN-40 §16 TorpedoDamagePackage (INC-6, AC-15) + the atomic application
// through the tactical damage contract. A damaging detonation creates ONE
// package carrying every §16 field (target + impact zone, warhead
// explosive-equivalent mass, detonation depth, impact side + longitudinal
// position, underwater-protection resistance, hull-breach area, immediate
// flooding, progressive source rate, machinery, nearby turret + system shock,
// fire probability, crew casualties, structural damage, flotation loss,
// damage-control accessibility) + the domain-separated package hash
// (createEnvelope "torpedo-damage-package" + torpedo_v1 + deepFreeze — the
// seam-verdict record pattern).
//
// The factory computes the authoritative damage budget from the raw scene:
//   - flotationDamage — the exact §17 formula over the base warhead flotation
//     damage (warhead explosive-equivalent mass × shipped rate) with the
//     shipped protection-leak + impact-zone tables (flotation.ts);
//   - progressiveFloodingRateKgMin — the creation-only §18 rate over the base
//     breach rate from the hull-breach area and the shipped isolation table
//     (flooding.ts);
//   - structuralDamage — floor(eqMass × authored rate, damageConstants.ts);
//   - immediateFloodingKg — the breach-volume estimate
//     floor(hullBreachAreaM2 × breachDepthM × TORPEDO_SEAWATER_DENSITY_KG_PER_M3)
//     with breachDepth = the detonation depth floored at the shipped
//     TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M — authored BALANCE TARGETs
//     (ADR-0029), CONTRACT-PINNED in damageConstants.ts;
//   - fireProbabilityBp / crewCasualties / machinery / shock / damageControl
//     are the caller's resolved inputs (validated fail-closed).
//
// Damage applies ATOMICALLY through the reused B-4 seams (rollback invariant
// intact): resolveStructureFlotation (floor-at-0; the §17 "never exceeds the
// remaining reserve without a sinking/sunk transition" bound is enforced by
// the terminal seam below), evaluateTerminalSeam (flotation 0 without
// foundering -> SINKING with its duration), the §19 machinery evaluator
// (ComponentOutcome vocabulary), the §20 shock evaluator + applyTurretDamage
// on the caller's turret list, the §18 creation-only flooding resolver, and
// the §21 tube hazard on a TUBE_BAY zone with a launcher context. A SEVERE §21
// result applies its "immediate additional flooding" as FLOTATION-RESERVE loss
// (per §16/§17 semantics — the same floor-at-0 reserve reduction as the §17
// flotation damage), reducing the reserve before the terminal seam; the
// separate 15_000 bp extraFloodingSource is a C-5 progressive source and is
// NOT accumulated into progressiveFloodingTotal (the §21 immediate burst is
// NOT a progressive total). §22 chain PROBES for the loaded rounds are
// returned (the caller resolves them and applies each explosion package
// through this same atomic path — the §22 "separate explosion damage package"
// composition helper composeTorpedoChainReactionPackage /
// applyTorpedoChainReactionPackage is wired below).
//
// Deterministic stage/draw layout (identical inputs consume identical draws):
//   1. machinery    (battle/torpedo/damage/machinery:...)    iff machinery ctx
//   2. system shock (battle/torpedo/damage/system-shock:...) iff shock candidates
//   3. tube hazard  (battle/torpedo/tube-hazard:...)         iff tube-hazard ctx
//   4. casualty     (battle/torpedo/tube-hazard/casualty:...) iff severe hazard
//   §22 chain draws are NOT consumed here — the layout never shifts with the
//   chain outcome (INC-5 LOW-4 stability note honored).
//
// Pure/deterministic: no ambient I/O/clock/random. Every output deep-frozen;
// the authoritative ShipDamageState is assembled EXACTLY ONCE after all
// stages pass (a stage throw leaves the input state untouched).
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

// ---------------------------------------------------------------------------
// §16 TorpedoDamagePackage — every field of the §16 list + the package hash.
export interface TorpedoDamagePackage {
  packageId: string; // deterministic: <battleId>:<minute>:<substep>:torpedo-damage:<trackId>
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
  protectionLevel: TorpedoTargetProtectionLevel; // underwater-protection resistance
  hullBreachAreaM2: number; // integer m²
  immediateFloodingKg: number;
  progressiveFloodingRateKgMin: number;
  machinery: TorpedoMachineryPackageField;
  nearbySystemShock: TorpedoShockPackageField;
  fireProbabilityBp: number;
  crewCasualties: number;
  structuralDamage: number;
  flotationDamage: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  packageHash: string; // authoritative SHA-256 envelope
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

// The authoritative package hash — domain-separated with torpedo_v1.
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

// Fail-closed surface guard: every §16 field well-formed; a malformed package
// fails with TORPEDO_STATE_INVARIANT_FAILED (the packageHash presence is
// checked by assertAuthoritativeTorpedoDamagePackage — a hash-less body is
// validated here before hashing).
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

// ---------------------------------------------------------------------------
// The authoritative factory (computes the §17/§18 budget + the package hash).
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
  isolationState: FloodingIsolationState; // §18 rate table input
  machinery: TorpedoMachineryPackageField;
  nearbySystemShock: TorpedoShockPackageField;
  fireProbabilityBp: number;
  crewCasualties: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  // outer-resolved override (the §22 chain explosion uses the summed mass —
  // the factory re-runs the same §17 formula over that mass; the override
  // bypasses only when a caller explicitly recomputed the budget).
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

  // §17 flotation: floor(base × leak × zone × existing / 10_000^3).
  const base = computeBaseWarheadFlotationDamage(input.warheadExplosiveEquivalentMassKg);
  const flotationDamage =
    input.flotationDamageOverride ??
    computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: base,
      protectionLevel: input.protectionLevel,
      impactZone: input.impactZone,
    });
  // §18 progressive rate over the base breach rate + shipped isolation table.
  const progressiveFloodingRateKgMin = computeTorpedoFloodingRateKgMin({
    baseBreachRateKgMin: computeBaseBreachRateKgMin(input.hullBreachAreaM2),
    isolationState: input.isolationState,
  });
  // immediate flooding — the breach-volume estimate (BALANCE TARGET: hole area
  // × water depth at the strike; the detonation depth proxied, floored to the
  // shipped minimum). The density + minimum-depth literals are CONTRACT-PINNED
  // in damageConstants.ts (HIGH-1/LOW-2) — never inline a divergent value.
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

// The battle id lives inside the deterministic package id
// (<battleId>:<minute>:<substep>:torpedo-damage:<trackId>).
export function battleIdFromPackage(packageId: string): string {
  const separator = packageId.indexOf(":");
  if (separator <= 0) invariant("packageId", packageId, "packageId must embed the battle id");
  return packageId.slice(0, separator);
}

// ---------------------------------------------------------------------------
// Atomic application through the tactical damage contract (AC-15).

export interface TorpedoDamageApplicationInput {
  state: ShipDamageState;
  pkg: TorpedoDamagePackage;
  // §18 per-compartment creation inputs (creation-only — no per-minute tick).
  flooding: readonly {
    compartmentId: string;
    baseBreachRateKgMin: number;
    seaPressureMultiplierBp?: number;
    hullDamageMultiplierBp?: number;
    compartmentMultiplierBp?: number;
    isolationState?: FloodingIsolationState;
    isolationMultiplierBp?: number;
  }[];
  // §19 machinery context (omit = no machinery evaluation / no draw).
  machinery?: { zone: TorpedoImpactZone; machineryComponents: readonly string[] };
  // §20 nearby-system shock context (omit = no shock evaluation / no draw).
  shockCandidates?: readonly SystemShockCandidate[];
  // Caller's current turret list — the applyTurretDamage seam on shocked turrets.
  turretComponents?: readonly TurretComponent[];
  // §21 tube-hazard context (omit = no hazard — non-tube / no launcher scene).
  tubeHazard?: {
    launcherId: string;
    propulsionType: TorpedoPropulsionType;
    loadedCount: number; // the launcher's non-EMPTY loaded tube count
    loadedChecks: readonly { tubeIndex: number; torpedoModelId: string }[];
    isolationState: FloodingIsolationState;
    protectionLevel: TorpedoTubeProtectionLevel;
    crewAtRisk: number;
    shockCandidates?: readonly SystemShockCandidate[]; // the shock-check pool
    targetCompartmentId: string; // the breached compartment the tubes sit in
  };
  designFlotationReserve: number; // design (max) flotation reserve
  designStabilityScore: number; // design stability bp
  keyedRng: (stream: string) => number;
  // MEDIUM-6 (reviewer): the engine pre-evaluates §19/§20 to populate the
  // package fields; WITHOUT this option applyTorpedoDamagePackage re-evaluates
  // the SAME keyed streams, which is only correct because `keyedRng` re-seeds
  // per stream (a fragile invariant). When present, the caller's single
  // evaluation is threaded in and the internal re-evaluation is skipped, so
  // each stream draw is consumed EXACTLY once. Optional — the public API and the
  // standalone call path (e.g. applyTorpedoChainReactionPackage) are unchanged.
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
// AC-15/AC-16: the atomic application. All stages are pure computations over
// local values; the authoritative ShipDamageState is assembled exactly once at
// the end and validated through withDamageStateHash (a stage throw leaves the
// input state untouched — the B-4 rollback invariant is preserved). The
// returned state and records are deep-frozen; the state carries a fresh
// authoritative hash.
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

  // ---- stage 1: STRUCTURE + FLOTATION (reused seam, floor-at-0) -----------
  const structureFlotation = resolveStructureFlotation({
    structuralDamage: o.pkg.structuralDamage,
    flotationDamage: o.pkg.flotationDamage,
    currentStructuralIntegrity: o.state.structuralIntegrity,
    currentFlotationReserve: o.state.flotationReserve,
  });

  // ---- stage 2: §18 progressive-flooding CREATION (creation-only) ---------
  const createdFloodingSources = resolveTorpedoFloodingCreation({ compartments: o.flooding });

  // ---- stage 3: §19 machinery (keyed weighted severity) -------------------
  // MEDIUM-6: use the caller's single pre-computed evaluation when supplied
  // (the engine pre-evaluates to populate the package fields) — otherwise
  // evaluate here exactly as before. Either way the stream draw is consumed
  // exactly once.
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

  // ---- stage 4: §20 nearby-system shock (keyed weighted selection) -------
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
  // The reuse seam: only the SELECTED (eligible) turret may transition.
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

  // ---- stage 5: §21 underwater-tube hit hazard (TUBE_BAY + launcher ctx) --
  let tubeHazardResult: TorpedoTubeHazardResult | null = null;
  // The §21 severe "immediate additional flooding" is FLOTATION-RESERVE loss per
  // §16/§17 semantics (DESIGN-40 separates an immediate-flooding field from a
  // progressive-flooding source rate — §21's "5_000 bp of remaining reserve" is
  // immediate flotation loss; the SEPARATE progressive source is the 15_000 bp
  // extraFloodingSource record, a C-5 progressive source). It is therefore NOT
  // accumulated into progressiveFloodingTotal (that would mask the immediate
  // reserve reduction and the evaluateTerminalSeam reserve read).
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
      // the extra 15_000 bp progressive source enters the ship state; the
      // immediate flooding burst is applied as flotation-reserve loss below.
      floodingRecords = [...floodingRecords, tubeHazardResult.extraFloodingSource!];
      severeImmediateFloodingKg = tubeHazardResult.immediateAdditionalFloodingKg;
    }
  }

  // ---- stage 5b: §21 severe immediate flooding -> flotation-reserve loss -----
  // The §17 flotation damage already reduced the reserve through the reused
  // resolveStructureFlotation seam; the §21 severe burst reduces it FURTHER —
  // capped by the remaining reserve, floor-at-0, so evaluateTerminalSeam can
  // still see a SINKING/SUNK boundary when the reserve is exhausted (the §17
  // "never exceeds remaining reserve without a terminal transition" bound).
  const finalFlotationReserveAfter = Math.max(
    0,
    structureFlotation.flotationReserveAfter - severeImmediateFloodingKg,
  );

  // ---- stage 6: terminal seam (reused §29-32 — the reserve-capping bound) --
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

  // ---- assembly: ONE authoritative state construction + fresh hash --------
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

// ---------------------------------------------------------------------------
// §22 SEPARATE explosion damage package (MEDIUM-4): the composition helper.
// The §22 chain detonation creates its OWN damage package (never a silent
// alteration of the original): it carries the CONSUMED torpedoes' summed warhead
// explosive-equivalent mass (totalConsumedWarheadEquivalentMassKg) and re-runs
// the §17 flotation + §18 flooding budget over that mass through the SAME
// factory (createTorpedoDamagePackage). The §22 chain draws are NOT consumed
// here — they are separate probes resolved by resolveTorpedoChainReaction
// (INC-5 LOW-4 rule). The package builder is pure; the atomic application is
// wired through applyTorpedoDamagePackage below so a caller never has to
// manually thread the consumed mass into the factory.
export function composeTorpedoChainReactionPackage(o: {
  chain: TorpedoChainReactionResult;
  // the package context (identity + geometry + resolved fields); the
  // warheadExplosiveEquivalentMassKg is IGNORED and replaced by the consumed
  // mass (the shipped helper owns that override — no caller convention).
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

// The §22 separate explosion applied ATOMICALLY (the same path as
// applyTorpedoDamagePackage — a stage throw leaves the input state untouched).
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
