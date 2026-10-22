import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_MACHINERY_SEVERITIES,
  TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP,
  TORPEDO_NON_MACHINERY_ELIGIBILITY_BP,
  torpedoMachineryEligibilityBp,
  type TorpedoMachinerySeverity,
} from "./damageConstants.js";
import { TORPEDO_BASIS_POINTS_PER_UNIT } from "./constants.js";
import { TORPEDO_MACHINERY_DAMAGE_CREATED, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import type { ComponentOutcome } from "../damage/componentDamage.js";
import type { TorpedoImpactZone } from "./detonation.js";

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

export function machinerySelectionWeightsBp(
  isMachinerySpace: boolean,
): Record<TorpedoMachinerySeverity, number> {
  if (typeof isMachinerySpace !== "boolean")
    invariant("isMachinerySpace", isMachinerySpace, "must be a boolean");
  const weights: Record<TorpedoMachinerySeverity, number> = {
    ...TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP,
  };
  if (isMachinerySpace) return weights;
  let effectMass = 0;
  for (const severity of TORPEDO_MACHINERY_SEVERITIES) {
    if (severity === "NO_EFFECT") continue;
    const w = Math.floor(
      (TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP[severity] * TORPEDO_NON_MACHINERY_ELIGIBILITY_BP) /
        TORPEDO_BASIS_POINTS_PER_UNIT,
    );
    weights[severity] = w;
    effectMass += w;
  }
  weights["NO_EFFECT"] = TORPEDO_BASIS_POINTS_PER_UNIT - effectMass;
  return weights;
}

export function machinerySeverityToComponentOutcome(
  severity: TorpedoMachinerySeverity,
): ComponentOutcome {
  if (!(TORPEDO_MACHINERY_SEVERITIES as readonly string[]).includes(severity))
    invariant("severity", severity, "severity must be a canonical §19 severity");
  switch (severity) {
    case "NO_EFFECT":
      return "UNAFFECTED";
    case "DEGRADED_PROPULSION":
      return "DEGRADED";
    case "MAJOR_PROPULSION_LOSS":
      return "DISABLED";
    case "DEAD_IN_WATER":
      return "DISABLED";
    case "CATASTROPHIC_MACHINERY_LOSS":
      return "DESTROYED";
  }
}

export function selectMachinerySeverity(
  weights: Record<TorpedoMachinerySeverity, number>,
  drawBp: number,
): TorpedoMachinerySeverity {
  if (!isInt(drawBp) || drawBp < 0 || drawBp >= TORPEDO_BASIS_POINTS_PER_UNIT)
    invariant(
      "drawBp",
      drawBp,
      `machinery draw must be an integer within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT})`,
    );
  let cumulative = 0;
  for (const severity of TORPEDO_MACHINERY_SEVERITIES) {
    cumulative += weights[severity];
    if (drawBp < cumulative) return severity;
  }
  invariant("weights", weights, "machinery weights must total exactly 10_000");
}

export function torpedoMachineryStreamId(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
}): string {
  if (
    typeof o.battleId !== "string" ||
    o.battleId.length === 0 ||
    !isInt(o.impactMinute) ||
    o.impactMinute < 0 ||
    !isInt(o.impactSubstep) ||
    o.impactSubstep < 1 ||
    typeof o.torpedoTrackId !== "string" ||
    o.torpedoTrackId.length === 0
  )
    invariant("stream identity", o, "the machinery stream identity must be well-formed");
  return `battle/torpedo/damage/machinery:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.torpedoTrackId}`;
}

export interface TorpedoMachineryEffect {
  severity: TorpedoMachinerySeverity;
  componentEffects: readonly { componentId: string; outcome: ComponentOutcome }[];
  decision: { streamId: string; draw: number; drawBp: number };
  reasonCode: string | null;
}

export function evaluateTorpedoMachineryDamage(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
  zone: TorpedoImpactZone;
  machineryComponents: readonly string[];
  keyedRng: (stream: string) => number;
}): TorpedoMachineryEffect {
  if (!Array.isArray(o.machineryComponents))
    invariant(
      "machineryComponents",
      o.machineryComponents,
      "machinery components must be an array",
    );
  for (const c of o.machineryComponents) {
    if (typeof c !== "string" || c.length === 0)
      invariant("machineryComponents", c, "every machinery component id must be non-empty");
  }
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");

  const eligibilityBp = torpedoMachineryEligibilityBp(o.zone);
  const weights = machinerySelectionWeightsBp(eligibilityBp === TORPEDO_BASIS_POINTS_PER_UNIT);

  const streamId = torpedoMachineryStreamId({
    battleId: o.battleId,
    impactMinute: o.impactMinute,
    impactSubstep: o.impactSubstep,
    torpedoTrackId: o.torpedoTrackId,
  });
  const draw = o.keyedRng(streamId);
  if (typeof draw !== "number" || draw < 0 || draw >= 1)
    invariant("draw", draw, "the keyed draw must be a float within [0, 1)");
  const drawBp = Math.floor(draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  const severity = selectMachinerySeverity(weights, drawBp);
  const outcome = machinerySeverityToComponentOutcome(severity);
  const componentEffects = o.machineryComponents.map((componentId) => ({
    componentId,
    outcome,
  }));
  return Object.freeze({
    severity,
    componentEffects: Object.freeze(componentEffects),
    decision: Object.freeze({ streamId, draw, drawBp }),
    reasonCode: severity === "NO_EFFECT" ? null : TORPEDO_MACHINERY_DAMAGE_CREATED,
  });
}
