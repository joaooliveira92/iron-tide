// DESIGN-41 §7 — Turret state machine.
// Five canonical turret states. `applyTurretDamage` moves a turret to a new
// state based on a component damage outcome. No elapsed-time restoration
// (jam duration is recorded but not ticked down — that's the caller's domain).
// Pure/deterministic: no ambient I/O/clock/random.

import { type ComponentOutcome } from "./componentDamage.js";

// Five canonical turret states (§7)

export type TurretState = "OPERATIONAL" | "JAMMED" | "DISABLED" | "DESTROYED" | "BURNED_OUT";

export interface TurretComponent {
  id: string;
  state: TurretState;
  jamDurationMinutes?: number;
}

// State transitions

// The most severe outcome that maps to each turret state.
// ComponentOutcome → TurretState mapping:
//   UNAFFECTED → OPERATIONAL
//   DEGRADED  → OPERATIONAL (degraded accuracy but still functioning)
//   JAMMED    → JAMMED
//   DISABLED  → DISABLED
//   DESTROYED → DESTROYED
//   BURNED_OUT → BURNED_OUT
//   FLOODED   → DISABLED (flooded turret is non-functional)
//   ISOLATED  → DISABLED (isolated turret has no power/ammo)

const OUTCOME_TO_TURRET_STATE: Record<ComponentOutcome, TurretState> = {
  UNAFFECTED: "OPERATIONAL",
  DEGRADED: "OPERATIONAL",
  JAMMED: "JAMMED",
  DISABLED: "DISABLED",
  DESTROYED: "DESTROYED",
  BURNED_OUT: "BURNED_OUT",
  FLOODED: "DISABLED",
  ISOLATED: "DISABLED",
};

/**
 * Apply a component damage outcome to a turret, returning the updated turret.
 *
 * If the outcome is JAMMED, the turret enters JAMMED state and a
 * jamDurationMinutes of 5 is set (per §7 default). If the turret is already
 * in a higher-severity state (DISABLED, DESTROYED, BURNED_OUT), it stays in
 * that state (no downgrade).
 *
 * @param turret - The current turret component.
 * @param outcome - The component damage outcome from Stage 3.
 * @returns A new TurretComponent with the updated state.
 */
export function applyTurretDamage(
  turret: TurretComponent,
  outcome: ComponentOutcome,
): TurretComponent {
  const newState = OUTCOME_TO_TURRET_STATE[outcome];
  const currentStateSeverity = stateSeverity(turret.state);
  const newStateSeverity = stateSeverity(newState);

  // Never downgrade a turret from a more severe state to a less severe one.
  if (newStateSeverity <= currentStateSeverity && newState !== turret.state) {
    // Equal severity but different state? Only for JAMMED → OPERATIONAL transitions
    // which should not happen (we don't restore from JAMMED here).
    return turret;
  }

  const jamDurationMinutes = newState === "JAMMED" ? 5 : undefined;

  return {
    id: turret.id,
    state: newState,
    ...(jamDurationMinutes !== undefined ? { jamDurationMinutes } : {}),
  };
}

// ---- Severity ordering (higher = worse) ----
const SEVERITY_ORDER: Record<TurretState, number> = {
  OPERATIONAL: 0,
  JAMMED: 1,
  DISABLED: 2,
  DESTROYED: 3,
  BURNED_OUT: 4,
};

function stateSeverity(state: TurretState): number {
  return SEVERITY_ORDER[state];
}
