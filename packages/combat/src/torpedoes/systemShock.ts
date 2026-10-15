// DESIGN-40 §20 turret/system loss via underwater shock (INC-6, AC-17).
// Underwater shock may damage a turret, magazine-handling system, fire-control
// connection, radar, sonar, pumps, electrical system, steering, or another
// nearby system ONLY when the system lies within the impact zone's declared
// shock radius. Shipped base probabilities: within PRIMARY radius 3_000 bp,
// within SECONDARY 1_000 bp, OUTSIDE 0. A successful check selects from the
// ACTUAL nearby systems in ascending stable-id order through one keyed
// weighted selection — each eligible system's weight is its radius band's base
// probability; the residual mass of the 10_000 bp pool is the NO_DAMAGE
// outcome. Systems OUTSIDE the declared radius are never in the pool (the
// resolver never destroys a spatially ineligible system).
//
// Determinism: exactly ONE keyed draw on
//   battle/torpedo/damage/system-shock:<battleId>:<impactMinute>:<impactSubstep>:<trackId>
// and NO draw when the pool is empty (an empty pool is a deterministic
// no-effect, so the draw layout is input-deterministic). A damaged system
// records the in-slice cause TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED and the
// B-4ComponentOutcome "DESTROYED" (the shock amplience is a loss outcome — §20
// "Turret and System Loss"); turret application goes through the reused
// applyTurretDamage seam in damagePackage.ts.
//
// Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_SYSTEM_SHOCK_BANDS,
  TORPEDO_SYSTEM_SHOCK_BASE_BP,
  type TorpedoSystemShockBand,
} from "./damageConstants.js";
import { TORPEDO_BASIS_POINTS_PER_UNIT } from "./constants.js";
import {
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED,
} from "./reasonCodes.js";

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

// §20 pools: a candidate system with its declared shock band. The layout layer
// classifies each actual nearby system; OUTSIDE candidates never enter the
// selection pool (spatial eligibility gate).
export interface SystemShockCandidate {
  stableSystemId: string;
  band: TorpedoSystemShockBand;
}

function assertCandidate(c: unknown): asserts c is SystemShockCandidate {
  if (typeof c !== "object" || c === null)
    invariant("candidate", c, "a system-shock candidate is required");
  const candidate = c as SystemShockCandidate;
  if (typeof candidate.stableSystemId !== "string" || candidate.stableSystemId.length === 0)
    invariant("stableSystemId", candidate.stableSystemId, "system id must be a non-empty string");
  if (!(TORPEDO_SYSTEM_SHOCK_BANDS as readonly string[]).includes(candidate.band))
    invariant("band", candidate.band, "band must be a canonical §20 shock-radius band");
}

/** Fail-closed candidate validator (exported for the tube-hazard seam). */
export function assertSystemShockCandidate(c: unknown): asserts c is SystemShockCandidate {
  assertCandidate(c);
}

// AC-17: ordering + eligibility — the selection pool of ACTUAL nearby systems
// in ascending stable-id order, excluding every spatially ineligible system.
// The comparator is a plain string `<`/`>` (NO localeCompare — the no-locale-read
// contract; plain comparison is fully deterministic across engines).
export function eligibleShockSystems(
  candidates: readonly SystemShockCandidate[],
): readonly SystemShockCandidate[] {
  if (!Array.isArray(candidates))
    invariant("candidates", candidates, "candidates must be an array");
  candidates.forEach(assertCandidate);
  return Object.freeze(
    [...candidates]
      .filter((c) => c.band !== "OUTSIDE")
      .sort((a, b) =>
        a.stableSystemId < b.stableSystemId ? -1 : a.stableSystemId > b.stableSystemId ? 1 : 0,
      ),
  );
}

// The deterministic pool weights: each eligible system's band base probability.
export function shockSelectionWeights(pool: readonly SystemShockCandidate[]): readonly number[] {
  return pool.map((c) => TORPEDO_SYSTEM_SHOCK_BASE_BP[c.band]);
}

// AC-17: keyed weighted selection — drawBp < cumulative selects that system;
// drawBp >= the pool mass selects NO_DAMAGE (the residual). The single draw
// covers the whole 10_000 bp pool (base masses + no-damage mass).
export function selectShockSystem(
  pool: readonly SystemShockCandidate[],
  drawBp: number,
): SystemShockCandidate | null {
  if (!isInt(drawBp) || drawBp < 0 || drawBp >= TORPEDO_BASIS_POINTS_PER_UNIT)
    invariant(
      "drawBp",
      drawBp,
      `system-shock draw must be an integer within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT})`,
    );
  let cumulative = 0;
  for (const candidate of pool) {
    cumulative += TORPEDO_SYSTEM_SHOCK_BASE_BP[candidate.band];
    if (drawBp < cumulative) return candidate;
  }
  return null; // the residual NO_DAMAGE bucket — no system damaged
}

export interface TorpedoSystemShockResult {
  affectedSystem: SystemShockCandidate | null; // null = NO_DAMAGE
  // the full eligible pool (ascending stable-id) the selection ran over
  eligibleSystems: readonly SystemShockCandidate[];
  decision: { streamId: string; draw: number; drawBp: number } | null; // null when no draw
  // "DESTROYED" on a damaged system; null when no system was selected.
  componentOutcome: "DESTROYED" | null;
  reasonCode: string | null; // TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED on a damaged system
}

// AC-17: the complete system-shock evaluation. An empty pool (or a pool that
// is entirely spatially ineligible) is a deterministic no-effect that consumes
// NO draw; otherwise exactly ONE keyed draw over the eligible systems.
export function evaluateTorpedoSystemShock(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  entityId: string; // the track/launcher id this shock belongs to
  candidates: readonly SystemShockCandidate[];
  keyedRng: (stream: string) => number;
}): TorpedoSystemShockResult {
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");
  if (
    typeof o.battleId !== "string" ||
    o.battleId.length === 0 ||
    !isInt(o.impactMinute) ||
    o.impactMinute < 0 ||
    !isInt(o.impactSubstep) ||
    o.impactSubstep < 1 ||
    typeof o.entityId !== "string" ||
    o.entityId.length === 0
  )
    invariant("identity", o, "system-shock identity inputs must be well-formed");

  const pool = eligibleShockSystems(o.candidates);
  if (pool.length === 0) {
    return Object.freeze({
      affectedSystem: null,
      eligibleSystems: Object.freeze(pool),
      decision: null,
      componentOutcome: null,
      reasonCode: null,
    });
  }
  const streamId = `battle/torpedo/damage/system-shock:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.entityId}`;
  const draw = o.keyedRng(streamId);
  if (typeof draw !== "number" || draw < 0 || draw >= 1)
    invariant("draw", draw, "the keyed draw must be a float within [0, 1)");
  const drawBp = Math.floor(draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  const affected = selectShockSystem(pool, drawBp);
  return Object.freeze({
    affectedSystem: affected === null ? null : Object.freeze({ ...affected }),
    eligibleSystems: Object.freeze(pool),
    decision: Object.freeze({ streamId, draw, drawBp }),
    componentOutcome: affected === null ? null : "DESTROYED",
    reasonCode: affected === null ? null : TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED,
  });
}
