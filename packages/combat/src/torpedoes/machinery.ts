// DESIGN-40 §19 machinery damage (INC-6, AC-17). A torpedo hit in a machinery
// space evaluates propulsion-unit / shaft / boiler / electrical / steering /
// fuel-system damage through a KEYED weighted selection over the shipped
// severity weights:
//   NO_EFFECT 1_000 / DEGRADED_PROPULSION 4_000 / MAJOR_PROPULSION_LOSS 3_000 /
//   DEAD_IN_WATER 1_500 / CATASTROPHIC_MACHINERY_LOSS 500   (total exactly 10_000)
// A non-machinery impact uses the reduced eligibility multiplier 2_500 bp:
// every non-NO_EFFECT weight scales by floor(w × 2_500 / 10_000) and NO_EFFECT
// absorbs the freed mass — the machinery-effect bucket shrinks to 25% of its
// zone value (the exact "reduced eligibility" semantics; the scaled weights
// also total exactly 10_000). §19 "in or adjacent to machinery spaces": the
// zone-derived eligibility is handled entirely by the shipped
// torpedoMachineryEligibilityBp table (MACHINERY -> full, otherwise reduced).
//
// The selected severity writes into the B-4 ComponentOutcome vocabulary via
// the pinned mapping (seam verdict: "writing into ComponentOutcome-style
// results"): NO_EFFECT -> UNAFFECTED, DEGRADED_PROPULSION -> DEGRADED,
// MAJOR_PROPULSION_LOSS -> DISABLED, DEAD_IN_WATER -> DISABLED (all propulsive
// power lost), CATASTROPHIC_MACHINERY_LOSS -> DESTROYED. A non-NO_EFFECT
// selection records the in-slice cause TORPEDO_MACHINERY_DAMAGE_CREATED.
//
// Determinism: exactly ONE keyed draw on the hierarchical stream
//   battle/torpedo/damage/machinery:<battleId>:<impactMinute>:<impactSubstep>:<trackId>
// All attached machinery components receive the same outcome (the machinery
// space is hit as a whole; the blast conduit is the ship's propulsion plant).
// Pure/deterministic: no ambient I/O/clock/random.
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

// AC-17: the selection weights for a hit zone. Machinery space -> the shipped
// weights verbatim (total exactly 10_000); non-machinery -> every effect
// weight scaled by floor(w × 2_500 / 10_000) with NO_EFFECT absorbing the
// remainder (also total exactly 10_000). Proof-shaped export for the tests.
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
  weights["NO_EFFECT"] = TORPEDO_BASIS_POINTS_PER_UNIT - effectMass; // absorb the remainder
  return weights;
}

// §19 -> B-4 ComponentOutcome mapping (the pinned seam vocabulary).
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

// The deterministic cumulative selection: drawBp < the first cumulative weight
// selects that severity bucket; the residual mass lands in NO_EFFECT.
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
  // The weights total exactly 10_000, so a drawBp < 10_000 always lands in a
  // bucket; the fall-through is unreachable — fail closed defensively rather
  // than return a silent default.
  invariant("weights", weights, "machinery weights must total exactly 10_000");
}

// The deterministic AC-17 stream identity (hierarchical + domain-separated).
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
  // B-4 ComponentOutcome-style effects, one per attached machinery component
  // in the supplied stable component-id order (seam verdict vocabulary).
  componentEffects: readonly { componentId: string; outcome: ComponentOutcome }[];
  decision: { streamId: string; draw: number; drawBp: number };
  reasonCode: string | null; // TORPEDO_MACHINERY_DAMAGE_CREATED on a real effect
}

// AC-17: the keyed weighted machinery evaluation. The machinery components are
// an input from the layout layer (the ship's propulsion plant inside the blast
// influence); the zone decides the eligibility surface.
export function evaluateTorpedoMachineryDamage(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
  zone: TorpedoImpactZone; // $17 zone — decides full vs reduced eligibility
  machineryComponents: readonly string[]; // stable component ids
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

  // Zone -> eligibility (fail-closed on a non-canonical zone via the shipped
  // lookup in damageConstants.ts).
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
