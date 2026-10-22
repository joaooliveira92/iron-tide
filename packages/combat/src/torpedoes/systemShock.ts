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

export function assertSystemShockCandidate(c: unknown): asserts c is SystemShockCandidate {
  assertCandidate(c);
}

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

export function shockSelectionWeights(pool: readonly SystemShockCandidate[]): readonly number[] {
  return pool.map((c) => TORPEDO_SYSTEM_SHOCK_BASE_BP[c.band]);
}

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
  return null;
}

export interface TorpedoSystemShockResult {
  affectedSystem: SystemShockCandidate | null;
  eligibleSystems: readonly SystemShockCandidate[];
  decision: { streamId: string; draw: number; drawBp: number } | null;
  componentOutcome: "DESTROYED" | null;
  reasonCode: string | null;
}

export function evaluateTorpedoSystemShock(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  entityId: string;
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
