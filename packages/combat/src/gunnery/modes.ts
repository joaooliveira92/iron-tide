// packages/combat/src/gunnery/modes.ts
import { BluewaveError } from "@bluewave/contracts";
import { FIRE_MODES, type FireMode, SURFACE_FIRE_CONTROL_MINIMUM_BP } from "./constants.js";
import {
  GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
  GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT,
  INVALID_GUNNERY_STATE,
} from "./reasonCodes.js";
import { assertFixedPointGunnery, type GunneryState } from "./state.js";

export interface FireModeDefinition {
  readonly mode: FireMode;
  readonly ammunitionUse: string;
  readonly reloadBehavior: string;
  readonly accuracyBehavior: string;
  readonly targetEligibility: string;
  readonly fireControlRequirements: string;
  readonly cancellationBehavior: string;
  readonly eligibilityPredicateDeferred: boolean;
  readonly deferredReason: string | null;
}

const DEFERRED = Object.freeze({
  eligibilityPredicateDeferred: true,
  deferredReason: GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
} as const);
const IMPLEMENTED = Object.freeze({
  eligibilityPredicateDeferred: false,
  deferredReason: null,
} as const);

export const FIRE_MODE_DEFINITIONS: Record<FireMode, FireModeDefinition> = Object.freeze({
  CEASE_FIRE: Object.freeze({
    mode: "CEASE_FIRE",
    ammunitionUse: "none — no salvo may fire.",
    reloadBehavior: "reload progress is preserved (no advance, no decay).",
    accuracyBehavior: "not applicable (no firing solution is evaluated).",
    targetEligibility: "legacy target retained but never engaged.",
    fireControlRequirements: "none required (cease-fire suppresses engagement).",
    cancellationBehavior: "immediately cancels any pending salvo; overrides all other modes.",
    ...IMPLEMENTED,
  }),
  RANGING: Object.freeze({
    mode: "RANGING",
    ammunitionUse: "spotting/common shell only; conserves heavy ammunition.",
    reloadBehavior: "standard reload cycle.",
    accuracyBehavior: "reduced salvo accuracy; uses observation to refine range estimate.",
    targetEligibility: "surface target with observed fall-of-shot.",
    fireControlRequirements:
      "minimum surface fire-control solution (SURFACE_FIRE_CONTROL_MINIMUM_BP).",
    cancellationBehavior: "cancelled on target loss, solution loss, or mode change.",
    ...IMPLEMENTED,
  }),
  NORMAL: Object.freeze({
    mode: "NORMAL",
    ammunitionUse: "standard mixed salvo per ammunition policy.",
    reloadBehavior: "standard reload cycle.",
    accuracyBehavior: "full normal salvo accuracy.",
    targetEligibility: "surface target permitted by the active command contract.",
    fireControlRequirements:
      "minimum surface fire-control solution (SURFACE_FIRE_CONTROL_MINIMUM_BP).",
    cancellationBehavior: "cancelled on target loss, solution loss, or mode change.",
    ...IMPLEMENTED,
  }),
  RAPID: Object.freeze({
    mode: "RAPID",
    ammunitionUse: "accelerated ammunition expenditure (autoloader policy §7).",
    reloadBehavior: "rapid reload cycle only while eligible (§7).",
    accuracyBehavior: "full RAPID salvo accuracy.",
    targetEligibility:
      "eligible only after a valid straddle or explicit fire-control predicate (§2/§25) — predicate deferred.",
    fireControlRequirements: "straddle or explicit predicate — DEFERRED.",
    cancellationBehavior:
      "ends immediately on target loss/change, solution loss, mode change, autoloader damage, or feed interruption (§7).",
    ...DEFERRED,
  }),
  AA_TRACKING: Object.freeze({
    mode: "AA_TRACKING",
    ammunitionUse: "AA-compatible ammunition only (§9).",
    reloadBehavior: "sustained AA reload multiplier (§9).",
    accuracyBehavior: "AA tracking accuracy unchanged unless a technology modifies it (§9).",
    targetEligibility:
      "AA-capable gun/mount against an eligible air target (§9) — predicate deferred.",
    fireControlRequirements: "AA fire-control solution (§9) — DEFERRED.",
    cancellationBehavior: "cancelled on target loss, AA solution loss, or role switch (§15).",
    ...DEFERRED,
  }),
  AA_BARRAGE: Object.freeze({
    mode: "AA_BARRAGE",
    ammunitionUse:
      "heavy AA-compatible ammunition expenditure; short-burst limit of 2 tactical minutes (§9).",
    reloadBehavior: "short AA burst reload multiplier (§9).",
    accuracyBehavior: "barrage accuracy per §9 short-burst policy.",
    targetEligibility:
      "AA-capable gun/mount; burst eligible only while the short-burst window lasts (§9) — predicate deferred.",
    fireControlRequirements: "AA fire-control solution (§9) — DEFERRED.",
    cancellationBehavior: "cancelled on target loss, burst-window expiry, or role switch.",
    ...DEFERRED,
  }),
  LOCAL_CONTROL: Object.freeze({
    mode: "LOCAL_CONTROL",
    ammunitionUse: "standard selection at crew discretion within command-legal ammo.",
    reloadBehavior: "standard reload cycle.",
    accuracyBehavior: "normal salvo accuracy, no fire-control refinement bonus.",
    targetEligibility: "surface target visible to the mount's local director.",
    fireControlRequirements:
      "minimum surface fire-control solution (SURFACE_FIRE_CONTROL_MINIMUM_BP).",
    cancellationBehavior: "cancelled on target loss, solution loss, or return to central control.",
    ...IMPLEMENTED,
  }),
} as Record<FireMode, FireModeDefinition>);

export function assertFireModeClosed(mode: string): asserts mode is FireMode {
  if (typeof mode !== "string" || !(FIRE_MODES as readonly string[]).includes(mode)) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      mode,
      reason: "not a canonical DESIGN-39 §2 fire mode",
    });
  }
}

export function getFireModeDefinition(mode: FireMode): FireModeDefinition {
  assertFireModeClosed(mode);
  return FIRE_MODE_DEFINITIONS[mode];
}

// AC-2 firing guard. Holds the state invariant, then evaluates the mode's
// eligibility. Deferred predicates (RAPID / AA_TRACKING / AA_BARRAGE) are REPORTED
// via GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED — never fabricated. Implemented surface
// modes require a fire-control solution at/above SURFACE_FIRE_CONTROL_MINIMUM_BP
// (GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT). CEASE_FIRE is intentionally a
// no-fire mode and passes trivially.
export function assertFireModeEligible(mode: FireMode, state: GunneryState): void {
  assertFixedPointGunnery(state);
  assertFireModeClosed(mode);
  const def = FIRE_MODE_DEFINITIONS[mode];
  if (!def) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      mode,
      reason: "not a canonical DESIGN-39 §2 fire mode",
    });
  }
  if (def.eligibilityPredicateDeferred) {
    const reason = def.deferredReason ?? GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED;
    throw new BluewaveError(reason, {
      code: reason,
      mode,
      reason: "eligibility predicate deferred to a later slice (never fabricated)",
    });
  }
  if (mode === "CEASE_FIRE") return;
  if (state.fireControlSolutionQualityBp < SURFACE_FIRE_CONTROL_MINIMUM_BP) {
    throw new BluewaveError(GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT, {
      code: GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT,
      mode,
      fireControlSolutionQualityBp: state.fireControlSolutionQualityBp,
      thresholdBp: SURFACE_FIRE_CONTROL_MINIMUM_BP,
    });
  }
}
